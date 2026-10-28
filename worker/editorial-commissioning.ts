import { z } from 'zod';
import { articles } from '../src/data/articles';
import { comparisons } from '../src/data/comparisons';
import { editorialSources, type EditorialTopic } from '../src/data/editorial-topics';
import { pathForTopic, type EditorialDocument } from './editorial-schema';
import type { Env } from './types';
import { defaultSearchBrief } from '../src/data/editorial-demand';
import { knowledgeDocument, guideOutline } from '../src/lib/knowledge';

export const COMMISSIONING_POLICY = 4;
export const EDITORIAL_RESERVE_TARGET = 42;
export const COMMISSIONING_BATCH_SIZE = 24;

export function commissioningCoolingDown(
  lastPlanningAt: number | null,
  previousPolicy: number,
  ready: number,
  now: number,
  errorCode?: string | null,
) {
  const delay =
    errorCode === 'editorial_busy'
      ? 15 * 60_000
      : ready < EDITORIAL_RESERVE_TARGET
        ? 6 * 3600_000
        : 6 * 86400_000;
  return lastPlanningAt !== null && previousPolicy >= COMMISSIONING_POLICY && now - lastPlanningAt < delay;
}

// A book or calculation library is not a competing end-user product. Additional
// partners require an explicitly researched registry change, never model invention.
export const comparisonPartners: Record<string, { name: string; owner: string }> = {
  fatetell: { name: 'FateTell', owner: 'compare/fatetell' },
  fatetellCalculator: { name: 'FateTell', owner: 'compare/fatetell' },
  labyrinthos: { name: 'Labyrinthos', owner: 'compare/labyrinthos' },
  labyrinthosLearn: { name: 'Labyrinthos', owner: 'compare/labyrinthos' },
  chani: { name: 'CHANI', owner: 'compare/chani' },
  costar: { name: 'Co–Star', owner: 'compare/costar' },
  astro: { name: 'Astrodienst', owner: 'compare/astro-com' },
  cafe: { name: 'Cafe Astrology', owner: 'compare/cafe-astrology' },
  biddy: { name: 'Biddy Tarot', owner: 'compare/biddy-tarot' },
  trusted: { name: 'Trusted Tarot', owner: 'compare/trusted-tarot' },
  sage: { name: 'Sage', owner: 'compare/sage-tarot' },
  tarotjournal: { name: 'Tarot Journal', owner: 'compare/tarot-journal' },
  cardloom: { name: 'Cardloom', owner: 'compare/cardloom' },
  deeporacle: { name: 'Deep Oracle', owner: 'compare/deep-oracle' },
  tarotlearninglab: { name: 'Tarot Learning Lab', owner: 'compare/tarot-learning-lab' },
  learntarot: { name: 'Learning the Tarot', owner: 'compare/learning-the-tarot' },
};

export function sourceViable(topic: EditorialTopic, unavailable: Set<string>) {
  const usable = [...new Set(topic.sources)].filter((id) => editorialSources[id] && !unavailable.has(id));
  return (
    distinctEditorialSourceUrls(usable).size >= 2 &&
    (topic.category !== 'compare' ||
      usable.some((id) => comparisonPartners[id]?.owner === pathForTopic(topic)))
  );
}

export function distinctEditorialSourceUrls(ids: string[]) {
  return new Set(
    ids.flatMap((id) => {
      const source = editorialSources[id];
      if (!source) return [];
      const url = new URL(source.url);
      url.hash = '';
      return [url.href];
    }),
  );
}

export const candidateSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{2,65}$/),
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,65}$/),
    category: z.enum(['learn', 'compare']),
    mode: z.enum(['new', 'extend']),
    tool: z.enum(['bazi', 'iching', 'tarot', 'ziwei', 'agent', 'daily']),
    zh: z.string().min(8).max(100),
    en: z.string().min(15).max(150),
    task: z.string().min(40).max(800),
    unique: z.string().min(70).max(1200),
    sources: z
      .array(z.string())
      .min(2)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length, 'Source IDs must be distinct'),
    comparisonSourceId: z.string().nullable(),
    priority: z.number().int().min(40).max(85),
    search: z
      .object({
        pillar: z.string().min(3).max(80),
        intent: z.enum(['learn', 'solve', 'compare', 'use']),
        zh: z.array(z.string().min(2).max(100)).min(2).max(8),
        en: z.array(z.string().min(3).max(120)).min(2).max(8),
        basis: z.enum(['research_hypothesis', 'observed_query']),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CommissioningCandidate = z.infer<typeof candidateSchema>;

// A model can exceed its requested batch size without making every individual
// proposal invalid. Preserve valid work and keep only the critic's input bounded.
export function parseCommissioningProposals(raw: unknown) {
  const envelope = z
    .object({ topics: z.array(z.unknown()) })
    .strict()
    .safeParse(raw);
  if (!envelope.success)
    return {
      candidates: [] as CommissioningCandidate[],
      invalid: [{ id: 'envelope', reason: envelope.error.message }],
    };
  const candidates: CommissioningCandidate[] = [],
    invalid: { id: string; reason: string }[] = [],
    seen = new Set<string>();
  for (const [index, value] of envelope.data.topics.entries()) {
    const parsed = candidateSchema.safeParse(value);
    if (!parsed.success) {
      invalid.push({ id: `item-${index}`, reason: parsed.error.message });
      continue;
    }
    if (seen.has(parsed.data.id)) {
      invalid.push({ id: parsed.data.id, reason: 'duplicate_candidate_id' });
      continue;
    }
    seen.add(parsed.data.id);
    candidates.push(parsed.data);
  }
  return { candidates, invalid };
}

export function commissioningBatch(candidates: CommissioningCandidate[]) {
  return {
    batch: candidates.slice(0, COMMISSIONING_BATCH_SIZE),
    deferred: candidates.slice(COMMISSIONING_BATCH_SIZE),
  };
}

export function commissioningFeedback(evidence: Record<string, unknown>) {
  const rows = Array.isArray(evidence.rejectedCandidates)
    ? evidence.rejectedCandidates
    : Array.isArray(evidence.rejections)
      ? evidence.rejections
      : [];
  const reviews = Array.isArray(evidence.reviews) ? evidence.reviews : [];
  const accepted = Array.isArray(evidence.accepted) ? evidence.accepted : [];
  const seen = new Set<string>();
  return [...rows]
    .reverse()
    .flatMap((row) => {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof row.id !== 'string' ||
        typeof row.reason !== 'string' ||
        accepted.some((t) => t && typeof t === 'object' && t.id === row.id) ||
        seen.has(row.id)
      )
        return [];
      seen.add(row.id);
      const review = [...reviews].reverse().find((r) => r && typeof r === 'object' && r.id === row.id);
      const clip = (value: unknown, size: number) =>
        typeof value === 'string' ? value.slice(0, size) : undefined;
      return [
        {
          id: row.id.slice(0, 66),
          owner: clip(row.owner, 96),
          reason: row.reason.slice(0, 120),
          task: clip(row.task, 120),
          correction: clip(row.correction ?? review?.reason, 160),
        },
      ];
    })
    .slice(0, 8);
}

export const commissioningReviewSchema = z
  .object({
    reviews: z
      .array(
        z
          .object({
            id: z.string(),
            decision: z.enum(['new', 'merge', 'reject']),
            closestOwner: z.string(),
            sameReaderOutcome: z.boolean(),
            formatOnlyDifference: z.boolean(),
            requiresNewCanonical: z.boolean(),
            addsSubstantiveCoverage: z.boolean().optional(),
            existingOutcome: z.string().min(20).max(600),
            newOutcome: z.string().min(20).max(600),
            reason: z.string().min(30).max(900),
          })
          .strict(),
      )
      .max(COMMISSIONING_BATCH_SIZE),
  })
  .strict();
export type CommissioningReview = z.infer<typeof commissioningReviewSchema>['reviews'][number];

export function editorialOwners(
  queued: (EditorialTopic & { state?: string })[],
  published: EditorialDocument[] = [],
) {
  const owners = new Map<
    string,
    {
      path: string;
      title: string;
      description: string;
      headings: string[];
      coverage: string;
      plannedTasks: { task: string; unique: string; state?: string }[];
    }
  >();
  for (const a of articles)
    owners.set(`${a.category}/${a.slug}`, {
      path: `${a.category}/${a.slug}`,
      title: a.en.title,
      description: `${a.zh.description}\n${a.en.description}`,
      headings:
        a.category === 'learn'
          ? [...guideOutline(a, 'zh'), ...guideOutline(a, 'en')].map((s) => s.title)
          : [...a.zh.sections, ...a.en.sections].map((s) => s.heading),
      coverage: JSON.stringify(
        a.category === 'learn'
          ? { zh: knowledgeDocument(a, 'zh'), en: knowledgeDocument(a, 'en') }
          : { zh: a.zh.sections, en: a.en.sections },
      ),
      plannedTasks: [],
    });
  for (const c of comparisons)
    owners.set(`compare/${c.slug}`, {
      path: `compare/${c.slug}`,
      title: c.en.title,
      description: c.en.intro,
      headings: c.en.rows.map((row) => row[0]),
      coverage: JSON.stringify({ zh: c.zh, en: c.en }),
      plannedTasks: [],
    });
  for (const t of queued) {
    const path = pathForTopic(t),
      owner = owners.get(path) ?? {
        path,
        title: t.en,
        description: t.zh,
        headings: [],
        coverage: '',
        plannedTasks: [],
      };
    owner.plannedTasks.push({ task: t.task, unique: t.unique, state: t.state });
    owners.set(path, owner);
  }
  for (const doc of published) {
    const path = pathForTopic(doc.topic),
      owner = owners.get(path) ?? {
        path,
        title: doc.en.title,
        description: doc.zh.description,
        headings: [],
        coverage: '',
        plannedTasks: [],
      };
    owner.title = doc.en.title;
    owner.headings = [
      ...new Set([
        ...owner.headings,
        ...doc.zh.sections.map((s) => s.heading),
        ...doc.en.sections.map((s) => s.heading),
      ]),
    ];
    owner.coverage +=
      '\n' +
      JSON.stringify({
        revision: doc.revision,
        zh: doc.zh,
        en: doc.en,
        previousAdditions: doc.previousAdditions,
      });
    owners.set(path, owner);
  }
  return [...owners.values()];
}

export async function readEditorialOwners(env: Env) {
  const [topics, publications] = await Promise.all([
    env
      .ANALYTICS!.prepare('SELECT definition_json,status FROM editorial_topics')
      .all<{ definition_json: string; status: string }>(),
    env
      .ANALYTICS!.prepare('SELECT document_json FROM editorial_publications')
      .all<{ document_json: string }>(),
  ]);
  return editorialOwners(
    topics.results.map((r) => ({ ...(JSON.parse(r.definition_json) as EditorialTopic), state: r.status })),
    publications.results.map((r) => JSON.parse(r.document_json) as EditorialDocument),
  );
}

export function storedCommissioningPolicy(serialized?: string) {
  try {
    const value = serialized ? JSON.parse(serialized)?.policyVersion : undefined;
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

export function commissionCandidates(
  candidates: CommissioningCandidate[],
  reviews: CommissioningReview[],
  existing: (EditorialTopic & { state?: string })[],
  owners = editorialOwners(existing),
) {
  const candidateIds = new Set(candidates.map((t) => t.id));
  const reviewIds = new Set(reviews.map((r) => r.id));
  if (
    candidateIds.size !== candidates.length ||
    reviewIds.size !== reviews.length ||
    reviews.length !== candidates.length ||
    reviews.some((r) => !candidateIds.has(r.id))
  )
    throw new Error('editorial_commissioning_review_coverage');
  const ownerPaths = new Set(owners.map((o) => o.path));
  if (reviews.some((r) => !ownerPaths.has(r.closestOwner)))
    throw new Error('editorial_commissioning_unknown_owner');
  const keys = new Set([...ownerPaths, ...existing.map(pathForTopic)]),
    ids = new Set(existing.map((t) => t.id));
  const accepted: EditorialTopic[] = [],
    rejections: { id: string; reason: string; owner?: string; correction?: string }[] = [];
  for (const candidate of candidates) {
    const review = reviews.find((r) => r.id === candidate.id)!,
      path = pathForTopic(candidate);
    let reason = '';
    const merge =
      candidate.mode === 'extend' &&
      review.decision === 'merge' &&
      review.addsSubstantiveCoverage === true &&
      !review.formatOnlyDifference &&
      !review.requiresNewCanonical &&
      review.closestOwner === path &&
      !!owners.find((o) => o.path === path)?.coverage;
    const fresh =
      candidate.mode === 'new' &&
      review.decision === 'new' &&
      !review.sameReaderOutcome &&
      !review.formatOnlyDifference &&
      review.requiresNewCanonical;
    if (!merge && !fresh) reason = 'existing_intent_or_insufficient_novelty';
    else if (
      ids.has(candidate.id) ||
      (!merge && keys.has(path)) ||
      (merge &&
        (accepted.some((t) => pathForTopic(t) === path) ||
          existing.some((t) => pathForTopic(t) === path && (t.state ?? 'ready') === 'ready')))
    )
      reason = 'canonical_owner_exists';
    else if (candidate.sources.some((id) => !editorialSources[id])) reason = 'unknown_source';
    else if (distinctEditorialSourceUrls(candidate.sources).size < 2)
      reason = 'insufficient_distinct_sources';
    else if (candidate.category === 'learn' && candidate.slug.startsWith('compare-'))
      reason = 'comparison_category_mismatch';
    else if (candidate.category === 'compare') {
      const partner = candidate.comparisonSourceId && comparisonPartners[candidate.comparisonSourceId];
      if (!partner || !candidate.sources.includes(candidate.comparisonSourceId!))
        reason = 'named_vendor_source_required';
      else if (path !== partner.owner) reason = 'vendor_canonical_mismatch';
      else if (!candidate.en.toLowerCase().includes(partner.name.toLowerCase()))
        reason = 'named_product_title_required';
    } else if (candidate.comparisonSourceId !== null) reason = 'comparison_category_mismatch';
    if (reason) {
      const reservation = [...existing, ...accepted].find(
        (t) => pathForTopic(t) === path && (!('state' in t) || (t.state ?? 'ready') === 'ready'),
      );
      const correction =
        reason === 'canonical_owner_exists' && ids.has(candidate.id)
          ? 'This topic ID already exists. Keep its history; do not rename or enqueue the same task again.'
          : reason === 'canonical_owner_exists' && merge && reservation
            ? `This owner already has a ready reservation: ${reservation.task} Contribution: ${reservation.unique}. Choose an unreserved owner or wait for its actual result; an existing canonical page alone does not forbid a later substantive addition.`
            : reason === 'existing_intent_or_insufficient_novelty' &&
                candidate.mode === 'extend' &&
                !owners.find((o) => o.path === path)?.coverage &&
                reservation
              ? `This owner has only a ready reservation, not a published guide: ${reservation.task}. Do not describe planned coverage as already published or extend it before publication. Choose another supported unreserved task or wait for the actual result.`
              : reason === 'existing_intent_or_insufficient_novelty' &&
                  review.decision === 'merge' &&
                  review.addsSubstantiveCoverage === true &&
                  !review.formatOnlyDifference &&
                  !review.requiresNewCanonical &&
                  candidate.mode !== 'extend'
                ? `The critic selected merge on ${review.closestOwner}. A supported addition must use mode=extend and that exact existing owner; mode=new cannot be admitted as a merge.`
                : review.decision !== 'reject'
                  ? `The deterministic admission check rejected this candidate for ${reason}. Repair that source, category or ownership contract using the supplied registries before resubmitting; the critic's positive decision does not override this check.`
                  : undefined;
      rejections.push({
        id: candidate.id,
        reason,
        owner: review.closestOwner,
        ...(correction ? { correction } : {}),
      });
      continue;
    }
    const { comparisonSourceId: _, ...topic } = candidate;
    keys.add(path);
    ids.add(topic.id);
    accepted.push({
      ...topic,
      search: topic.search
        ? { ...topic.search, basis: 'research_hypothesis' }
        : defaultSearchBrief(topic.tool),
    });
  }
  return { accepted, rejections };
}
