import { createContext, useCallback, useContext, useMemo } from 'react';
import type { Locale } from './schema';
import { insightsEnglish } from './insights-en';
import { reportLabels as labels, reportMetrics as metrics } from './analytics-report';
import { metricDefinitions as definitions } from './measurement-contract';

export const InsightsLocale = createContext<Locale>('zh');
export function translateInsight(locale: Locale, value: string, ...parameters: (string | number)[]) {
  const translated = locale === 'en' ? (insightsEnglish[value] ?? value) : value;
  return translated.replace(/\{(\d+)\}/g, (match, index: string) =>
    String(parameters[Number(index)] ?? match),
  );
}
export function useInsightsLocale() {
  const locale = useContext(InsightsLocale);
  const t = useCallback(
    (value: string, ...parameters: (string | number)[]) => translateInsight(locale, value, ...parameters),
    [locale],
  );
  return useMemo(
    () => ({
      locale,
      t,
      reportLabels: Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, t(value)])),
      reportLabel: (value: string) => t(labels[value] ?? value),
      reportMetrics: metrics.map((metric) => ({ ...metric, label: t(metric.label) })),
      metricDefinitions: Object.fromEntries(
        Object.entries(definitions).map(([key, value]) => [
          key,
          { ...value, unit: t(value.unit), definition: t(value.definition) },
        ]),
      ) as typeof definitions,
      formatReportTime: (time: number, timeZone: string, detail = false) =>
        new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', {
          timeZone,
          month: '2-digit',
          day: '2-digit',
          ...(detail ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
        }).format(time),
    }),
    [locale, t],
  );
}
