import { z } from 'zod';
import type { Env } from './types';
import { searchQueueStatements } from './search-console-queue';

const origin = 'https://wenbu.app';
const day = 86400_000;
export const searchActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('seed') }).strict(),
  z.object({ action: z.literal('claim'), id: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal('record'),
      id: z.string().uuid(),
      outcome: z.enum(['requested', 'deferred', 'uncertain']),
      reason: z.enum(['accepted', 'quota', 'captcha', 'permission', 'temporary_error', 'unknown_outcome']),
      note: z.string().min(8).max(800),
    })
    .strict(),
]);
type Job = { id: string; url: string; revision: string; kind: string; status: string; updated_at: number };
export async function searchConsoleStatus(env: Env) {
  const db = env.ANALYTICS!;
  return {
    property: 'sc-domain:wenbu.app',
    execution: 'Authenticated Search Console browser; no general-purpose Google indexing API',
    counts: (
      await db.prepare('SELECT status,COUNT(*) AS total FROM search_console_queue GROUP BY status').all()
    ).results,
    jobs: (
      await db
        .prepare(
          "SELECT * FROM search_console_queue ORDER BY CASE status WHEN 'requesting' THEN 0 WHEN 'uncertain' THEN 1 WHEN 'pending' THEN 2 WHEN 'deferred' THEN 3 ELSE 4 END,priority DESC,created_at LIMIT 500",
        )
        .all()
    ).results,
    globalRetryAt:
      (
        await db
          .prepare('SELECT retry_at AS at FROM search_console_state WHERE id=1')
          .first<{ at: number | null }>()
      )?.at ?? 0,
    note: 'requested means a visibly accepted Search Console request, not indexing. Never automatically replay requesting or uncertain jobs.',
  };
}
export async function searchConsoleAction(env: Env, input: z.infer<typeof searchActionSchema>) {
  const db = env.ANALYTICS!,
    now = Date.now();
  if (input.action === 'seed') {
    // The deployed manifest already excludes noindex, private and noncanonical routes.
    const response = await env.ASSETS.fetch(new Request(origin + '/indexnow-manifest.json'));
    if (!response.ok) throw new Error('search_manifest_unavailable');
    const manifest = z
      .object({
        pages: z
          .array(z.object({ url: z.string().url(), hash: z.string().regex(/^[a-f0-9]{64}$/) }))
          .max(500),
      })
      .parse(await response.json());
    const core = manifest.pages.filter(({ url }) => {
      const u = new URL(url);
      if (u.origin !== origin || u.search || u.hash || u.username || u.password)
        throw new Error('search_manifest_invalid');
      return (
        !/^\/(?:en\/)?(?:learn|compare)\/[^/]+/.test(u.pathname) &&
        !/^\/(?:en\/)?(?:api|mcp|knowledge|insights|journal|move|blog)(?:\/|$)/.test(u.pathname)
      );
    });
    const results = core.length
      ? await db.batch(core.flatMap((p) => searchQueueStatements(db, [p.url], p.hash, now)))
      : [];
    return {
      status: 'seeded',
      eligible: core.length,
      added: results.reduce((n, r) => n + (r.meta.changes ?? 0), 0),
    };
  }
  if (input.action === 'claim') {
    const writes = await db.batch([
      db
        .prepare(
          `UPDATE search_console_queue SET status='requesting',updated_at=? WHERE id=? AND status IN ('pending','deferred') AND retry_at<=?
        AND NOT EXISTS(SELECT 1 FROM search_console_queue WHERE status IN ('requesting','uncertain'))
        AND NOT EXISTS(SELECT 1 FROM search_console_state WHERE retry_at>?)
        AND NOT EXISTS(SELECT 1 FROM search_console_queue prior WHERE prior.url=search_console_queue.url AND prior.requested_at>?)`,
        )
        .bind(now, input.id, now, now, now - day),
      db
        .prepare(
          "INSERT INTO search_console_events(id,job_id,at,action) SELECT ?,?,?,'requesting' WHERE changes()=1",
        )
        .bind(crypto.randomUUID(), input.id, now),
    ]);
    return {
      status: writes[0].meta.changes ? 'claimed' : 'not_eligible',
      job: await db
        .prepare('SELECT id,url,revision,kind,status,updated_at FROM search_console_queue WHERE id=?')
        .bind(input.id)
        .first<Job>(),
    };
  }
  const valid =
    input.outcome === 'requested'
      ? input.reason === 'accepted'
      : input.outcome === 'uncertain'
        ? input.reason === 'unknown_outcome'
        : ['quota', 'captcha', 'permission', 'temporary_error'].includes(input.reason);
  if (!valid) throw new Error('search_receipt_mismatch');
  const evidence = JSON.stringify({
    reason: input.reason,
    note: input.note,
    observedAt: new Date(now).toISOString(),
  });
  const eventId = crypto.randomUUID();
  const writes = await db.batch([
    db
      .prepare(
        "UPDATE search_console_queue SET status=?,updated_at=?,retry_at=?,requested_at=?,evidence_json=? WHERE id=? AND status IN ('requesting','uncertain') AND status!=?",
      )
      .bind(
        input.outcome,
        now,
        input.outcome === 'deferred' ? now + day : 0,
        input.outcome === 'requested' ? now : null,
        evidence,
        input.id,
        input.outcome,
      ),
    db
      .prepare(
        'INSERT INTO search_console_events(id,job_id,at,action,evidence_json) SELECT ?,?,?,?,? WHERE changes()=1',
      )
      .bind(eventId, input.id, now, input.outcome, evidence),
    ...(input.outcome === 'deferred'
      ? [
          db
            .prepare(
              'UPDATE search_console_state SET retry_at=MAX(retry_at,?),reason=?,updated_at=? WHERE id=1 AND EXISTS(SELECT 1 FROM search_console_events WHERE id=?)',
            )
            .bind(now + day, input.reason, now, eventId),
        ]
      : []),
  ]);
  return {
    status: writes[0].meta.changes ? 'recorded' : 'unchanged',
    job: await db
      .prepare('SELECT id,url,revision,kind,status,updated_at FROM search_console_queue WHERE id=?')
      .bind(input.id)
      .first<Job>(),
  };
}
