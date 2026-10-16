import { editorialTopics, type EditorialTopic } from '../src/data/editorial-topics';
import { contentHash, pathForTopic, type EditorialDocument } from './editorial-schema';
import type { Env } from './types';
import { registerEditorialPaths } from '../src/lib/analytics-contract';

export async function seedEditorial(env: Env) {
  if (!env.ANALYTICS) throw new Error('editorial_database_unavailable');
  const now = Date.now();
  await env.ANALYTICS.batch(
    editorialTopics.map((topic) =>
      env
        .ANALYTICS!.prepare(
          "INSERT INTO editorial_topics(id,slug,category,definition_json,priority,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET definition_json=excluded.definition_json,priority=excluded.priority WHERE editorial_topics.status='ready' AND editorial_topics.last_attempt_at IS NULL AND editorial_topics.slug=excluded.slug AND editorial_topics.category=excluded.category",
        )
        .bind(topic.id, topic.slug, topic.category, JSON.stringify(topic), topic.priority, now),
    ),
  );
}

export async function claimEditorial(env: Env, runId: string, slot: string) {
  const db = env.ANALYTICS!;
  const now = Date.now();
  const locked = await db
    .prepare(
      'UPDATE editorial_state SET lease_owner=?,lease_until=? WHERE id=1 AND (lease_until<? OR lease_owner=?)',
    )
    .bind(runId, now + 25 * 60_000, now, runId)
    .run();
  if (!locked.meta.changes) throw new Error('editorial_busy');
  const existing = await db
    .prepare('SELECT topic_id,status FROM editorial_runs WHERE id=?')
    .bind(runId)
    .first<{ topic_id: string; status: string }>();
  if (existing?.status === 'published') return null;
  if (existing?.topic_id) {
    const row = await db
      .prepare('SELECT definition_json FROM editorial_topics WHERE id=?')
      .bind(existing.topic_id)
      .first<{ definition_json: string }>();
    if (row) return JSON.parse(row.definition_json) as EditorialTopic;
  }
  const recent = (
    await db
      .prepare('SELECT path FROM editorial_publications ORDER BY updated_at DESC LIMIT 2')
      .all<{ path: string }>()
  ).results;
  const rows = (
    await db
      .prepare(
        "SELECT id,definition_json FROM editorial_topics WHERE status='ready' AND (last_published_at IS NULL OR last_published_at<?) AND (last_attempt_at IS NULL OR last_attempt_at<?) ORDER BY last_attempt_at IS NOT NULL,priority DESC,created_at,id LIMIT 80",
      )
      .bind(now - 28 * 86400_000, now - 86400_000)
      .all<{ id: string; definition_json: string }>()
  ).results;
  const candidates = rows.map((r) => JSON.parse(r.definition_json) as EditorialTopic);
  const chosen =
    candidates.find(
      (t) =>
        !(
          recent.length === 2 &&
          recent.every((r) => r.path.startsWith('compare/')) &&
          t.category === 'compare'
        ),
    ) ?? candidates[0];
  if (!chosen) throw new Error('editorial_backlog_exhausted');
  await db.batch([
    db
      .prepare(
        "INSERT INTO editorial_runs(id,slot,topic_id,status,created_at,updated_at) VALUES(?,?,?,'researching',?,?) ON CONFLICT(id) DO UPDATE SET topic_id=excluded.topic_id,status='researching',updated_at=excluded.updated_at",
      )
      .bind(runId, slot, chosen.id, now, now),
    db
      .prepare('UPDATE editorial_topics SET last_attempt_at=?,attempts=attempts+1 WHERE id=?')
      .bind(now, chosen.id),
  ]);
  return chosen;
}
export async function renewEditorialLease(env: Env, runId: string) {
  const now = Date.now();
  const result = await env
    .ANALYTICS!.prepare(
      'UPDATE editorial_state SET lease_owner=?,lease_until=? WHERE id=1 AND (lease_owner=? OR lease_until<?)',
    )
    .bind(runId, now + 25 * 60_000, runId, now)
    .run();
  if (!result.meta.changes) throw new Error('editorial_busy');
}
export async function releaseEditorial(env: Env, runId: string) {
  await env
    .ANALYTICS!.prepare(
      "UPDATE editorial_state SET lease_owner='',lease_until=0 WHERE id=1 AND lease_owner=?",
    )
    .bind(runId)
    .run();
}
export async function editorialStage(
  env: Env,
  runId: string,
  status: string,
  field?: 'research_key' | 'draft_key' | 'review_key',
  key?: string,
) {
  await env
    .ANALYTICS!.prepare(
      `UPDATE editorial_runs SET status=?,updated_at=?${field ? `,${field}=?` : ''} WHERE id=?`,
    )
    .bind(...[status, Date.now(), ...(field ? [key ?? ''] : []), runId])
    .run();
}
export async function publishedDocuments(env: Env) {
  if (!env.ANALYTICS || env.EDITORIAL_ENABLED !== 'true') return [];
  const rows = (
    await env.ANALYTICS.prepare(
      'SELECT document_json FROM editorial_publications ORDER BY updated_at DESC LIMIT 1000',
    ).all<{ document_json: string }>()
  ).results;
  const docs = rows.map((r) => JSON.parse(r.document_json) as EditorialDocument);
  registerEditorialPaths(docs.map((d) => pathForTopic(d.topic)));
  return docs;
}
export async function registerPublishedRoutes(env: Env) {
  if (env.EDITORIAL_ENABLED !== 'true' || !env.ANALYTICS) return;
  const rows = await env.ANALYTICS.prepare('SELECT path FROM editorial_publications').all<{ path: string }>();
  registerEditorialPaths(rows.results.map((r) => r.path));
}
export async function publishedDocument(env: Env, path: string) {
  if (!env.ANALYTICS || env.EDITORIAL_ENABLED !== 'true') return null;
  const row = await env.ANALYTICS.prepare('SELECT document_json FROM editorial_publications WHERE path=?')
    .bind(path)
    .first<{ document_json: string }>();
  if (!row) return null;
  const doc = JSON.parse(row.document_json) as EditorialDocument;
  registerEditorialPaths([pathForTopic(doc.topic)]);
  return doc;
}
export async function publishEditorial(
  env: Env,
  runId: string,
  doc: EditorialDocument,
  expectedRevision: string | null = null,
) {
  if (env.EDITORIAL_AUTOPUBLISH !== 'true') throw new Error('editorial_publication_disabled');
  const db = env.ANALYTICS!;
  const retained = await db
    .prepare('SELECT document_json,run_id,published_at FROM editorial_revisions WHERE revision=?')
    .bind(doc.revision)
    .first<{ document_json: string; run_id: string; published_at: number }>();
  if (retained && retained.run_id !== runId) throw new Error('editorial_no_substantial_change');
  if (retained) doc = JSON.parse(retained.document_json) as EditorialDocument;
  const now = retained?.published_at ?? Date.now(),
    path = pathForTopic(doc.topic),
    json = JSON.stringify(doc);
  const urls = ['', 'en/'].map((prefix) => `${env.SITE_URL}/${prefix}${path}/`);
  if (retained) {
    const completed = await db
      .prepare('SELECT status,revision FROM editorial_runs WHERE id=?')
      .bind(runId)
      .first<{ status: string; revision: string | null }>();
    // Acknowledging an earlier commit must never move a newer public revision backwards.
    if (completed?.status === 'published' && completed.revision === doc.revision)
      return { urls, revision: doc.revision };
  }
  const current = await db
    .prepare('SELECT revision,run_id FROM editorial_publications WHERE path=?')
    .bind(path)
    .first<{ revision: string; run_id: string }>();
  if (
    current
      ? current.revision !== expectedRevision &&
        !(current.revision === doc.revision && current.run_id === runId)
      : expectedRevision !== null
  )
    throw new Error('editorial_stale_revision');
  const committed = await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO editorial_revisions(revision,path,document_json,run_id,published_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM editorial_state WHERE id=1 AND lease_owner=? AND lease_until>?)',
      )
      .bind(doc.revision, path, json, runId, now, runId, now),
    db
      .prepare(
        'INSERT INTO editorial_publications(path,topic_id,revision,document_json,published_at,updated_at,run_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM editorial_revisions WHERE revision=? AND run_id=?) ON CONFLICT(path) DO UPDATE SET revision=excluded.revision,document_json=excluded.document_json,updated_at=excluded.updated_at,run_id=excluded.run_id WHERE editorial_publications.revision=? OR (editorial_publications.revision=excluded.revision AND editorial_publications.run_id=excluded.run_id)',
      )
      .bind(path, doc.topic.id, doc.revision, json, now, now, runId, doc.revision, runId, expectedRevision),
    db
      .prepare(
        "UPDATE editorial_runs SET status='published',revision=?,published_urls_json=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM editorial_publications WHERE path=? AND revision=?)",
      )
      .bind(doc.revision, JSON.stringify(urls), now, runId, path, doc.revision),
    db
      .prepare(
        "UPDATE editorial_topics SET last_published_at=?,attempts=0,quality_failures=0,status='published' WHERE id=? AND EXISTS(SELECT 1 FROM editorial_publications WHERE path=? AND revision=?)",
      )
      .bind(now, doc.topic.id, path, doc.revision),
    db.prepare('UPDATE editorial_state SET last_content_at=? WHERE id=1 AND lease_owner=?').bind(now, runId),
  ]);
  if (!committed[1].meta.changes) throw new Error('editorial_lease_lost');
  return { urls, revision: doc.revision };
}
export async function failEditorial(env: Env, runId: string, code: string) {
  const db = env.ANALYTICS!;
  await db.batch([
    ...(/^quality_gate:|^editorial_schema_failed$/.test(code)
      ? [
          db
            .prepare(
              "UPDATE editorial_topics SET quality_failures=quality_failures+1,status=CASE WHEN quality_failures>=2 THEN 'blocked' ELSE status END WHERE id=(SELECT topic_id FROM editorial_runs WHERE id=? AND status NOT IN ('blocked','published'))",
            )
            .bind(runId),
        ]
      : []),
    db
      .prepare(
        "UPDATE editorial_runs SET status='blocked',error_code=?,updated_at=? WHERE id=? AND status!='published'",
      )
      .bind(code.slice(0, 160), Date.now(), runId),
  ]);
}
export async function observeEditorial(
  env: Env,
  kind: string,
  evidence: unknown,
  status = 'observed',
  period?: { start: string; end: string },
) {
  const serialized = JSON.stringify(evidence);
  if (serialized.length > 150_000) throw new Error('observation_too_large');
  const id = `${kind}-${await contentHash(serialized)}`;
  await env
    .ANALYTICS!.prepare(
      'INSERT OR IGNORE INTO editorial_observations(id,kind,checked_at,period_start,period_end,status,evidence_json) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(id, kind, Date.now(), period?.start ?? null, period?.end ?? null, status, serialized)
    .run();
  return { id, status };
}
export async function editorialStatus(env: Env) {
  const db = env.ANALYTICS!;
  const [topics, runs, observations, state, commissioningRuns] = await Promise.all([
    db.prepare('SELECT status,COUNT(*) AS total FROM editorial_topics GROUP BY status').all(),
    db
      .prepare(
        'SELECT id,slot,topic_id,status,created_at,updated_at,error_code,revision,published_urls_json,model_calls FROM editorial_runs ORDER BY created_at DESC LIMIT 30',
      )
      .all(),
    db
      .prepare(
        'SELECT id,kind,checked_at,period_start,period_end,status,evidence_json FROM editorial_observations ORDER BY checked_at DESC LIMIT 14',
      )
      .all(),
    db
      .prepare('SELECT last_content_at,last_health_at,last_planning_at FROM editorial_state WHERE id=1')
      .first(),
    db
      .prepare(
        'SELECT id,policy_version,status,started_at,finished_at,error_code,receipt_json FROM editorial_commissioning_runs ORDER BY started_at DESC LIMIT 10',
      )
      .all(),
  ]);
  return {
    enabled: env.EDITORIAL_ENABLED === 'true',
    autopublish: env.EDITORIAL_AUTOPUBLISH === 'true',
    cadence: { timezone: 'Asia/Shanghai', targetTopics: 3, languages: ['zh', 'en'], hours: [9, 15, 21] },
    topics: topics.results,
    runs: runs.results,
    observations: observations.results,
    commissioningRuns: commissioningRuns.results,
    state,
  };
}
