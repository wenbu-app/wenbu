import { describe, expect, it } from 'vitest';
import { readEditorialReview } from '../worker/editorial-review';

const review = {
  factual: false,
  bilingual: true,
  useful: false,
  original: true,
  natural: true,
  issues: ['The example mixes a tool response with a conversation stream.'],
  corrections: [
    {
      component: 'example.intro',
      defect: 'The two response channels have different terminal signals.',
      repair: 'Keep the example on one channel and use its documented signal.',
      sourceId: 'agents',
    },
  ],
};

describe('editorial review protocol validation', () => {
  it('keeps valid substantive rejection separate from protocol repair', () => {
    const result = readEditorialReview(review);
    expect(result.checked).toEqual(review);
    expect(result.protocolRepair).toBeNull();
  });

  it('retains negative judgments and feasible corrections when a locator exceeds the contract', () => {
    const raw = structuredClone(review);
    raw.corrections[0].component = 'example.intro / '.repeat(10);
    const result = readEditorialReview(raw);
    expect(result.checked.factual).toBe(false);
    expect(result.checked.issues[0]).toContain('corrections.0.component');
    expect(result.protocolRepair?.previousReview).toEqual(raw);
    expect(raw.corrections[0].component.length).toBeGreaterThan(100);
  });

  it('never approves malformed all-true responses or truncated JSON', () => {
    for (const raw of [
      null,
      { factual: true },
      { parseError: 'invalid_json_syntax' },
      {
        ...review,
        factual: true,
        useful: true,
        issues: [],
        corrections: [],
        unknownField: true,
      },
    ]) {
      const result = readEditorialReview(raw);
      expect(result.protocolRepair).not.toBeNull();
      expect(result.checked.issues.length).toBeGreaterThan(0);
      expect(Object.values(result.checked).slice(0, 5)).toEqual(Array(5).fill(false));
    }
  });

  it('bounds untrusted feedback at whole fields and does not mutate the archived response', () => {
    const raw = {
      ...review,
      issues: Array(80).fill('x'.repeat(5000)),
      corrections: Array(40).fill({
        component: 'c'.repeat(600),
        defect: 'd'.repeat(3000),
        repair: 'r'.repeat(3000),
        sourceId: 's'.repeat(300),
      }),
      privateExtra: 'ignored',
    };
    const result = readEditorialReview(raw);
    const feedback = result.protocolRepair!.previousReview;
    expect(JSON.parse(JSON.stringify(feedback))).toEqual(feedback);
    expect(feedback.issues as string[]).toHaveLength(30);
    expect(feedback.corrections as unknown[]).toHaveLength(10);
    expect(JSON.stringify(feedback).length).toBeLessThan(85000);
    expect(feedback).not.toHaveProperty('privateExtra');
    expect(raw.issues).toHaveLength(80);
  });
});
