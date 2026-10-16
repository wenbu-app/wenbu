import { describe, it, expect } from 'vitest';
import {
  candidateSchema,
  commissioningCoolingDown,
  commissioningReviewSchema,
  commissionCandidates,
  editorialOwners,
  type CommissioningCandidate,
  type CommissioningReview,
} from '../worker/editorial-commissioning';
import { editorialTopics } from '../src/data/editorial-topics';

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
  it('spaces depleted-reserve retries without suppressing the next weekly review', () => {
    const now = Date.parse('2026-10-18T02:30:00Z');
    expect(commissioningCoolingDown(now - 12 * 3600_000, 2, 35, now)).toBe(true);
    expect(commissioningCoolingDown(now - 48 * 3600_000, 2, 35, now)).toBe(false);
    expect(commissioningCoolingDown(now - 48 * 3600_000, 2, 50, now)).toBe(true);
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
