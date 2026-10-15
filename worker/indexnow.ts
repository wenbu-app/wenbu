import { z } from 'zod';
import config from '../src/data/indexnow.json';
import type { Env } from './types';
import { mergePublishedManifest } from './editorial-discovery';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  version: z.literal(1),
  origin: z.literal(config.origin),
  revision: hash,
  pages: z
    .array(z.object({ url: z.string().max(2048), hash }))
    .min(1)
    .max(10000),
});
type State = { lease_owner: string; retry_at: number; failures: number };
type Page = { url: string; content_hash: string };
const BATCH_SIZE = 10;
const LEASE_MS = 5 * 60_000;
export const INDEXNOW_CRON = '*/15 * * * *';

function canonicalUrl(value: string) {
  const url = new URL(value);
  return (
    url.origin === config.origin &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.href === value &&
    !/^\/(?:en\/)?(?:api|mcp|insights|journal|move)(?:\/|$)/.test(url.pathname)
  );
}

export async function indexNowStatus(env: Env) {
  if (!env.ANALYTICS) return { available: false };
  const [state, pages, receipts] = await Promise.all([
    env.ANALYTICS.prepare(
      'SELECT last_checked, last_status, last_error, retry_at, failures FROM indexnow_state WHERE id = 1',
    ).all(),
    env.ANALYTICS.prepare('SELECT COUNT(*) AS total FROM indexnow_pages').all(),
    env.ANALYTICS.prepare(
      'SELECT id, submitted_at, revision, http_status, outcome, url_count, retry_after_ms, endpoint_host, response_request_id, failure_streak FROM indexnow_submissions ORDER BY submitted_at DESC LIMIT 20',
    ).all(),
  ]);
  return {
    available: true,
    origin: config.origin,
    schedule: INDEXNOW_CRON,
    batchPolicy: {
      normal: BATCH_SIZE,
      repeatedFailure: 1,
      receiptCooldownMinutes: 60,
      fingerprints: 'substantive_content_v2',
    },
    trackedPages: pages.results[0]?.total ?? 0,
    state: state.results[0],
    receipts: receipts.results,
    note: 'HTTP 200 is a submission receipt; HTTP 202 means key validation is pending. Neither confirms indexing.',
  };
}

/** Uses this deployed version's asset binding, never a local build or caller-supplied URLs. */
export async function submitIndexNow(env: Env) {
  if (env.SITE_URL !== config.origin || !env.ANALYTICS) return { status: 'disabled', submitted: 0 };
  const db = env.ANALYTICS,
    now = Date.now(),
    owner = crypto.randomUUID();
  const lock = await db
    .prepare(
      `UPDATE indexnow_state SET lease_owner = ?, lease_until = ?
    WHERE id = 1 AND lease_until <= ?`,
    )
    .bind(owner, now + LEASE_MS, now)
    .run();
  if (!lock.meta.changes) return { status: 'busy', submitted: 0 };
  let failures = 0;
  try {
    const state = (
      await db.prepare('SELECT lease_owner, retry_at, failures FROM indexnow_state WHERE id = 1').all<State>()
    ).results[0];
    failures = state.failures;
    if (state.retry_at > now) {
      await db
        .prepare(
          `UPDATE indexnow_state SET last_checked = ?, last_status = 'backoff'
        WHERE id = 1 AND lease_owner = ?`,
        )
        .bind(now, owner)
        .run();
      return { status: 'backoff', submitted: 0, retryAt: state.retry_at };
    }
    const asset = await env.ASSETS.fetch(
      new Request(config.origin + config.manifestPath, { signal: AbortSignal.timeout(10_000) }),
    );
    if (asset.status !== 200) throw new Error('manifest_unavailable');
    const raw = await asset.text();
    if (raw.length > 2_000_000) throw new Error('manifest_too_large');
    const parsed = manifestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error('manifest_invalid');
    const manifest = await mergePublishedManifest(env, parsed.data);
    const current = new Map(manifest.pages.map((p) => [p.url, p.hash]));
    if (current.size !== manifest.pages.length || !manifest.pages.every((p) => canonicalUrl(p.url)))
      throw new Error('manifest_invalid_urls');
    const revision = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest.pages))),
      ),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (revision !== manifest.revision) throw new Error('manifest_revision_mismatch');
    const known = (await db.prepare('SELECT url, content_hash FROM indexnow_pages').all<Page>()).results;
    if (!known.every((p) => canonicalUrl(p.url))) throw new Error('stored_urls_invalid');
    const previous = new Map(known.map((p) => [p.url, p.content_hash]));
    const changes = [
      ...manifest.pages.filter((p) => previous.get(p.url) !== p.hash),
      ...known.filter((p) => !current.has(p.url)).map((p) => ({ url: p.url, hash: null })),
    ];
    if (!changes.length) {
      await db
        .prepare(
          `UPDATE indexnow_state SET last_checked = ?, last_status = 'unchanged',
        last_error = NULL, retry_at = 0, failures = 0 WHERE id = 1 AND lease_owner = ?`,
        )
        .bind(now, owner)
        .run();
      return { status: 'unchanged', submitted: 0, revision };
    }
    // The root key must exist in the same deployed asset set before notifying the endpoint.
    const keyLocation = `${config.origin}/${config.key}.txt`;
    const key = await env.ASSETS.fetch(new Request(keyLocation, { signal: AbortSignal.timeout(10_000) }));
    if (key.status !== 200 || (await key.text()).trim() !== config.key) throw new Error('key_unavailable');
    // New URLs have not been received before. Prioritize them, then changed pages and removals.
    changes.sort((a, b) => Number(previous.has(a.url)) - Number(previous.has(b.url)));
    const batch = changes.slice(0, failures >= 3 ? 1 : BATCH_SIZE),
      urls = batch.map((p) => p.url);
    const ownership = await db
      .prepare('SELECT id FROM indexnow_state WHERE id = 1 AND lease_owner = ? AND lease_until > ?')
      .bind(owner, Date.now())
      .all();
    if (!ownership.results.length) return { status: 'lease_lost', submitted: 0 };
    let httpStatus: number | null = null,
      retryAfter = 0;
    let transportError: string | null = null;
    let responseRequestId: string | null = null;
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        // workerd rejects redirect: 'error'. Do not follow a redirect with our POST body.
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'User-Agent': 'WenbuIndexNow/2.0 (+https://wenbu.app/about/)',
        },
        body: JSON.stringify({
          host: new URL(config.origin).host,
          key: config.key,
          keyLocation,
          urlList: urls,
        }),
      });
      httpStatus = response.status;
      const header = response.headers.get('Retry-After');
      if (header) retryAfter = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - now;
      responseRequestId =
        (
          response.headers.get('x-request-id') ??
          response.headers.get('x-msedge-ref') ??
          response.headers.get('cf-ray')
        )?.slice(0, 160) ?? null;
      await response.body?.cancel();
    } catch (cause) {
      // Retain the changed URLs for the next attempt. Do not record remote response bodies.
      // This exception belongs to the fixed public endpoint, not visitor data or credentials.
      transportError =
        cause instanceof Error ? `${cause.name}: ${cause.message}`.slice(0, 240) : 'unknown_transport_error';
    }
    const received = httpStatus === 200 || httpStatus === 202;
    const outcome = httpStatus === 200 ? 'submitted' : httpStatus === 202 ? 'pending_validation' : 'retrying';
    const error = received
      ? null
      : httpStatus === null
        ? `network_error: ${transportError}`
        : `http_${httpStatus}`;
    const delay = Math.max(
      Math.min(86400_000, 15 * 60_000 * 2 ** Math.min(failures, 7)),
      Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0,
    );
    const retryAt = received ? (env.EDITORIAL_ENABLED === 'true' ? now + 3600_000 : 0) : now + delay;
    const writes = [
      db
        .prepare(
          `INSERT INTO indexnow_submissions (id, submitted_at, revision, http_status, outcome, url_count, urls_json, retry_after_ms, endpoint_host, response_request_id, failure_streak)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM indexnow_state WHERE id = 1 AND lease_owner = ?)`,
        )
        .bind(
          crypto.randomUUID(),
          now,
          revision,
          httpStatus,
          outcome,
          urls.length,
          JSON.stringify(urls),
          Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : null,
          new URL(config.endpoint).hostname,
          responseRequestId,
          received ? 0 : failures + 1,
          owner,
        ),
    ];
    if (received) {
      writes.push(
        db
          .prepare(
            `DELETE FROM indexnow_pages WHERE url IN (SELECT json_extract(value, '$.url') FROM json_each(?)
          WHERE json_extract(value, '$.hash') IS NULL) AND EXISTS (SELECT 1 FROM indexnow_state WHERE id = 1 AND lease_owner = ?)`,
          )
          .bind(JSON.stringify(batch), owner),
        db
          .prepare(
            `INSERT INTO indexnow_pages (url, content_hash)
          SELECT json_extract(value, '$.url'), json_extract(value, '$.hash') FROM json_each(?)
          WHERE json_extract(value, '$.hash') IS NOT NULL AND EXISTS (SELECT 1 FROM indexnow_state WHERE id = 1 AND lease_owner = ?)
          ON CONFLICT(url) DO UPDATE SET content_hash = excluded.content_hash`,
          )
          .bind(JSON.stringify(batch), owner),
      );
    }
    writes.push(
      db
        .prepare(
          `UPDATE indexnow_state SET last_checked = ?, last_status = ?, last_error = ?,
      retry_at = ?, failures = ? WHERE id = 1 AND lease_owner = ?`,
        )
        .bind(now, outcome, error, retryAt, received ? 0 : failures + 1, owner),
    );
    const persisted = await db.batch(writes);
    if (!persisted[0].meta.changes)
      return { status: 'lease_lost', httpStatus, submitted: 0, attempted: urls.length };
    return {
      status: outcome,
      httpStatus,
      submitted: received ? urls.length : 0,
      attempted: urls.length,
      remaining: changes.length - (received ? urls.length : 0),
      revision,
      retryAt,
      ...(transportError ? { transportError } : {}),
    };
  } catch (cause) {
    const diagnosticCodes = new Set([
      'manifest_unavailable',
      'manifest_too_large',
      'manifest_invalid',
      'manifest_invalid_urls',
      'manifest_revision_mismatch',
      'stored_urls_invalid',
      'key_unavailable',
    ]);
    const error =
      cause instanceof Error && diagnosticCodes.has(cause.message) ? cause.message : 'asset_or_storage_error';
    const retryAt = now + Math.min(86400_000, 15 * 60_000 * 2 ** Math.min(failures, 7));
    await db
      .prepare(
        `UPDATE indexnow_state SET last_checked = ?, last_status = 'retrying', last_error = ?,
      retry_at = ?, failures = ? WHERE id = 1 AND lease_owner = ?`,
      )
      .bind(now, error, retryAt, failures + 1, owner)
      .run();
    return { status: 'retrying', submitted: 0, retryAt, error };
  } finally {
    await db
      .prepare('UPDATE indexnow_state SET lease_owner = ?, lease_until = 0 WHERE id = 1 AND lease_owner = ?')
      .bind('', owner)
      .run();
  }
}
