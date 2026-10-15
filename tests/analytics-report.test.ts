import { afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { analyticsReport } from '../worker/analytics-report';
import { historyReport } from '../worker/history';

const now = Date.parse('2026-09-29T06:35:00Z');
type DB = ReturnType<typeof database>;
function event(db: DB, time: string, patch: Record<string, string | number | null> = {}) {
  const row = {
    id: crypto.randomUUID(),
    occurred_at: Date.parse(time),
    received_at: Math.min(now, Date.parse(time)),
    event: 'page_view',
    origin: 'client',
    page: '/tarot/',
    entry_page: '/',
    locale: 'zh',
    source: 'google',
    medium: 'organic',
    campaign: 'none',
    device: 'desktop',
    browser: 'chrome',
    os: 'macos',
    country: 'CN',
    channel: 'web',
    tool: 'none',
    mode: 'none',
    action: 'none',
    status: 'none',
    session_id: 'same-session',
    visitor_id: 'same-visitor',
    ...patch,
  };
  db.sql
    .prepare(
      `INSERT INTO events (${Object.keys(row).join(',')}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(',')})`,
    )
    .run(...Object.values(row));
}
function report(db: DB, query = '') {
  return analyticsReport(new URL('https://wenbu.app/api/admin/analytics?' + query), db.env);
}
afterEach(() => vi.restoreAllMocks());
describe('calendar-based analytics visualizations', () => {
  it('separates daily visible usage, repeat dates and server responses without claiming cohort retention', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    for (const [time, patch] of [
      ['2026-09-28T12:00:00Z', { event: 'daily_revealed', visitor_id: 'returning' }],
      ['2026-09-29T05:00:00Z', { event: 'daily_revisited', visitor_id: 'returning' }],
      ['2026-09-29T05:01:00Z', { event: 'daily_revisited', visitor_id: 'returning' }],
      ['2026-09-29T05:10:00Z', { event: 'daily_revealed', visitor_id: 'new' }],
      ['2026-09-29T05:20:00Z', { event: 'daily_revealed', visitor_id: 'test-only', is_test: 1 }],
      [
        '2026-09-29T05:30:00Z',
        {
          event: 'daily_ready',
          origin: 'server',
          visitor_id: 'server-only',
          channel: 'web',
          status: 'complete',
        },
      ],
    ] as const)
      event(db, time, { tool: 'daily', page: '/daily/', ...patch });
    event(db, '2026-09-29T05:24:00Z', { tool: 'daily', page: '/daily/' });
    event(db, '2026-09-29T05:25:00Z', {
      tool: 'daily',
      event: 'tool_started',
      page: '/daily/',
      action: 'daily-reveal',
    });
    const data = await report(db, 'days=3&tool=daily&timezone=UTC');
    expect(data.data.daily_usage[0]).toMatchObject({ visitors: 2, repeat_visitors: 1, visitor_days: 3 });
    expect(data.data.daily_events.find((row) => row.label === 'daily_ready')).toMatchObject({ count: 1 });
    expect(data.data.daily_events.find((row) => row.label === 'daily_revealed')).toMatchObject({ count: 2 });
    expect(data.data.summary[0]).toMatchObject({ service_requests: 1, calculations: 0, active_visitors: 1 });
    expect(data.data.funnel[0]).toMatchObject({ visited: 1, started: 1, succeeded: 1 });
    const today = await report(db, 'days=1&tool=daily&timezone=UTC');
    expect(today.data.daily_usage[0]).toMatchObject({ visitors: 2, repeat_visitors: 0, visitor_days: 2 });
    db.sql.close();
  });
  it('returns 24 aligned local hours, leaves future slots null, excludes future/unreceived events and deduplicates visitors across the whole range', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    event(db, '2026-09-28T15:59:59.999Z');
    event(db, '2026-09-28T16:00:00Z');
    event(db, '2026-09-28T16:30:00Z');
    event(db, '2026-09-28T23:10:00Z');
    event(db, '2026-09-29T06:00:00Z');
    event(db, '2026-09-29T06:40:00Z');
    event(db, '2026-09-29T06:20:00Z', { received_at: now + 1 });
    const data = await report(db, 'days=1');
    expect(data.series).toHaveLength(24);
    expect(data.range.start).toBe(Date.parse('2026-09-28T16:00:00Z'));
    expect(data.series[0]).toMatchObject({
      pageviews: 2,
      visitors: 1,
      sessions: 1,
      label: '2026-09-29 00:00',
      state: 'observed',
    });
    expect(data.series[7].pageviews).toBe(1);
    expect(data.series[14]).toMatchObject({ pageviews: 1, state: 'partial' });
    expect(data.series[15]).toMatchObject({ pageviews: null, state: 'future' });
    expect(data.data.summary[0]).toMatchObject({ pageviews: 4, visitors: 1, sessions: 1 });
    expect(data.data.hours).toHaveLength(24);
    expect(data.data.hours.reduce((sum, r) => sum + Number(r.views), 0)).toBe(4);
    const utc = await report(db, 'days=1&timezone=UTC');
    expect(utc.data.summary[0].pageviews).toBe(1);
    expect(utc.series[6]).toMatchObject({ pageviews: 1, state: 'partial' });
    db.sql.close();
  });
  it.each([
    [1, 24, 'hour'],
    [3, 72, 'hour'],
    [7, 7, 'day'],
    [14, 14, 'day'],
    [30, 30, 'day'],
    [90, 90, 'day'],
  ])('supports preset %s with %s complete calendar slots', async (days, length, granularity) => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    const data = await report(db, 'days=' + days);
    expect(data.series).toHaveLength(Number(length));
    expect(data.range.granularity).toBe(granularity);
    expect(data.range.endDate).toBe('2026-09-29');
    expect(data.data.summary[0].events).toBe(0);
    expect(data.series[0].pageviews).toBe(0);
    db.sql.close();
  });
  it('uses inclusive custom dates and stable daily buckets across UTC and Shanghai midnight', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    event(db, '2026-09-26T15:59:59.999Z');
    event(db, '2026-09-26T16:00:00Z');
    event(db, '2026-09-27T18:00:00Z');
    event(db, '2026-09-28T15:59:59.999Z');
    event(db, '2026-09-28T16:00:00Z');
    const data = await report(db, 'start=2026-09-27&end=2026-09-28&granularity=day');
    expect(data.series.map((r) => r.pageviews)).toEqual([1, 2]);
    expect(data.series.map((r) => r.state)).toEqual(['observed', 'observed']);
    expect(data.data.summary[0].pageviews).toBe(3);
    expect(data.data.daily.map((r) => r.label)).toEqual(['2026-09-27', '2026-09-28']);
    const utc = await report(db, 'start=2026-09-27&end=2026-09-28&granularity=day&timezone=UTC');
    expect(utc.series.map((r) => r.pageviews)).toEqual([1, 2]);
    expect(utc.range.start).toBe(Date.parse('2026-09-27T00:00:00Z'));
    db.sql.close();
  });
  it('applies all dimensions to summary, curve, rankings and hour distribution without mixing test traffic', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    const stamp = '2026-09-29T02:00:00Z';
    event(db, stamp);
    for (const patch of [
      { source: 'github' },
      { page: '/bazi/' },
      { locale: 'en' },
      { country: 'US' },
      { device: 'mobile' },
      { channel: 'cli' },
      { medium: 'referral' },
      { entry_page: '/agent/' },
      { browser: 'safari' },
      { os: 'ios' },
      { campaign: 'launch' },
      { tool: 'tarot' },
      { mode: 'explore' },
      { is_test: 1 },
    ])
      event(db, stamp, patch);
    const filters =
      'days=1&source=google&page=%2Ftarot%2F&locale=zh&country=CN&device=desktop&channel=web&medium=organic&entry_page=%2F&browser=chrome&os=macos&campaign=none&tool=none&mode=none';
    const data = await report(db, filters);
    expect(data.data.summary[0].pageviews).toBe(1);
    expect(data.series.reduce((sum, r) => sum + Number(r.pageviews), 0)).toBe(1);
    expect(data.data.source).toEqual([expect.objectContaining({ label: 'google', views: 1 })]);
    expect(data.data.page).toEqual([expect.objectContaining({ label: '/tarot/', views: 1 })]);
    expect(data.data.hours[10].views).toBe(1);
    expect((await report(db, filters + '&test=true')).data.summary[0].pageviews).toBe(2);
    expect(data.filters.country).toBe('CN');
    db.sql.close();
  });
  it('keeps zero dates, ranks all pages without a top-30 denominator truncation, and separates phases from service calls', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    for (let i = 0; i < 35; i++) event(db, '2026-09-29T02:00:00Z', { page: `/fixture-${i}/` });
    event(db, '2026-09-29T02:00:00Z', {
      event: 'calculation_succeeded',
      origin: 'server',
      action: 'example',
      status: 'complete',
      tool: 'tarot',
    });
    event(db, '2026-09-29T02:00:00Z', {
      event: 'agent_tool_finished',
      origin: 'server',
      status: 'complete',
      tool: 'agent',
    });
    const data = await report(db, 'days=7');
    expect(data.series.slice(0, -1).map((r) => r.pageviews)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(data.data.page).toHaveLength(36);
    expect(data.data.page.reduce((sum, r) => sum + Number(r.views), 0)).toBe(35);
    expect(data.data.performance.reduce((sum, r) => sum + Number(r.count), 0)).toBe(1);
    expect(data.data.summary[0]).toMatchObject({ pageviews: 35, calculations: 0, examples: 1 });
    db.sql.close();
  });
  it.each([
    'days=0',
    'days=91',
    'days=1.5',
    'days=NaN',
    'timezone=America%2FNew_York',
    'granularity=week',
    'days=30&granularity=hour',
    'start=2026-09-28',
    'end=2026-09-28',
    'start=2026-02-30&end=2026-09-29',
    'start=2026-09-29&end=2026-09-28',
    'start=2026-09-28&end=2026-09-30',
    'start=2026-06-01&end=2026-09-29',
    'source=unlisted',
    'page=%2Fprivate',
    'country=China',
    'tool=wrong',
    'test=maybe',
  ])('rejects invalid filters instead of silently showing a different population: %s', async (query) => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = database();
    await expect(report(db, query)).rejects.toMatchObject({ status: 400 });
    db.sql.close();
  });
});

it('deduplicates confirmed browser use while keeping unlinked and nonbrowser use explicit', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const db = database();
  const success = {
    origin: 'server',
    event: 'calculation_succeeded',
    status: 'complete',
    action: 'calculate',
    actor_type: 'browser',
    classification_version: 1,
  };
  event(db, '2026-09-28T10:00:00Z', success);
  event(db, '2026-09-29T01:00:00Z', success);
  event(db, '2026-09-29T02:00:00Z', { ...success, action: 'example', visitor_id: 'example' });
  event(db, '2026-09-29T02:00:00Z', { ...success, actor_type: 'tool_client', visitor_id: 'cli' });
  event(db, '2026-09-29T02:00:00Z', { ...success, visitor_id: null, session_id: null });
  event(db, '2026-09-29T02:00:00Z', {
    event: 'mcp_finished',
    origin: 'server',
    channel: 'mcp',
    tool: 'mcp',
    status: 'invalid_input',
  });
  const r = await report(db, 'days=3');
  expect(r.data.summary[0]).toMatchObject({ active_visitors: 1, active_sessions: 1, invalid_inputs: 1 });
  expect(r.data.quality[0].unlinked_successes).toBe(1);
  expect(r.series.reduce((sum, p) => sum + (p.active_visitors || 0), 0)).toBe(2);
  expect(r.measurement.definitions.active_visitors.additive).toBe(false);
  const browser = await report(db, 'days=3&audience=classified_browser');
  expect(browser.data.summary[0]).toMatchObject({ calculations: 3, active_visitors: 1 });
  db.sql.close();
});

it('reconciles calendar and dimension filters between overview and paginated history snapshots', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const db = database();
  event(db, '2026-09-27T15:59:59Z');
  event(db, '2026-09-27T16:00:00Z');
  event(db, '2026-09-29T01:00:00Z');
  event(db, '2026-09-29T01:00:00Z', { page: '/bazi/' });
  event(db, '2026-09-29T07:00:00Z');
  event(db, '2026-09-29T01:00:00Z', { received_at: now + 1 });
  event(db, '2026-09-29T01:00:00Z', { is_test: 1 });
  const query =
    'start=2026-09-28&end=2026-09-29&timezone=Asia/Shanghai&page=/tarot/&medium=organic&browser=chrome&country=CN&audience=browser';
  const overview = await report(db, query);
  const first = await historyReport(
    new URL('https://wenbu.app/api/admin/events?' + query + '&limit=1&asOf=' + now),
    db.env,
    'events',
  );
  expect(first.rows).toHaveLength(1);
  expect(first.next).toBeTruthy();
  const second = await historyReport(
    new URL(
      'https://wenbu.app/api/admin/events?' + query + '&limit=1&cursor=' + encodeURIComponent(first.next!),
    ),
    db.env,
    'events',
  );
  expect(second.rows).toHaveLength(1);
  expect(second.next).toBeNull();
  expect(overview.data.summary[0].events).toBe(first.rows.length + second.rows.length);
  for (const extra of ['audience=human', 'asOf=' + (now + 1), 'country=China', 'test=maybe']) {
    await expect(
      historyReport(new URL('https://wenbu.app/api/admin/events?timezone=UTC&' + extra), db.env, 'events'),
    ).rejects.toMatchObject({ status: 400 });
  }
  db.sql.close();
});
