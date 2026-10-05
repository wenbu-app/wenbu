import { describe, expect, it } from 'vitest';
import { translateInsight } from '../src/lib/insights-locale';
import { reportLabels, reportMetrics } from '../src/lib/analytics-report';
import { metricDefinitions } from '../src/lib/measurement-contract';

describe('Insights language and measurement semantics', () => {
  it('provides English for all metric labels, definitions and filter labels', () => {
    const strings = [
      ...Object.values(reportLabels),
      ...reportMetrics.map((m) => m.label),
      ...Object.values(metricDefinitions).flatMap((m) => [m.unit, m.definition]),
    ];
    for (const text of strings) expect(translateInsight('en', text), text).not.toMatch(/[\u3400-\u9fff]/);
  });
  it('preserves source text, identifiers and interpolated values', () => {
    expect(translateInsight('zh', '最近 {0} 天', 7)).toBe('最近 7 天');
    expect(translateInsight('en', '最近 {0} 天', 7)).toBe('Last 7 days');
    expect(translateInsight('en', '/en/learn/')).toBe('/en/learn/');
  });
});
