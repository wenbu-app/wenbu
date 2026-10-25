import { describe, it, expect } from 'vitest';
import {
  candidateSchema,
  parseCommissioningProposals,
  commissioningBatch,
  commissioningFeedback,
  distinctEditorialSourceUrls,
  sourceViable,
  COMMISSIONING_POLICY,
  commissioningCoolingDown,
  storedCommissioningPolicy,
  commissioningReviewSchema,
  commissionCandidates,
  editorialOwners,
  type CommissioningCandidate,
  type CommissioningReview,
} from '../worker/editorial-commissioning';
import { editorialTopics, editorialSources } from '../src/data/editorial-topics';
import { fixtureDraft } from './helpers/editorial-fixture';

const candidate = (overrides: Partial<CommissioningCandidate> = {}): CommissioningCandidate => ({
  id: 'api-result-integrity',
  slug: 'api-result-integrity',
  category: 'learn',
  mode: 'new',
  tool: 'agent',
  zh: '核对结构化接口结果中的版本与完整性',
  en: 'Audit the version and integrity of a structured API result',
  task: 'Verify that a stored structured result has the same version, fields and content as its exported record.',
  unique:
    'A concrete field-by-field integrity audit with a deliberately mismatched version and a documented resolution, rather than a prose reading exercise.',
  sources: ['agents', 'methods'],
  comparisonSourceId: null,
  priority: 60,
  ...overrides,
});
const review = (overrides: Partial<CommissioningReview> = {}): CommissioningReview => ({
  id: 'api-result-integrity',
  decision: 'new',
  closestOwner: 'learn/read-ai-with-sources',
  sameReaderOutcome: false,
  formatOnlyDifference: false,
  requiresNewCanonical: true,
  existingOutcome: 'Check whether a cited passage supports an interpretive claim.',
  newOutcome: 'Detect a serialization/version mismatch independently of an interpretive claim.',
  reason:
    'This audits the transport representation and version contract; the closest guide audits source support for prose. They require different inputs and produce different outcomes.',
  ...overrides,
});

describe('editorial canonical commissioning', () => {
  it('requires distinct registered source documents at schema, stock and admission boundaries', () => {
    const topic = candidate({ sources: ['methods', 'methods'] });
    expect(candidateSchema.safeParse(topic).success).toBe(false);
    expect(sourceViable(topic, new Set())).toBe(false);
    expect(commissionCandidates([topic], [review()], editorialTopics).rejections[0].reason).toBe(
      'insufficient_distinct_sources',
    );
    editorialSources.syntheticAlias = {
      ...editorialSources.methods,
      url: editorialSources.methods.url + '#alias',
    };
    try {
      expect(distinctEditorialSourceUrls(['methods', 'syntheticAlias']).size).toBe(1);
      expect(sourceViable(candidate({ sources: ['methods', 'syntheticAlias'] }), new Set())).toBe(false);
    } finally {
      delete editorialSources.syntheticAlias;
    }
  });
  it('retains the latest unresolved version once per topic rather than recycling older critique', () => {
    const evidence = {
      rejectedCandidates: [
        { id: 'same-topic', reason: 'old scope', task: 'old task', correction: 'old repair' },
        { id: 'same-topic', reason: 'new scope', task: 'new task', correction: 'new repair' },
      ],
    };
    expect(commissioningFeedback(evidence)).toEqual([
      { id: 'same-topic', owner: undefined, reason: 'new scope', task: 'new task', correction: 'new repair' },
    ]);
    expect(
      commissioningFeedback({
        rejections: [{ id: 'topic', reason: 'retained rejection' }],
        reviews: [
          { id: 'topic', reason: 'old review' },
          { id: 'topic', reason: 'new review' },
        ],
      })[0].correction,
    ).toBe('new review');
  });
  it('carries real rejection corrections into the next planning pass, including legacy receipts', () => {
    const evidence = {
      rejections: [
        null,
        {
          id: 'rejected-topic',
          reason: 'existing_intent_or_insufficient_novelty',
          owner: 'learn/read-ai-with-sources',
        },
      ],
      reviews: [
        {
          id: 'rejected-topic',
          reason:
            'The existing page already includes this exact passage-to-claim example; find a different unresolved task.',
        },
      ],
    };
    const feedback = commissioningFeedback(evidence);
    expect(feedback).toHaveLength(1);
    expect(feedback[0].correction).toContain('already includes this exact');
    expect(feedback[0].owner).toBe('learn/read-ai-with-sources');
    expect(commissioningFeedback({ ...evidence, accepted: [{ id: 'rejected-topic' }] })).toEqual([]);
    expect(
      commissioningFeedback({
        rejectedCandidates: [{ ...feedback[0], task: 'An actual retained reader task.' }],
      })[0].task,
    ).toBe('An actual retained reader task.');
    expect(commissioningFeedback({ rejections: [null, 'bad', { id: 'no-reason' }] })).toEqual([]);
  });
  it('bounds rejection feedback without relabelling a rejection as an accepted task', () => {
    const row = {
      id: 'x'.repeat(100),
      owner: 'x'.repeat(200),
      reason: 'x'.repeat(900),
      task: 'x'.repeat(800),
      correction: 'x'.repeat(900),
    };
    const feedback = commissioningFeedback({
      rejectedCandidates: Array.from({ length: 30 }, (_, i) => ({ ...row, id: String(i) + row.id })),
    });
    expect(feedback).toHaveLength(8);
    expect(JSON.stringify(feedback).length).toBeLessThan(5500);
    expect(feedback[0]).not.toHaveProperty('accepted');
  });
  it.each([28, 26])('retains every valid proposal when the model returns %i items', (count) => {
    const topics = Array.from({ length: count }, (_, i) => candidate({ id: `candidate-${i}` }));
    const parsed = parseCommissioningProposals({ topics });
    expect(parsed.invalid).toEqual([]);
    const { batch, deferred } = commissioningBatch(parsed.candidates);
    expect(batch).toHaveLength(24);
    expect(deferred).toHaveLength(count - 24);
    expect([...batch, ...deferred]).toEqual(topics);
  });
  it('isolates invalid and duplicate items without discarding valid neighbors', () => {
    const good = candidate();
    const result = parseCommissioningProposals({ topics: [{ ...good, priority: 'bad' }, good, good] });
    expect(result.candidates).toEqual([good]);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[1].reason).toBe('duplicate_candidate_id');
    expect(parseCommissioningProposals({ unrelated: [] }).candidates).toEqual([]);
  });
  it('labels a retained reservation without presenting it as a published page', () => {
    const t = { ...candidate(), state: 'quarantined' };
    expect(
      editorialOwners([t]).find((o) => o.path === 'learn/api-result-integrity')!.plannedTasks[0].state,
    ).toBe('quarantined');
  });
  it('does not let a malformed legacy observation brick commissioning', () => {
    for (const raw of ['null', '{invalid', '[]', '{"policyVersion":"2"}', '{"policyVersion":-1}'])
      expect(storedCommissioningPolicy(raw)).toBe(1);
    expect(storedCommissioningPolicy('{"policyVersion":2}')).toBe(2);
  });
  it('includes late paragraphs and worked practice from a dynamically published edition', () => {
    const draft = fixtureDraft();
    draft.en.sections[3].paragraphs[1] += ' Distinct late-paragraph coverage sentinel.';
    draft.zh.example.steps.push('动态正文中的独有练习步骤。');
    const doc = {
      ...draft,
      topic: editorialTopics.find((t) => t.id === 'daily-reflection')!,
      revision: 'coverage-test',
      publishedAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      sources: [],
      review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
    };
    const owner = editorialOwners(editorialTopics, [doc]).find(
      (o) => o.path === 'learn/daily-card-reflection',
    )!;
    expect(owner.coverage).toContain('Distinct late-paragraph coverage sentinel');
    expect(owner.coverage).toContain('动态正文中的独有练习步骤');
    expect(owner.headings).toContain(draft.en.sections[3].heading);
  });
  it('spaces depleted-reserve retries without suppressing the next weekly review', () => {
    const now = Date.parse('2026-10-18T02:30:00Z');
    expect(commissioningCoolingDown(now - 3 * 3600_000, COMMISSIONING_POLICY, 35, now)).toBe(true);
    expect(commissioningCoolingDown(now - 48 * 3600_000, COMMISSIONING_POLICY, 35, now)).toBe(false);
    expect(commissioningCoolingDown(now - 48 * 3600_000, COMMISSIONING_POLICY, 50, now)).toBe(true);
    expect(commissioningCoolingDown(now - 3600_000, 1, 35, now)).toBe(false);
  });
  it('provides section coverage and queued outcomes, including comparison owners', () => {
    const owners = editorialOwners(editorialTopics);
    const coins = owners.find((o) => o.path === 'learn/iching-three-coins')!;
    expect(coins.headings.length).toBeGreaterThan(2);
    expect(coins.coverage.length).toBeGreaterThan(100);
    expect(coins.plannedTasks.some((t) => t.task.includes('line-order'))).toBe(true);
    expect(owners.find((o) => o.path === 'compare/fatetell')!.coverage).toBeTruthy();
  });
  it('admits a supported new outcome and strips commissioning-only fields', () => {
    const result = commissionCandidates([candidate()], [review()], editorialTopics);
    expect(result.accepted.map((t) => t.id)).toEqual(['api-result-integrity']);
    expect(result.accepted[0]).not.toHaveProperty('comparisonSourceId');
  });
  it('admits a substantial update on its real owner without admitting a format-only duplicate', () => {
    const t = candidate({ id: 'sourced-claim-scope-gap', slug: 'read-ai-with-sources', mode: 'extend' });
    const r = review({
      id: t.id,
      decision: 'merge',
      closestOwner: 'learn/read-ai-with-sources',
      sameReaderOutcome: true,
      requiresNewCanonical: false,
      addsSubstantiveCoverage: true,
      reason:
        'The page explains citations but lacks a worked passage-to-claim scope mismatch. Add that supported counterexample on this owner.',
    });
    const existing = editorialTopics.map((topic) => ({ ...topic, state: 'published' }));
    const result = commissionCandidates([t], [r], existing);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].mode).toBe('extend');
    expect(result.accepted[0].search?.basis).toBe('research_hypothesis');
    expect(commissionCandidates([t], [{ ...r, formatOnlyDifference: true }], existing).accepted).toEqual([]);
    expect(commissionCandidates([t], [{ ...r, addsSubstantiveCoverage: false }], existing).accepted).toEqual(
      [],
    );
    expect(
      commissionCandidates([t], [r], [...existing, { ...t, id: 'active-reservation', state: 'ready' }])
        .accepted,
    ).toEqual([]);
  });
  it.each([
    { decision: 'merge' as const },
    { sameReaderOutcome: true },
    { formatOnlyDifference: true },
    { requiresNewCanonical: false },
  ])('does not enqueue an overlapping or format-only outcome: %j', (flags) => {
    expect(commissionCandidates([candidate()], [review(flags)], editorialTopics).accepted).toEqual([]);
  });
  it('fails closed on missing, duplicate, unrequested and unknown-owner reviews', () => {
    for (const reviews of [
      [],
      [review(), review()],
      [review({ id: 'invented-id' })],
      [review({ closestOwner: 'learn/nonexistent-owner' })],
    ]) {
      expect(() => commissionCandidates([candidate()], reviews, editorialTopics)).toThrow();
    }
  });
  it('rejects the legacy accept-ID review protocol', () => {
    expect(
      commissioningReviewSchema.safeParse({ acceptedIds: ['api-result-integrity'], rejections: [] }).success,
    ).toBe(false);
  });
  it('requires an explicit comparison target in the candidate schema', () => {
    const { comparisonSourceId: _, ...legacy } = candidate();
    expect(candidateSchema.safeParse(legacy).success).toBe(false);
  });
  it('does not mistake a historical book or engine library for a vendor app', () => {
    for (const id of ['waite', 'iztro', null]) {
      const t = candidate({ category: 'compare', comparisonSourceId: id, sources: ['wenbu', id ?? 'iztro'] });
      expect(commissionCandidates([t], [review()], editorialTopics).rejections[0].reason).toBe(
        'named_vendor_source_required',
      );
    }
  });
  it('binds vendor aliases and secondary sources to the existing canonical owner', () => {
    const t = candidate({
      category: 'compare',
      slug: 'standalone-bazi-calculator',
      en: 'Wenbu vs FateTell standalone calculators',
      comparisonSourceId: 'fatetellCalculator',
      sources: ['wenbu', 'fatetellCalculator'],
    });
    expect(commissionCandidates([t], [review()], editorialTopics).rejections[0].reason).toBe(
      'vendor_canonical_mismatch',
    );
    const owned = candidate({
      category: 'compare',
      slug: 'fatetell',
      comparisonSourceId: 'fatetell',
      sources: ['wenbu', 'fatetell'],
    });
    expect(commissionCandidates([owned], [review()], editorialTopics).accepted).toEqual([]);
  });
  it('does not silently give a quarantined proposal a new ID at the same path', () => {
    const existing = [...editorialTopics, candidate({ id: 'quarantined-old-id' })];
    expect(
      commissionCandidates([candidate()], [review()], existing, editorialOwners(editorialTopics)).accepted,
    ).toEqual([]);
  });
  it('reserves canonical paths across the same accepted batch', () => {
    const second = candidate({ id: 'different-id' });
    const result = commissionCandidates(
      [candidate(), second],
      [review(), review({ id: second.id })],
      editorialTopics,
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.rejections[0].reason).toBe('canonical_owner_exists');
  });
});
