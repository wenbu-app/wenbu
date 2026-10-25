import { describe, expect, it } from 'vitest';
import { editorialSignalSummary } from '../worker/editorial-signals';

describe('bounded editorial evidence projection', () => {
  it('preserves valid JSON, exact source URLs and evidence windows under a large signal set', () => {
    const url = 'https://wenbu.app/learn/tarot-basics/?source=' + 'a'.repeat(900);
    const row = {
      query: 'reader question '.repeat(80),
      start: '2026-09-27',
      end: '2026-10-24',
      impressions: 7,
      url,
    };
    const evidence = {
      sourceUrls: [url],
      queries: Array.from({ length: 30 }, () => row),
      topPages: Array.from({ length: 30 }, () => row),
      decisions: Array.from({ length: 20 }, () => ({ reason: 'grounded reason '.repeat(100) })),
    };
    const original = JSON.stringify(evidence);
    expect(() => JSON.parse(original.slice(0, 6000))).toThrow();
    const result = editorialSignalSummary('search_console', evidence);
    expect(result.length).toBeLessThanOrEqual(6000);
    const parsed = JSON.parse(result);
    expect(parsed.sourceUrls).toEqual([url]);
    expect(parsed.queries[0].start).toBe(row.start);
    expect(parsed.queries[0].end).toBe(row.end);
    expect(parsed.queries[0].url).toBe(url);
    expect(JSON.stringify(evidence)).toBe(original);
  });
  it('reduces whole oversized fields rather than cutting a URL or fabricating an empty observation', () => {
    const url = 'https://wenbu.app/' + 'x'.repeat(1900);
    const result = editorialSignalSummary('search_console', {
      sourceUrls: [url],
      queries: [{ url, text: 'a'.repeat(2000) }],
      topPages: [{ url, text: 'b'.repeat(2000) }],
      operationalTasks: { url, task: 'c'.repeat(2000) },
    });
    expect(result.length).toBeLessThanOrEqual(6000);
    expect(JSON.parse(result).sourceUrls).toEqual([url]);
    expect(JSON.parse(result).projection.fullEvidenceRetained).toBe(true);
    expect(JSON.parse(result).projection.omittedFields.length).toBeGreaterThan(0);
    expect(
      JSON.parse(editorialSignalSummary('topic_planning', { rejections: null })).rejectedCandidates,
    ).toEqual([]);
  });
});
