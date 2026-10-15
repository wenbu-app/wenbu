import type { AnalyticsReport } from '../lib/analytics-report';
import { useInsightsLocale } from '../lib/insights-locale';

export default function DailyInsights({ report }: { report: AnalyticsReport }) {
  const { locale, reportLabel } = useInsightsLocale();
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const daily = report.data.daily_usage?.[0] || {};
  const format = (value: unknown) =>
    new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-GB').format(Number(value) || 0);
  return (
    <section className="insights-card daily-insights" aria-labelledby="daily-insights-title">
      <h2 id="daily-insights-title">{t('日签 · 使用与回访', 'Daily card · usage and return visits')}</h2>
      <p>
        {t(
          '沿用上方日期、时区和筛选条件。跨日回访指范围内至少两个报表日期查看过日签的浏览器标识，不是 D1 / D7 队列留存。',
          'Uses the date range, timezone and filters above. Repeat visitors viewed a card on at least two report dates in this range. This is not D1 or D7 cohort retention.',
        )}
      </p>
      <div className="insights-metrics">
        {[
          [t('查看日签的浏览器标识', 'Browsers viewing a daily card'), daily.visitors],
          [t('跨日报表日期回访的标识', 'Browsers returning on another date'), daily.repeat_visitors],
          [t('去重浏览器与日期组合', 'Distinct browser-date pairs'), daily.visitor_days],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{String(label)}</span>
            <strong>{format(value)}</strong>
          </div>
        ))}
      </div>
      <div className="insights-table">
        <table>
          <thead>
            <tr>
              <th>{t('操作', 'Event')}</th>
              <th>{t('次数', 'Events')}</th>
              <th>{t('浏览器标识', 'Browser IDs')}</th>
            </tr>
          </thead>
          <tbody>
            {(report.data.daily_events || []).map((row) => (
              <tr key={String(row.label)}>
                <th>{reportLabel(String(row.label))}</th>
                <td>{format(row.count)}</td>
                <td>{format(row.visitors)}</td>
              </tr>
            ))}
            {!report.data.daily_events?.length && (
              <tr>
                <td colSpan={3}>
                  {t('当前范围还没有日签事件。', 'No daily card events in this range yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p>
        {t(
          '服务成功响应、结果可见、浏览器笔记保存、账号保存邀请和继续对话分别统计。保存笔记不代表云端保存成功；实际账号保存与注册看账号分析。可见事件需日签进入可视区域且前台停留 1 秒。此处不采集笔记内容。',
          'Server responses, visible results, browser note saves, account-save invitations and Agent handoffs are separate. A note save does not prove cloud persistence; use account analytics for actual account saves and registration. View events require the card to be visible in the foreground for one second. Notes are never collected here.',
        )}
      </p>
    </section>
  );
}
