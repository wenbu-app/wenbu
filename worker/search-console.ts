import { z } from 'zod';
import type { Env } from './types';
import { searchQueueStatements } from './search-console-queue';
import { inspectionSchema, recordSearchInspection, searchInspectionsStatus } from './search-inspections';

const origin = 'https://wenbu.app';
const day = 86400_000;
export const searchActionSchema = z.discriminatedUnion('action', [
  inspectionSchema,
  z.object({ action: z.literal('seed') }).strict(),
  z.object({ action: z.literal('reconcile') }).strict(),
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
  const now = Date.now();
  const pause = await db
    .prepare('SELECT retry_at,reason FROM search_console_state WHERE id=1')
    .first<{ retry_at: number; reason: string | null }>();
  const unresolved = await db
    .prepare("SELECT COUNT(*) AS total FROM search_console_queue WHERE status IN ('requesting','uncertain')")
    .first<{ total: number }>();
  const next =
    (unresolved?.total ?? 0) > 0
      ? null
      : await db
          .prepare(
            `SELECT q.id,q.url,q.revision,q.kind,q.status,q.priority,
    MAX(q.retry_at,COALESCE((SELECT MAX(prior.requested_at)+? FROM search_console_queue prior WHERE prior.url=q.url),0),?) AS eligible_at
    FROM search_console_queue q WHERE q.status IN ('pending','deferred')
    ORDER BY CASE WHEN MAX(q.retry_at,COALESCE((SELECT MAX(prior.requested_at)+? FROM search_console_queue prior WHERE prior.url=q.url),0),?)<=? THEN 0 ELSE 1 END,
      q.priority DESC,CASE q.status WHEN 'deferred' THEN 0 ELSE 1 END,q.created_at,q.url LIMIT 1`,
          )
          .bind(day, pause?.retry_at ?? 0, day, pause?.retry_at ?? 0, now)
          .first();
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
    globalRetryAt: pause?.retry_at ?? 0,
    pauseReason: pause?.reason ?? null,
    nextRequest: next,
    blockedByUnresolvedDispatch: (unresolved?.total ?? 0) > 0,
    inspections: await searchInspectionsStatus(env),
    note: 'requested means a visibly accepted Search Console request, not indexing. Never automatically replay requesting or uncertain jobs.',
  };
}
export async function searchConsoleAction(env: Env, input: z.infer<typeof searchActionSchema>) {
  const db = env.ANALYTICS!,
    now = Date.now();
  if (input.action === 'inspect') return recordSearchInspection(env, input);
  if (input.action === 'reconcile') {
    const publications = (
      await db
        .prepare('SELECT path,revision,updated_at FROM editorial_publications')
        .all<{ path: string; revision: string; updated_at: number }>()
    ).results;
    let added = 0;
    for (const p of publications) {
      if (!/^(learn|compare)\/[a-z0-9-]+$/.test(p.path)) throw new Error('search_publication_path_invalid');
      const results = await db.batch(
        searchQueueStatements(
          db,
          [origin + '/' + p.path + '/', origin + '/en/' + p.path + '/'],
          p.revision,
          p.updated_at,
          { path: p.path },
        ),
      );
      added += results.filter((_, i) => i % 3 === 1).reduce((n, r) => n + (r.meta.changes ?? 0), 0);
    }
    return { status: 'reconciled', publications: publications.length, added };
  }
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
      added: results.filter((_, i) => i % 2 === 0).reduce((n, r) => n + (r.meta.changes ?? 0), 0),
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
