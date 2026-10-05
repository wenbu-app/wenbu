import type { Locale } from '../lib/schema';
import { InsightsLocale, useInsightsLocale } from '../lib/insights-locale';
import AnalyticsExplorer from './AnalyticsExplorer';
import { audiences } from '../lib/measurement-contract';
import { AnalyticsTrend, AnalyticsBreakdownCharts, AnalyticsTrafficCharts } from './AnalyticsCharts';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, LockKeyhole, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import {
  defaultReportFilters,
  reportDimensions,
  reportPresets,
  dateInTimezone,
  type AnalyticsReport,
  type ReportFilters,
  type ReportMetric,
} from '../lib/analytics-report';
import '../styles/analytics-dashboard.css';
import AccountInsights from './AccountInsights';
import { UserFacingError, uiErrorMessage } from '../lib/ui-error';
const number = (value: unknown) => Number(value ?? 0).toLocaleString('zh-CN');
export default function AnalyticsDashboard({ locale = 'zh' }: { locale?: Locale }) {
  return (
    <InsightsLocale.Provider value={locale}>
      <DashboardContent />
    </InsightsLocale.Provider>
  );
}
function DashboardContent() {
  const { t, reportLabels, reportLabel, formatReportTime, reportMetrics, metricDefinitions } =
    useInsightsLocale();

  const [tab, setTab] = useState<'overview' | 'events' | 'feedback' | 'archives'>('overview');
  const [linked, setLinked] = useState({ operation: '', test: false });
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<AnalyticsReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({ ...defaultReportFilters });
  const [customRange, setCustomRange] = useState(false);
  const [selected, setSelected] = useState<ReportMetric[]>(['content_requests', 'pageviews']);
  const requestId = useRef(0),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setReady(true);
    return () => {
      requestId.current++;
      controller.current?.abort();
    };
  }, []);
  function logout() {
    requestId.current++;
    controller.current?.abort();
    setBusy(false);
    setToken('');
    setReport(undefined);
    setError('');
    setTab('overview');
  }
  async function load(next: ReportFilters = filters) {
    if (!token.trim() || busy) return;
    const id = ++requestId.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/analytics?' + new URLSearchParams(next), {
        headers: { Authorization: `Bearer ${token.trim()}` },
        cache: 'no-store',
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setReport(undefined);
          throw new UserFacingError(t('管理密钥无效，请检查后再试。'));
        }
        if (response.status === 400)
          throw new UserFacingError(t('请检查日期与筛选条件：日期限最近 90 天，小时明细最多查看 7 天。'));
        throw new UserFacingError(
          response.status === 429 ? t('查询较频繁，请稍后再试。') : t('统计暂时不可用，已保留上次结果。'),
        );
      }
      const data = (await response.json()) as AnalyticsReport;
      if (requestId.current === id) {
        setReport(data);
        setFilters(data.filters);
        setCustomRange(Boolean(data.filters.start || data.filters.end));
      }
    } catch (e) {
      if (requestId.current === id && !(e instanceof DOMException && e.name === 'AbortError'))
        setError(
          e instanceof DOMException && e.name === 'TimeoutError'
            ? t('查询超时，已保留上次结果，请稍后重试。')
            : uiErrorMessage(e, t('统计暂时不可用，已保留上次结果。')),
        );
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }
  const summary = report?.data.summary[0] ?? {};
  const changed = Boolean(report && JSON.stringify(filters) !== JSON.stringify(report.filters));
  const days =
    filters.start && filters.end
      ? (Date.parse(filters.end) - Date.parse(filters.start)) / 86400000 + 1
      : Number(filters.days);
  const today = dateInTimezone(Date.now(), filters.timezone),
    earliest = dateInTimezone(Date.now() - 89 * 86400000, filters.timezone);
  function pick(key: keyof ReportFilters, value: string) {
    const next = { ...(report?.filters ?? filters), [key]: value };
    setFilters(next);
    void load(next);
  }
  function preset(days: number) {
    const next = { ...filters, days: String(days), start: '', end: '', granularity: 'auto' };
    setCustomRange(false);
    setFilters(next);
    void load(next);
  }
  function toggle(key: ReportMetric) {
    setSelected((current) =>
      current.includes(key)
        ? current.length === 1
          ? current
          : current.filter((k) => k !== key)
        : [...current, key],
    );
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wenbu-analytics.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const guidanceLabels: Record<string, string> = {
    guide_opened: t('打开旧版引导'),
    guide_step_1: t('旧版：返回选择主题'),
    guide_step_2: t('旧版：进入目标选择'),
    guide_step_3: t('旧版：进入补充与预览'),
    guide_skipped: t('旧版：切换直接输入'),
    guide_draft_created: t('旧版：引导内容放入草稿'),
    suggestion_selected_clarification: t('选择澄清回答'),
    suggestion_selected_followup: t('选择继续追问'),
    agent_started_guided: t('从引导开始对话'),
    agent_started_clarification: t('回复澄清问题'),
    agent_started_followup: t('发送后续追问'),
    agent_started_example: t('发送示例提问'),
  };
  const breakdownNames: Record<string, string> = {
    actor_type: t('访问者类型'),
    actor_name: t('客户端标识'),
    actor_purpose: t('请求用途'),
    classification_evidence: t('分类依据'),
    resource_type: t('资源类型'),
    http_method: t('请求方法'),
    source: t('引荐来源'),
    medium: t('渠道类型'),
    campaign: t('推广活动'),
    page: t('浏览页面'),
    entry_page: t('进入页面'),
    locale: t('语言'),
    device: t('设备'),
    browser: t('浏览器'),
    os: t('操作系统'),
    country: t('国家 / 地区'),
    channel: t('使用方式'),
    tool: t('工具'),
    mode: t('Agent 模式'),
    action: t('入口点击'),
  };
  const select = (key: keyof ReportFilters) => (
    <label key={key}>
      {reportLabels[key]}
      <select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
        <option value="">{t('全部')}</option>
        {reportDimensions[key].map((v) => (
          <option key={v} value={v}>
            {reportLabel(v)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="insights shell observatory">
      <header className="insights-header">
        <div>
          <span className="eyebrow accent">WENBU · PRODUCT OBSERVATORY</span>
          <h1>
            <BarChart3 size={28} />
            {t('访问与使用')}
          </h1>
          <p>{t('看见每个时段的变化，再沿着来源、页面与功能继续探索。')}</p>
        </div>
        <span className="insights-private">
          <LockKeyhole size={14} />
          {t('仅管理员可见')}
        </span>
      </header>
      {!report ? (
        <form
          className="insights-login"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <LockKeyhole size={26} />
          <h2>{t('打开数据观察室')}</h2>
          <p>{t('输入管理密钥查看统计。密钥仅用于本页请求，不写入网址或浏览器存储。')}</p>
          <label>
            {t('管理密钥')}
            <input
              type="password"
              disabled={!ready || busy}
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </label>
          <button className="button" disabled={!ready || busy}>
            {!ready ? t('正在准备面板…') : busy ? t('正在验证…') : t('查看统计')}
          </button>
        </form>
      ) : (
        <>
          <div className="insights-tabs" role="group" aria-label={t('数据视图')}>
            {(
              [
                ['overview', t('使用概览')],
                ['events', t('使用历史')],
                ['feedback', t('用户反馈')],
                ['archives', t('历史归档')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => {
                  setLinked({ operation: '', test: false });
                  setTab(key);
                }}
              >
                {label}
              </button>
            ))}
            <button onClick={logout}>{t('退出')}</button>
          </div>
          {tab === 'overview' && <AccountInsights token={token.trim()} />}
          {tab !== 'overview' ? (
            <AnalyticsExplorer
              key={tab + linked.operation}
              token={token.trim()}
              kind={tab}
              initialOperation={linked.operation}
              includeTest={linked.operation ? linked.test : report.includeTest}
              initialFilters={
                tab === 'events' && !linked.operation
                  ? {
                      ...report.filters,
                      start: report.range.startDate,
                      end: report.range.endDate,
                      asOf: String(report.range.asOf),
                    }
                  : undefined
              }
              onFollowOperation={(operation, destination, test) => {
                setLinked({ operation, test });
                setTab(destination);
              }}
            />
          ) : (
            <>
              <form
                className="observatory-filter-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  void load();
                }}
              >
                <fieldset disabled={busy}>
                  <div className="observatory-period-row">
                    <div className="observatory-periods" aria-label={t('统计时间范围')}>
                      {reportPresets.map((d) => (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={!customRange && filters.days === String(d)}
                          onClick={() => preset(d)}
                        >
                          {t(d === 1 ? '1 天' : '{0} 天', d)}
                          {d === 1 && <small>24h</small>}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-pressed={customRange}
                        onClick={() => {
                          setCustomRange(true);
                          setFilters({
                            ...filters,
                            start: report.range.startDate,
                            end: report.range.endDate,
                          });
                        }}
                      >
                        {t('自定义')}
                      </button>
                    </div>
                    <label>
                      {t('时区')}
                      <select
                        value={filters.timezone}
                        onChange={(e) => setFilters({ ...filters, timezone: e.target.value })}
                      >
                        <option value="Asia/Shanghai">{t('北京 · UTC+8')}</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </label>
                    <label>
                      {t('曲线粒度')}
                      <select
                        value={filters.granularity}
                        onChange={(e) => setFilters({ ...filters, granularity: e.target.value })}
                      >
                        <option value="auto">{t('自动')}</option>
                        <option value="hour" disabled={days > 7}>
                          {t('按小时（≤7 天）')}
                        </option>
                        <option value="day">{t('按天')}</option>
                      </select>
                    </label>
                  </div>
                  {customRange && (
                    <div className="observatory-dates">
                      <label>
                        {t('开始日期')}
                        <input
                          type="date"
                          required
                          min={earliest}
                          max={today}
                          value={filters.start}
                          onInput={(e) => {
                            const start = e.currentTarget.value;
                            setFilters((current) => ({ ...current, start, granularity: 'auto' }));
                          }}
                          onChange={(e) =>
                            setFilters({ ...filters, start: e.target.value, granularity: 'auto' })
                          }
                        />
                      </label>
                      <span>{t('至')}</span>
                      <label>
                        {t('结束日期')}
                        <input
                          type="date"
                          required
                          min={filters.start || earliest}
                          max={today}
                          value={filters.end}
                          onInput={(e) => {
                            const end = e.currentTarget.value;
                            setFilters((current) => ({ ...current, end, granularity: 'auto' }));
                          }}
                          onChange={(e) =>
                            setFilters({ ...filters, end: e.target.value, granularity: 'auto' })
                          }
                        />
                      </label>
                      <p>{t('包含起止日期，最多 90 天。')}</p>
                    </div>
                  )}
                  <div className="observatory-main-filters">
                    <label>
                      {t('统计人群')}
                      <select
                        value={filters.audience}
                        onChange={(e) => setFilters({ ...filters, audience: e.target.value })}
                      >
                        {audiences.map((value) => (
                          <option key={value} value={value}>
                            {value === 'browser' ? t('浏览器（含兼容旧记录）') : reportLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(['actor_type', 'source', 'page', 'locale'] as const).map(select)}
                  </div>
                  <details className="observatory-more-filters">
                    <summary>
                      <SlidersHorizontal size={14} />
                      {t('更多筛选')}
                      <span>{t('客户端、依据、资源、设备与渠道等')}</span>
                    </summary>
                    <div className="observatory-extra-grid">
                      {(
                        [
                          'actor_name',
                          'actor_purpose',
                          'classification_evidence',
                          'resource_type',
                          'http_method',
                          'device',
                          'medium',
                          'campaign',
                          'entry_page',
                          'channel',
                          'tool',
                          'mode',
                          'browser',
                          'os',
                        ] as const
                      ).map(select)}
                      <label>
                        {t('国家 / 地区代码')}
                        <input
                          value={filters.country}
                          maxLength={2}
                          pattern="[A-Z]{2}"
                          placeholder={t('例如 CN、US')}
                          onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase() })}
                        />
                      </label>
                    </div>
                    <p>
                      {t('“功能事件”只保留该功能的操作记录。查看某个工具页的访问量，可使用“浏览页面”筛选。')}
                    </p>
                  </details>
                  <div className="observatory-filter-footer">
                    <label className="observatory-test">
                      <input
                        type="checkbox"
                        checked={filters.test === 'true'}
                        onChange={(e) => setFilters({ ...filters, test: String(e.target.checked) })}
                      />
                      {t('包含测试流量')}
                    </label>
                    <span role="status">
                      {changed ? t('筛选已修改，应用后更新图表') : t('全部图表使用同一组筛选')}
                    </span>
                    <button
                      type="button"
                      className="observatory-text-button"
                      onClick={() => {
                        const next = { ...defaultReportFilters };
                        setCustomRange(false);
                        setFilters(next);
                        void load(next);
                      }}
                    >
                      {t('重置')}
                    </button>
                    <button className="button" type="submit">
                      <RefreshCw size={14} className={busy ? 'observatory-refreshing' : ''} />
                      {busy ? t('读取中…') : t('应用筛选')}
                    </button>
                  </div>
                </fieldset>
              </form>
              <div className="insights-toolbar observatory-toolbar">
                <span>
                  <b>
                    {report.range.startDate} — {report.range.endDate}
                  </b>{' '}
                  · {report.timezone === 'Asia/Shanghai' ? t('北京时间') : 'UTC'} ·{' '}
                  {report.includeTest ? t('含测试流量') : t('已排除测试')}
                  <small>
                    {t('数据截至')}
                    {formatReportTime(report.range.asOf, report.timezone, true)}
                  </small>
                </span>
                <button type="button" onClick={download}>
                  <Download size={14} />
                  {t('导出汇总 JSON')}
                </button>
              </div>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <div className="observatory-active-filters">
                {Object.keys(reportLabels)
                  .filter((key) => key in reportDimensions || key === 'country')
                  .map(
                    (key) =>
                      report.filters[key as keyof ReportFilters] && (
                        <button
                          type="button"
                          key={key}
                          disabled={busy}
                          onClick={() => pick(key as keyof ReportFilters, '')}
                        >
                          {reportLabels[key]}
                          {t('：')}
                          {reportLabel(report.filters[key as keyof ReportFilters])}
                          <X size={12} />
                        </button>
                      ),
                  )}
              </div>
              <div className="observatory-results" aria-busy={busy}>
                <div className="insights-metrics observatory-metrics">
                  {reportMetrics.map((m) => (
                    <button
                      type="button"
                      key={m.key}
                      aria-pressed={selected.includes(m.key)}
                      onClick={() => toggle(m.key)}
                      style={{ borderTopColor: m.color }}
                      title={metricDefinitions[m.key].definition}
                    >
                      <span>{m.label}</span>
                      <strong>{number(summary[m.key])}</strong>
                      <small>
                        {metricDefinitions[m.key].unit} ·{' '}
                        {selected.includes(m.key) ? t('曲线已显示') : t('点击显示曲线')}
                      </small>
                    </button>
                  ))}
                </div>
                {!summary.events && (
                  <p className="insights-empty">
                    {t('当前筛选下还没有记录。可以扩大时间范围或移除筛选条件；图表不会填入演示数据。')}
                  </p>
                )}
                <section
                  className="insights-card observatory-traffic-note"
                  aria-label={t('统计口径与分类覆盖')}
                >
                  <span className="eyebrow">MEASUREMENT &amp; COVERAGE</span>
                  <h2>{t('浏览、抓取与调用，分别计数')}</h2>
                  <p>
                    {t(
                      '浏览器页面浏览来自网页事件，排除已识别自动化；内容请求来自服务端 GET，包含网页、手册和发现文件，不计入浏览量或访客数。服务调用排除内部工具阶段，MCP tools/call 每次计一次，初始化与列表请求不计。问卜 Agent 完成是产品功能指标。',
                    )}
                  </p>
                  <div className="observatory-coverage-facts">
                    <span>
                      <b>{number(summary.classified_events)}</b>
                      {t('新分类事件')}
                    </span>
                    <span>
                      <b>{number(summary.legacy_events)}</b>
                      {t('旧记录，无细分类依据')}
                    </span>
                    <span>
                      <b>{number(summary.excluded_views)}</b>
                      {t('自动化或未知浏览事件，未计 PV')}
                    </span>
                    <span>
                      <b>{number(summary.unclassified_requests)}</b>
                      {t('未识别内容请求')}
                    </span>
                    <span>
                      <b>{number(summary.verified_requests)}</b>
                      {t('CF 验证自动化请求')}
                    </span>
                    <span>
                      <b>{number(summary.signed_requests)}</b>
                      {t('CF 签名 Agent 请求')}
                    </span>
                  </div>
                  <small>
                    {t(
                      'UA 和协议可伪装；浏览器特征不保证真人。Cloudflare 验证只在边缘提供依据时标记，具体名称仍来自 UA。旧的非 bot 网页记录保留在浏览指标中；历史抓取量无法补算，升级前缺少收尾记录的 MCP 调用也无法可靠补算。请求统计不覆盖边缘拦截、资源文件或后台页面。',
                    )}
                  </small>
                </section>
                <section className="insights-card" aria-label={t('使用与数据质量')}>
                  <span className="eyebrow">USAGE &amp; DATA QUALITY</span>
                  <h2>{t('完成使用与采集质量')}</h2>
                  <p>
                    {t(
                      '完成使用的浏览器标识 {0} 个，关联会话 {1} 个。由服务器确认成功结果，排除示例；标识不是自然人数，自动化不能仅靠 UA 完全识别。',
                      number(summary.active_visitors),
                      number(summary.active_sessions),
                    )}
                  </p>
                  <div className="observatory-coverage-facts">
                    <span>
                      {t('客户端')}
                      <b>{number(report.data.quality?.[0]?.client_events)}</b>
                      {t('条')}
                    </span>
                    <span>
                      {t('服务端')}
                      <b>{number(report.data.quality?.[0]?.server_events)}</b>
                      {t('条')}
                    </span>
                    <span>
                      {t('内容请求')}
                      <b>{number(report.data.quality?.[0]?.edge_events)}</b>
                      {t('条')}
                    </span>
                    <span>
                      {t('时间校正')}
                      <b>{number(report.data.quality?.[0]?.adjusted_timestamps)}</b>
                      {t('条')}
                    </span>
                    <span>
                      {t('延迟超过 5 分钟')}
                      <b>{number(report.data.quality?.[0]?.delayed_events)}</b>
                      {t('条')}
                    </span>
                    <span>
                      {t('未关联标识的成功')}
                      <b>{number(report.data.quality?.[0]?.unlinked_successes)}</b>
                      {t('次')}
                    </span>
                    <span>
                      {t('客户端报告丢弃')}
                      <b>{number(report.data.quality?.[0]?.reported_dropped_events)}</b>
                      {t('条')}
                    </span>
                  </div>
                  <small>
                    {t(
                      '只反映已收到记录；没有记录不等于没有丢失。隐私退出、脚本阻止和边缘拦截不在覆盖范围内。标记测试的事件默认排除，未标记的自测无法事后可靠识别。工具筛选只保留带该工具标签的事件，可能没有 PV，不能据此计算转化率。',
                    )}
                  </small>
                  <details>
                    <summary>{t('查看全部指标定义与版本')}</summary>
                    <p>
                      {t('口径版本：')}
                      {report.measurement?.version ?? t('旧版')}
                      {t('。浏览器标识和会话按完整范围去重，每小时 / 每天数字不能相加得到整体人数。')}
                    </p>
                    <dl>
                      {reportMetrics.map((metric) => (
                        <div key={metric.key}>
                          <dt>
                            {metric.label} · {metricDefinitions[metric.key].unit}
                          </dt>
                          <dd>{metricDefinitions[metric.key].definition}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </section>
                <AnalyticsTrend report={report} selected={selected} onToggle={toggle} />
                <p className="insights-quality-note">
                  {t('示例计算')}
                  {number(summary.examples)}
                  {t('次 · 输入未通过')}
                  {number(summary.invalid_inputs)}
                  {t('次 · 额度 / 限速')}
                  {number(summary.throttled)}
                  {t('次 · 用户中断')}
                  {number(summary.cancellations)}
                  {t('次 · Agent 等待补充')}
                  {number(summary.agent_waiting)}
                  {t('回合。与服务错误分开统计。')}
                </p>
                <AnalyticsTrafficCharts report={report} onFilter={pick} />
                <AnalyticsBreakdownCharts report={report} onFilter={pick} />
                <details className="observatory-detail-tables">
                  <summary>
                    {t('展开详细统计表')}
                    <span>{t('来源、引导、性能与全部事件')}</span>
                  </summary>
                  <div className="insights-breakdowns">
                    <details className="insights-card" open>
                      <summary>{t('Agent 提问引导')}</summary>
                      <p>
                        {t(
                          '只统计步骤与操作类型，不记录选择内容。发送表示发起回合，不等同于服务端完成；不是严格漏斗。',
                        )}
                      </p>
                      <div className="insights-table">
                        <table>
                          <thead>
                            <tr>
                              <th>{t('操作')}</th>
                              <th>{t('次数')}</th>
                              <th>{t('会话')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(report.data.guidance ?? []).map((row) => (
                              <tr key={String(row.label)}>
                                <th>{guidanceLabels[String(row.label)] ?? String(row.label)}</th>
                                <td>{number(row.count)}</td>
                                <td>{number(row.sessions)}</td>
                              </tr>
                            ))}
                            {!report.data.guidance?.length && (
                              <tr>
                                <td colSpan={3}>{t('所选范围内还没有引导事件。')}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <small>
                        {t('自由修改后不再包含原建议的发送归为普通对话；不推断用户主题或个人特征。')}
                      </small>
                    </details>
                    {Object.entries(breakdownNames).map(([key, label]) => (
                      <details className="insights-card" key={key}>
                        <summary>{label}</summary>
                        <div className="insights-table">
                          <table>
                            <thead>
                              <tr>
                                <th>{t('维度')}</th>
                                <th>{t('事件')}</th>
                                <th>{t('浏览量')}</th>
                                <th>{t('内容 GET')}</th>
                                <th>{t('服务调用')}</th>
                                <th>{t('会话')}</th>
                                <th>{t('成功')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.data[key].map((row) => (
                                <tr key={String(row.label)}>
                                  <th>{reportLabel(String(row.label))}</th>
                                  <td>{number(row.events)}</td>
                                  <td>{number(row.views)}</td>
                                  <td>{number(row.requests)}</td>
                                  <td>{number(row.calls)}</td>
                                  <td>{number(row.sessions)}</td>
                                  <td>{number(row.successes)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                  <details className="insights-card">
                    <summary>{t('服务状态与耗时')}</summary>
                    <div className="insights-table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('功能')}</th>
                            <th>{t('状态')}</th>
                            <th>{t('次数')}</th>
                            <th>{t('平均耗时')}</th>
                            <th>{t('最大耗时')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.data.performance.map((row, i) => (
                            <tr key={i}>
                              <th>{row.label}</th>
                              <td>{row.status}</td>
                              <td>{number(row.count)}</td>
                              <td>{number(row.average_ms)} ms</td>
                              <td>{number(row.max_ms)} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  <details className="insights-card">
                    <summary>{t('全部事件与接收位置')}</summary>
                    <div className="insights-table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('事件')}</th>
                            <th>{t('接收位置')}</th>
                            <th>{t('状态')}</th>
                            <th>{t('数量')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.data.events.map((row, i) => (
                            <tr key={i}>
                              <th>{row.label}</th>
                              <td>{row.origin}</td>
                              <td>{row.status}</td>
                              <td>{number(row.count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </details>
              </div>
            </>
          )}
        </>
      )}
      {error && !report && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <p className="insights-footnote">
        {t(
          '近 N 天包含今天，按所选时区的自然日分组，今天仍在变化。匿名访客是 30 天有效的浏览器标识，不等于自然人数。拦截、关闭统计和延迟补发会影响覆盖；0 表示未记录到事件。服务端请求只记录公开内容路径、粗略类别和响应状态，不创建访客身份。最近 90 天明细可在线查看，更早记录从私有归档导出。数据用于产品改进，不用于计费。',
        )}
      </p>
    </section>
  );
}
