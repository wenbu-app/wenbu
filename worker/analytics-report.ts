import {
  browserAudienceSQL,
  browserViewSQL,
  contentRequestSQL,
  serviceRequestSQL,
} from '../src/lib/traffic-contract';
import type { Env } from './types';
import { ApiError } from './ai';
import {
  defaultReportFilters,
  reportDimensions,
  reportMetrics,
  dateInTimezone,
  type AnalyticsReport,
  type ReportFilters,
  type ReportRow,
  type TrendPoint,
} from '../src/lib/analytics-report';

import { reportRange } from './report-range';
import {
  measurementVersion,
  metricDefinitions,
  audiences,
  audienceSQL,
  activeBrowserSQL,
  productSuccessSQL,
  serviceFailureSQL,
} from '../src/lib/measurement-contract';

const DAY = 86400000;
function invalid(message: string): never {
  throw new ApiError(400, 'invalid_filter', message);
}
export async function analyticsReport(url: URL, env: Env): Promise<AnalyticsReport> {
  if (!env.ANALYTICS) throw new ApiError(503, 'analytics_unavailable', 'Storage is unavailable.');
  const params = url.searchParams;
  const asOf = Date.now();
  const { timezone, offset, days, custom, end, since, grain, granularity, step } = reportRange(params, asOf);
  if (params.get('test') && !['true', 'false'].includes(params.get('test')!)) invalid('Invalid test filter.');
  const includeTest = params.get('test') === 'true';
  const applied: ReportFilters = {
    ...defaultReportFilters,
    days: String(days),
    timezone,
    granularity: grain,
    test: String(includeTest),
  };
  if (custom) {
    applied.start = params.get('start')!;
    applied.end = params.get('end')!;
  }
  let where = 'occurred_at >= ? AND occurred_at < ? AND received_at <= ? AND (? = 1 OR is_test = 0)';
  const values: (string | number)[] = [since, Math.min(end, asOf + 1), asOf, Number(includeTest)];
  for (const [key, allowed] of Object.entries(reportDimensions)) {
    const value = params.get(key);
    if (!value) continue;
    if (!allowed.includes(value)) invalid('Invalid ' + key + ' filter.');
    where += ` AND ${key} = ?`;
    values.push(value);
    applied[key as keyof ReportFilters] = value;
  }
  const audience = params.get('audience') || 'all';
  if (!(audiences as readonly string[]).includes(audience)) invalid('Invalid audience filter.');
  applied.audience = audience;
  where += ' AND (' + audienceSQL[audience as keyof typeof audienceSQL] + ')';
  const country = params.get('country') || '';
  if (country) {
    if (!/^[A-Z]{2}$/.test(country)) invalid('Country must use a two-letter code.');
    where += ' AND country = ?';
    values.push(country);
    applied.country = country;
  }
  const query = (sql: string) => env.ANALYTICS!.prepare(sql.replaceAll('$WHERE', where)).bind(...values);
  const queries: [string, string][] = [
    [
      'summary',
      `SELECT COUNT(*) events,
      SUM(${contentRequestSQL}) content_requests,
      SUM(${contentRequestSQL} AND actor_type='search_crawler') search_requests,
      SUM(${contentRequestSQL} AND actor_type IN ('ai_crawler','ai_agent')) ai_requests,
      SUM(${serviceRequestSQL}) service_requests,
      SUM(event='page_request' AND http_method='HEAD') head_requests,
      SUM(event='page_request' AND http_status>=400) content_errors,
      SUM(classification_version>0) classified_events, SUM(classification_version=0) legacy_events,
      SUM(event='page_view' AND NOT ${browserAudienceSQL}) excluded_views,
      SUM(${contentRequestSQL} AND actor_type='unknown') unclassified_requests,
      SUM(${contentRequestSQL} AND bot_verified=1) verified_requests,
      SUM(${contentRequestSQL} AND signed_agent=1) signed_requests,
      COUNT(DISTINCT CASE WHEN ${activeBrowserSQL} THEN visitor_id END) active_visitors, COUNT(DISTINCT CASE WHEN ${activeBrowserSQL} THEN session_id END) active_sessions, SUM(${browserViewSQL}) pageviews, COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN session_id END) sessions, COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN visitor_id END) visitors, COUNT(DISTINCT CASE WHEN (event='engaged' AND ${browserAudienceSQL}) THEN session_id END) engaged_sessions, SUM(event='calculation_succeeded' AND action!='example') calculations, SUM(event='calculation_succeeded' AND action='example') examples, SUM(event='interpret_succeeded') interpretations, SUM(event='agent_finished' AND status='complete') agent_complete, SUM(event='agent_finished' AND status='waiting') agent_waiting, SUM(event='agent_finished' AND status='limited') agent_limited, SUM(${serviceFailureSQL}) failures, SUM(${serviceRequestSQL} AND status='invalid_input') invalid_inputs, SUM(${serviceRequestSQL} AND status='rate_limited') throttled, SUM(event='agent_finished' AND status='cancelled') cancellations, SUM(model_calls) model_calls, SUM(tool_calls) tool_calls, MAX(occurred_at) last_event FROM events WHERE $WHERE`,
    ],
    [
      'quality',
      `SELECT SUM(origin='client') client_events, SUM(origin='server') server_events, SUM(origin='edge') edge_events, SUM(origin='client' AND client_at IS NOT NULL AND client_at!=occurred_at) adjusted_timestamps, SUM(origin='client' AND received_at-occurred_at>300000) delayed_events, SUM(origin='client' AND (session_id IS NULL OR visitor_id IS NULL)) unlinked_client_events, SUM(${productSuccessSQL} AND (session_id IS NULL OR visitor_id IS NULL)) unlinked_successes, SUM(event='telemetry_gap') gap_reports, SUM(CASE WHEN event='telemetry_gap' THEN value ELSE 0 END) reported_dropped_events, MIN(occurred_at) first_event, MAX(received_at) last_received FROM events WHERE $WHERE`,
    ],
    [
      'daily',
      `SELECT strftime('%Y-%m-%d', (occurred_at + ${offset})/1000, 'unixepoch') label, SUM(${browserViewSQL}) views, COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN session_id END) sessions, SUM(event='calculation_succeeded' AND action!='example') calculations, SUM(event='calculation_succeeded' AND action='example') examples, SUM(event='agent_finished' AND status='complete') agent FROM events WHERE $WHERE GROUP BY label ORDER BY label`,
    ],
    [
      'events',
      `SELECT event label, origin, status, COUNT(*) count, COUNT(DISTINCT session_id) sessions FROM events WHERE $WHERE GROUP BY event,origin,status ORDER BY count DESC`,
    ],
    [
      'performance',
      `SELECT tool label, status, COUNT(*) count, ROUND(AVG(duration_ms)) average_ms, MAX(duration_ms) max_ms FROM events WHERE $WHERE AND origin='server' AND ${serviceRequestSQL} GROUP BY tool,status ORDER BY count DESC`,
    ],
    [
      'funnel',
      `WITH steps AS (SELECT session_id, MIN(CASE WHEN ${browserViewSQL} THEN occurred_at END) visit, MIN(CASE WHEN (event='agent_started' OR (event='tool_started' AND action!='example')) THEN occurred_at END) start, MIN(CASE WHEN (event IN ('calculation_succeeded','interpret_succeeded') AND action!='example') OR (event='agent_finished' AND status='complete') THEN occurred_at END) success, MAX(CASE WHEN event='journal_saved' THEN occurred_at END) saved FROM events WHERE $WHERE AND session_id IS NOT NULL AND ${browserAudienceSQL} GROUP BY session_id) SELECT COUNT(visit) visited, SUM(visit IS NOT NULL AND start IS NOT NULL) started, SUM(visit IS NOT NULL AND start IS NOT NULL AND success IS NOT NULL) succeeded, SUM(visit IS NOT NULL AND start IS NOT NULL AND success IS NOT NULL AND saved IS NOT NULL) saved FROM steps`,
    ],
    [
      'guidance',
      `SELECT CASE WHEN event='guide_step' THEN event || '_' || value WHEN event IN ('suggestion_selected','agent_started') THEN event || '_' || action ELSE event END label, COUNT(*) count, COUNT(DISTINCT session_id) sessions FROM events WHERE $WHERE AND (event IN ('guide_opened','guide_step','guide_skipped','guide_draft_created','suggestion_selected') OR (event='agent_started' AND action IN ('guided','clarification','followup','example'))) GROUP BY label ORDER BY label`,
    ],
    [
      'daily_usage',
      `WITH days AS (SELECT visitor_id, COUNT(DISTINCT strftime('%Y-%m-%d',(occurred_at + ${offset})/1000,'unixepoch')) days FROM events WHERE $WHERE AND event IN ('daily_revealed','daily_revisited') AND ${browserAudienceSQL} AND visitor_id IS NOT NULL GROUP BY visitor_id)
      SELECT COUNT(*) visitors, COALESCE(SUM(days>=2),0) repeat_visitors, COALESCE(SUM(days),0) visitor_days FROM days`,
    ],
    [
      'daily_events',
      `SELECT event label, COUNT(*) count, COUNT(DISTINCT visitor_id) visitors FROM events WHERE $WHERE AND tool='daily' AND (event IN ('daily_ready','daily_revealed','daily_revisited','daily_reflection_saved','daily_agent_opened','daily_exported') OR (event IN ('registration_offer_viewed','registration_offer_clicked') AND action='daily-save')) GROUP BY event ORDER BY event`,
    ],
  ];
  for (const key of [
    'actor_type',
    'actor_name',
    'actor_purpose',
    'classification_evidence',
    'resource_type',
    'http_method',
    'source',
    'medium',
    'campaign',
    'page',
    'entry_page',
    'locale',
    'device',
    'browser',
    'os',
    'country',
    'channel',
    'tool',
    'mode',
    'action',
  ]) {
    queries.push([
      key,
      `SELECT ${key} label, COUNT(*) events, SUM(${contentRequestSQL}) requests, SUM(${serviceRequestSQL}) calls, SUM(${browserViewSQL}) views, COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN session_id END) sessions, SUM(${productSuccessSQL}) successes FROM events WHERE $WHERE GROUP BY ${key} ORDER BY requests DESC,views DESC,events DESC`,
    ]);
  }
  queries.push(
    [
      'trend',
      `SELECT CAST((occurred_at - ${since}) / ${step} AS INTEGER) bucket,
      SUM(${contentRequestSQL}) content_requests,
      SUM(${contentRequestSQL} AND actor_type='search_crawler') search_requests,
      SUM(${contentRequestSQL} AND actor_type IN ('ai_crawler','ai_agent')) ai_requests,
      SUM(${serviceRequestSQL}) service_requests,
      SUM(${browserViewSQL}) pageviews,
      COUNT(DISTINCT CASE WHEN ${activeBrowserSQL} THEN visitor_id END) active_visitors,
      COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN visitor_id END) visitors,
      COUNT(DISTINCT CASE WHEN ${browserViewSQL} THEN session_id END) sessions,
      SUM(event='calculation_succeeded' AND action!='example') calculations,
      SUM(event='agent_finished' AND status='complete') agent_complete,
      SUM(${serviceFailureSQL}) failures
      FROM events WHERE $WHERE GROUP BY bucket ORDER BY bucket`,
    ],
    [
      'http_status',
      `SELECT http_status label, http_method method, COUNT(*) requests FROM events WHERE $WHERE AND event='page_request' GROUP BY http_status,http_method ORDER BY requests DESC`,
    ],
    [
      'hours',
      `SELECT CAST(strftime('%H', (occurred_at + ${offset})/1000, 'unixepoch') AS INTEGER) label,
      SUM(${browserViewSQL}) views FROM events WHERE $WHERE GROUP BY label ORDER BY label`,
    ],
  );
  const results = await env.ANALYTICS.batch<ReportRow>(queries.map(([, sql]) => query(sql)));
  const data: Record<string, ReportRow[]> = Object.fromEntries(
    queries.map(([key], i) => [key, results[i].results]),
  );
  const recorded = new Map(data.trend.map((row) => [Number(row.bucket), row]));
  const series = Array.from({ length: (days * DAY) / step }, (_, i) => {
    const bucket = since + i * step,
      finish = bucket + step;
    const state = bucket > asOf ? 'future' : finish > asOf ? 'partial' : 'observed';
    const row = recorded.get(i);
    return {
      bucket,
      end: finish,
      label: new Date(bucket + offset)
        .toISOString()
        .slice(0, granularity === 'hour' ? 16 : 10)
        .replace('T', ' '),
      state,
      ...Object.fromEntries(
        reportMetrics.map(({ key }) => [key, state === 'future' ? null : Number(row?.[key] ?? 0)]),
      ),
    } as TrendPoint;
  });
  const hours = new Map(data.hours.map((row) => [Number(row.label), Number(row.views)]));
  data.hours = Array.from({ length: 24 }, (_, hour) => ({
    label: hour,
    views: days === 1 && since + hour * 3600000 > asOf ? null : (hours.get(hour) ?? 0),
  }));
  delete data.trend;
  return {
    measurement: { version: measurementVersion, definitions: metricDefinitions },
    generatedAt: new Date(asOf).toISOString(),
    days,
    includeTest,
    retentionDays: 90,
    timezone,
    filters: applied,
    range: {
      start: since,
      end,
      asOf,
      startDate: dateInTimezone(since, timezone),
      endDate: dateInTimezone(end - 1, timezone),
      granularity,
    },
    series,
    data,
  };
}
