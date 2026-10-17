import { z } from 'zod';
import type { Env } from './types';
const day = 86400_000;
const canonical = z
  .string()
  .url()
  .max(2048)
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  });
export const inspectionSchema = z
  .object({
    action: z.literal('inspect'),
    id: z.string().uuid(),
    provider: z.enum(['google', 'bing']),
    status: z.enum(['indexed', 'not_indexed', 'unavailable']),
    checkedAt: z.string().datetime(),
    lastCrawlAt: z.string().datetime().nullable(),
    declaredCanonical: canonical.nullable(),
    indexedCanonical: canonical.nullable(),
    note: z.string().min(12).max(800),
  })
  .strict();

/** A provider's visible URL inspection is separate from accepting a submission. */
export async function recordSearchInspection(env: Env, input: z.infer<typeof inspectionSchema>) {
  const db = env.ANALYTICS!,
    now = Date.now(),
    checked = Date.parse(input.checkedAt);
  if (checked > now + 5 * 60_000 || checked < now - 30 * day) throw new Error('inspection_time_out_of_range');
  const job = await db
    .prepare(
      "SELECT id,url,kind,revision,created_at FROM search_console_queue WHERE id=? AND status!='superseded'",
    )
    .bind(input.id)
    .first<{ id: string; url: string; kind: string; revision: string; created_at: number }>();
  if (!job) return { status: 'not_found' };
  const publication =
    job.kind === 'article'
      ? await db
          .prepare('SELECT updated_at FROM editorial_publications WHERE path=? AND revision=?')
          .bind(new URL(job.url).pathname.replace(/^\/en\//, '/').replace(/^\/|\/$/g, ''), job.revision)
          .first<{ updated_at: number }>()
      : null;
  const crawl = input.lastCrawlAt ? Date.parse(input.lastCrawlAt) : null;
  if (crawl !== null && crawl > checked + 5 * 60_000) throw new Error('inspection_crawl_time_out_of_range');
  const revisionAt = publication?.updated_at ?? job.created_at;
  const revisionCrawl = crawl === null ? 'unknown' : crawl >= revisionAt ? 'after_update' : 'before_update';
  const age = (now - job.created_at) / day;
  const delay =
    input.status === 'unavailable'
      ? day
      : input.status === 'indexed'
        ? revisionCrawl === 'after_update'
          ? 28 * day
          : 7 * day
        : age < 3
          ? day
          : age < 7
            ? 3 * day
            : age < 14
              ? 7 * day
              : 14 * day;
  const evidence = JSON.stringify({
    ...input,
    action: undefined,
    id: undefined,
    url: job.url,
    revision: job.revision,
    revisionCrawl,
  });
  const eventId = crypto.randomUUID();
  const writes = await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO search_console_inspection_events(id,job_id,provider,checked_at,status,evidence_json) VALUES(?,?,?,?,?,?)',
      )
      .bind(eventId, job.id, input.provider, checked, input.status, evidence),
    db
      .prepare(
        `INSERT INTO search_console_inspections(job_id,provider,status,checked_at,next_check_at,last_crawl_at,declared_canonical,indexed_canonical,evidence_json)
      SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM search_console_inspection_events WHERE id=?)
      ON CONFLICT(job_id,provider) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at,next_check_at=excluded.next_check_at,
      last_crawl_at=excluded.last_crawl_at,declared_canonical=excluded.declared_canonical,indexed_canonical=excluded.indexed_canonical,evidence_json=excluded.evidence_json
      WHERE search_console_inspections.checked_at IS NULL OR search_console_inspections.checked_at<excluded.checked_at`,
      )
      .bind(
        job.id,
        input.provider,
        input.status,
        checked,
        now + delay,
        crawl,
        input.declaredCanonical,
        input.indexedCanonical,
        evidence,
        eventId,
      ),
  ]);
  return {
    status: writes[0].meta.changes ? 'recorded' : 'unchanged',
    inspection: await db
      .prepare('SELECT * FROM search_console_inspections WHERE job_id=? AND provider=?')
      .bind(job.id, input.provider)
      .first(),
  };
}

export async function searchInspectionsStatus(env: Env) {
  const db = env.ANALYTICS!;
  const latest = `q.status!='superseded' AND NOT EXISTS(SELECT 1 FROM search_console_queue newer WHERE newer.url=q.url AND newer.created_at>q.created_at AND newer.status!='superseded')`;
  const [counts, due, observations, dueCount] = await Promise.all([
    db
      .prepare(
        `SELECT i.provider,i.status,COUNT(*) total FROM search_console_inspections i JOIN search_console_queue q ON q.id=i.job_id WHERE ${latest} GROUP BY i.provider,i.status`,
      )
      .all(),
    db
      .prepare(
        `SELECT i.job_id AS id,q.url,q.revision,q.kind,i.provider,i.status,i.checked_at,i.next_check_at FROM search_console_inspections i JOIN search_console_queue q ON q.id=i.job_id WHERE ${latest} AND i.next_check_at<=? ORDER BY i.next_check_at,CASE q.kind WHEN 'article' THEN 0 ELSE 1 END,q.priority DESC,q.url,i.provider LIMIT 100`,
      )
      .bind(Date.now())
      .all(),
    db
      .prepare(
        `SELECT q.url,i.* FROM search_console_inspections i JOIN search_console_queue q ON q.id=i.job_id WHERE ${latest} AND i.checked_at IS NOT NULL ORDER BY i.checked_at DESC LIMIT 40`,
      )
      .all(),
    db
      .prepare(
        `SELECT COUNT(*) total FROM search_console_inspections i JOIN search_console_queue q ON q.id=i.job_id WHERE ${latest} AND i.next_check_at<=?`,
      )
      .bind(Date.now())
      .first<{ total: number }>(),
  ]);
  return {
    counts: counts.results,
    dueTotal: dueCount?.total ?? 0,
    due: due.results,
    latest: observations.results,
    note: 'URL indexed is distinct from a newly crawled revision. Unknown/unavailable are not zero. Inspect without requesting indexing again.',
  };
}
