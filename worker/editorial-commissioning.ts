import { z } from 'zod';
import { articles } from '../src/data/articles';
import { comparisons } from '../src/data/comparisons';
import { editorialSources, type EditorialTopic } from '../src/data/editorial-topics';
import { pathForTopic } from './editorial-schema';

export const COMMISSIONING_POLICY = 2;
export const EDITORIAL_RESERVE_TARGET = 42;

export function commissioningCoolingDown(
  lastPlanningAt: number | null,
  previousPolicy: number,
  ready: number,
  now: number,
) {
  const delay = ready < EDITORIAL_RESERVE_TARGET ? 86400_000 : 6 * 86400_000;
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
  learntarot: { name: 'Learning the Tarot', owner: 'compare/learning-the-tarot' },
};

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
    sources: z.array(z.string()).min(2).max(5),
    comparisonSourceId: z.string().nullable(),
    priority: z.number().int().min(40).max(85),
  })
  .strict();
export type CommissioningCandidate = z.infer<typeof candidateSchema>;

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
            existingOutcome: z.string().min(20).max(600),
            newOutcome: z.string().min(20).max(600),
            reason: z.string().min(30).max(900),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();
export type CommissioningReview = z.infer<typeof commissioningReviewSchema>['reviews'][number];

export function editorialOwners(queued: EditorialTopic[]) {
  const owners = new Map<
    string,
    {
      path: string;
      title: string;
      description: string;
      headings: string[];
      coverage: string;
      plannedTasks: { task: string; unique: string }[];
    }
  >();
  for (const a of articles)
    owners.set(`${a.category}/${a.slug}`, {
      path: `${a.category}/${a.slug}`,
      title: a.en.title,
      description: `${a.zh.description}\n${a.en.description}`,
      headings: [...a.zh.sections, ...a.en.sections].map((s) => s.heading),
      coverage: a.en.sections
        .map((s) => s.paragraphs[0] ?? '')
        .join('\n')
        .slice(0, 1800),
      plannedTasks: [],
    });
  for (const c of comparisons)
    owners.set(`compare/${c.slug}`, {
      path: `compare/${c.slug}`,
      title: c.en.title,
      description: c.en.intro,
      headings: c.en.rows.map((row) => row[0]),
      coverage: c.en.conclusion,
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
    owner.plannedTasks.push({ task: t.task, unique: t.unique });
    owners.set(path, owner);
  }
  return [...owners.values()];
}

export function commissionCandidates(
  candidates: CommissioningCandidate[],
  reviews: CommissioningReview[],
  existing: EditorialTopic[],
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
    rejections: { id: string; reason: string; owner?: string }[] = [];
  for (const candidate of candidates) {
    const review = reviews.find((r) => r.id === candidate.id)!,
      path = pathForTopic(candidate);
    let reason = '';
    if (
      review.decision !== 'new' ||
      review.sameReaderOutcome ||
      review.formatOnlyDifference ||
      !review.requiresNewCanonical
    )
      reason = 'existing_intent_or_insufficient_novelty';
    else if (candidate.mode !== 'new' || keys.has(path) || ids.has(candidate.id))
      reason = 'canonical_owner_exists';
    else if (candidate.sources.some((id) => !editorialSources[id])) reason = 'unknown_source';
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
      rejections.push({ id: candidate.id, reason, owner: review.closestOwner });
      continue;
    }
    const { comparisonSourceId: _, ...topic } = candidate;
    keys.add(path);
    ids.add(topic.id);
    accepted.push(topic);
  }
  return { accepted, rejections };
}
