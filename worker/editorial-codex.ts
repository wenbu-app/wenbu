import { z } from 'zod';
import { editorialSources } from '../src/data/editorial-topics';
import { ApiError } from './ai';
import { candidateSchema, comparisonPartners, distinctEditorialSourceUrls } from './editorial-commissioning';
import {
  editorialDirectory,
  editorialEvidenceReader,
  jsonBytes,
  readEditorialCatalog,
  relatedEditorialOwners,
} from './editorial-context';
import { codexEditorialActive, codexSlots, EDITORIAL_POLICY } from './editorial-policy';
import { readEditorialOwner, researchEditorial } from './editorial-research';
import {
  contentHash,
  draftIssues,
  editorialContentContract,
  editorialReviewSchema,
  editorialSchemaFor,
  pathForTopic,
  shanghaiDay,
  type EditorialDocument,
  type ResearchSource,
} from './editorial-schema';
import {
  failEditorial,
  publishedDocument,
  publishEditorial,
  releaseEditorial,
  renewEditorialLease,
} from './editorial-store';
import type { Env } from './types';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const topicSchema = candidateSchema.refine((topic) => topic.id.startsWith('codex-'));
const prepareSchema = z.object({ topic: topicSchema }).strict();
const auditNote = z.string().trim().min(18).max(1200);
const deliverSchema = z
  .object({
    packet: digest,
    draft: z.unknown(),
    review: editorialReviewSchema,
    draftHash: digest,
    audit: z
      .object({
        factual: auditNote,
        bilingual: auditNote,
        useful: auditNote,
        original: auditNote,
        natural: auditNote,
      })
      .strict(),
    publish: z.boolean().default(false),
  })
  .strict();

type Packet = {
  createdAt: number;
  topic: z.infer<typeof topicSchema>;
  expectedRevision: string | null;
  sources: ResearchSource[];
  reviewedOwners: { path: string; revision: string; coverage: string }[];
};

const packetKey = (id: string) => 'editorial/codex-packets/' + id + '.json';
const packetLifetime = 24 * 3600_000;
const error = (code: string, status = 409) => new ApiError(status, code, code);
const hash = (value: unknown) => contentHash(JSON.stringify(value));

function bindings(env: Env) {
  if (env.EDITORIAL_ENABLED !== 'true' || !env.ANALYTICS || !env.ANALYTICS_ARCHIVE)
    throw error('codex_editorial_unavailable', 503);
  return { db: env.ANALYTICS, archive: env.ANALYTICS_ARCHIVE };
}

export async function prepareCodexEditorial(env: Env, raw: unknown) {
  const { topic } = prepareSchema.parse(raw);
  const { archive } = bindings(env);
  if (
    topic.sources.some((id) => !editorialSources[id]) ||
    distinctEditorialSourceUrls(topic.sources).size < 2
  )
    throw error('codex_source_not_approved', 422);
  const path = pathForTopic(topic);
  if (
    topic.category === 'compare' &&
    (!topic.comparisonSourceId ||
      comparisonPartners[topic.comparisonSourceId]?.owner !== path ||
      !topic.sources.includes(topic.comparisonSourceId))
  )
    throw error('codex_vendor_owner_mismatch', 422);

  const catalog = await readEditorialCatalog(env);
  const owner = catalog.find((item) => item.path === path);
  if (topic.mode === 'new' ? owner !== undefined : !owner?.published) throw error('codex_canonical_conflict');
  const expectedRevision = owner?.revision ?? null;
  if ((await publishedDocument(env, path))?.revision !== (expectedRevision ?? undefined))
    throw error('codex_owner_changed');
  const sources = await researchEditorial(env, topic).catch(() => {
    throw error('codex_sources_unavailable', 422);
  });
  if (topic.mode === 'extend' && editorialContentContract(topic, sources).kind !== 'focused_addition')
    throw error('codex_original_incomplete', 422);

  const read = editorialEvidenceReader(env, catalog);
  const paths = [
    ...new Set([...(owner?.published ? [path] : []), ...relatedEditorialOwners(catalog, topic).slice(0, 3)]),
  ];
  const reviewedOwners: Packet['reviewedOwners'] = [];
  for (const item of paths) {
    const [original] = await read([item]);
    const evidence = { path: original.path, revision: original.revision, coverage: original.coverage };
    if (jsonBytes([...reviewedOwners, evidence]) <= 240_000) reviewedOwners.push(evidence);
    else if (item === path) throw error('codex_original_incomplete', 422);
  }
  const packet: Packet = { createdAt: Date.now(), topic, expectedRevision, sources, reviewedOwners };
  const id = await hash(packet);
  await archive.put(packetKey(id), JSON.stringify(packet));
  return {
    status: 'prepared',
    packet: id,
    expiresAt: packet.createdAt + packetLifetime,
    ...packet,
    directory: editorialDirectory(catalog),
    contract: editorialContentContract(topic, sources),
  };
}

function approved(review: z.infer<typeof editorialReviewSchema>) {
  return (
    review.factual &&
    review.bilingual &&
    review.useful &&
    review.original &&
    review.natural &&
    !review.issues.length &&
    !review.corrections?.length &&
    !review.needsOwners?.length
  );
}

export async function deliverCodexEditorial(env: Env, raw: unknown) {
  const input = deliverSchema.parse(raw);
  const { db, archive } = bindings(env);
  if (input.publish && (!codexEditorialActive(env) || env.EDITORIAL_AUTOPUBLISH !== 'true'))
    throw error('codex_publish_inactive');
  const object = await archive.get(packetKey(input.packet));
  if (!object) throw error('codex_packet_missing', 404);
  const packet = await object.json<Packet>();
  if ((await hash(packet)) !== input.packet) throw error('codex_packet_invalid');
  if (input.draft === undefined || (await hash(input.draft)) !== input.draftHash)
    throw error('codex_review_revision_mismatch', 422);
  if (!approved(input.review)) throw error('codex_review_blocked', 422);
  const { topic, sources, expectedRevision } = packet;
  const draft = editorialSchemaFor(topic, sources).parse(input.draft);
  const issues = draftIssues(draft, sources, topic);
  if (issues.length) throw new ApiError(422, 'codex_quality_gate', issues.join(', '));
  const path = pathForTopic(topic);
  const revision = await hash({ draft, topic, sources: sources.map((source) => source.hash) });
  const urls = [env.SITE_URL + '/' + path + '/', env.SITE_URL + '/en/' + path + '/'];
  const runId = 'editorial-codex-' + revision;
  const existing = await db
    .prepare('SELECT status FROM editorial_runs WHERE id=?')
    .bind(runId)
    .first<{ status: string }>();
  if (existing?.status === 'published' && input.publish)
    return { status: 'published', revision, urls, runId, replayed: true };
  if (packet.createdAt + packetLifetime < Date.now()) throw error('codex_packet_expired');
  const original = await publishedDocument(env, path);
  if ((original?.revision ?? null) !== expectedRevision) throw error('codex_owner_changed');
  const currentSources = await readEditorialOwner(env, topic).catch(() => {
    throw error('codex_original_unavailable', 422);
  });
  if (
    currentSources.some(
      (source) => !sources.some((before) => before.id === source.id && before.hash === source.hash),
    )
  )
    throw error('codex_owner_changed');
  if (!input.publish)
    return { status: 'validated', revision, urls, packet: input.packet, sourceCount: sources.length };

  try {
    await renewEditorialLease(env, runId);
  } catch {
    throw error('editorial_busy');
  }
  let inserted = false;
  try {
    const already = await db
      .prepare('SELECT status FROM editorial_runs WHERE id=?')
      .bind(runId)
      .first<{ status: string }>();
    if (already?.status === 'published')
      return { status: 'published', revision, urls, runId, replayed: true };
    if (already) throw error('codex_attempt_exists');
    const now = Date.now();
    const day = shanghaiDay(now);
    const used = (
      await db
        .prepare("SELECT slot FROM editorial_runs WHERE slot LIKE ? AND status NOT IN ('blocked')")
        .bind(day + '-codex-%')
        .all<{ slot: string }>()
    ).results;
    const hour = new Date(now + 8 * 3600_000).getUTCHours();
    const due = codexSlots(day).filter((item) => item.hour <= hour);
    const next = due.find(({ slot }) => !used.some((run) => run.slot === slot));
    if (!next)
      throw error(due.length === codexSlots(day).length ? 'codex_daily_target_reached' : 'codex_no_due_slot');
    const { slot } = next;
    const current = await db
      .prepare('SELECT revision,updated_at FROM editorial_publications WHERE path=?')
      .bind(path)
      .first<{ revision: string; updated_at: number }>();
    if ((current?.revision ?? null) !== expectedRevision) throw error('codex_owner_changed');
    if (current && current.updated_at > now - EDITORIAL_POLICY.ownerRefreshMs)
      throw error('codex_owner_cooldown');
    const topicRow = await db
      .prepare('SELECT definition_json,status FROM editorial_topics WHERE id=?')
      .bind(topic.id)
      .first<{ definition_json: string; status: string }>();
    if (topicRow && (topicRow.status !== 'ready' || topicRow.definition_json !== JSON.stringify(topic)))
      throw error('codex_topic_conflict');

    const timestamp = new Date(now).toISOString();
    const doc: EditorialDocument = {
      ...draft,
      topic: original ? { ...topic, id: original.topic.id, mode: original.topic.mode } : topic,
      sources: sources.map(({ excerpt: _, ...source }) => source),
      publishedAt: original?.publishedAt ?? timestamp,
      updatedAt: timestamp,
      revision,
      review: input.review,
      reviewOrigin: 'codex',
      ...(original
        ? {
            previousAdditions: [
              ...(original.previousAdditions ?? []),
              {
                zh: original.zh,
                en: original.en,
                topic: original.topic,
                revision: original.revision,
                updatedAt: original.updatedAt,
                sources: original.sources,
              },
            ],
          }
        : {}),
    };
    const draftKey = 'editorial/' + runId + '/codex-draft.json';
    const reviewKey = 'editorial/' + runId + '/codex-review.json';
    await Promise.all([
      archive.put(draftKey, JSON.stringify(draft)),
      archive.put(
        reviewKey,
        JSON.stringify({
          packet: input.packet,
          draftHash: input.draftHash,
          review: input.review,
          audit: input.audit,
        }),
      ),
    ]);
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO editorial_topics(id,slug,category,definition_json,priority,created_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(topic.id, topic.slug, topic.category, JSON.stringify(topic), topic.priority, now),
      db
        .prepare(
          "INSERT INTO editorial_runs(id,slot,topic_id,status,created_at,updated_at,research_key,draft_key,review_key) VALUES(?,?,?,'reviewing',?,?,?,?,?)",
        )
        .bind(runId, slot, topic.id, now, now, packetKey(input.packet), draftKey, reviewKey),
    ]);
    inserted = true;
    const receipt = await publishEditorial(env, runId, doc, expectedRevision);
    return { status: 'published', ...receipt, runId, slot, replayed: false };
  } catch (cause) {
    if (inserted) await failEditorial(env, runId, 'codex_publication_failed');
    throw cause;
  } finally {
    await releaseEditorial(env, runId);
  }
}
