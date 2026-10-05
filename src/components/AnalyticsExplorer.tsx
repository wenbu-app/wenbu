import { useInsightsLocale } from '../lib/insights-locale';
import {
  actorTypes,
  actorNames,
  actorPurposes,
  classificationEvidence,
  resourceTypes,
} from '../lib/traffic-contract';
import { audiences } from '../lib/measurement-contract';
import { reportDimensions } from '../lib/analytics-report';
import { useEffect, useRef, useState } from 'react';
import { Download, ArrowRight, RefreshCw, MessageSquare, CheckCircle2, Database, Search } from 'lucide-react';
import { clientEvents, tools, statuses, sources, campaigns } from '../lib/analytics-contract';
import { feedbackStates } from '../lib/feedback-contract';
import '../styles/analytics-explorer.css';
type Row = Record<string, string | number | null>;
type Page = { rows: Row[]; next: string | null };
type Storage = {
  archiveConfigured: boolean;
  hotDays: number;
  events: Row;
  archives: Row;
  feedback: Row;
  maintenance: Row | null;
};
const stateNames: Record<string, string> = {
  new: '待查看',
  reviewing: '处理中',
  resolved: '已解决',
  dismissed: '已归档',
};
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AnalyticsExplorer({
  token,
  kind,
  initialOperation = '',
  includeTest = false,
  initialFilters,
  onFollowOperation,
}: {
  token: string;
  kind: 'events' | 'feedback' | 'archives';
  initialOperation?: string;
  includeTest?: boolean;
  initialFilters?: Record<string, string>;
  onFollowOperation?: (operation: string, kind: 'events' | 'feedback', test: boolean) => void;
}) {
  const { t, reportLabel, locale: uiLocale } = useInsightsLocale();

  const [filters, setFilters] = useState({
    start: '',
    end: '',
    timezone: kind === 'events' ? 'Asia/Shanghai' : '',
    granularity: 'auto',
    asOf: '',
    audience: 'all',
    page: '',
    entry_page: '',
    medium: '',
    device: '',
    browser: '',
    os: '',
    country: '',
    mode: '',
    days: kind === 'feedback' ? '3650' : initialOperation ? '90' : '7',
    test: String(includeTest),
    tool: '',
    event: '',
    status: '',
    state: '',
    session: '',
    operation: initialOperation,
    conversation: '',
    visitor: '',
    source: '',
    campaign: '',
    locale: '',
    channel: '',
    actor_type: '',
    actor_name: '',
    actor_purpose: '',
    classification_evidence: '',
    resource_type: '',
    http_method: '',
    ...initialFilters,
  });
  const [page, setPage] = useState<Page>();
  const [storage, setStorage] = useState<Storage>();
  const [detail, setDetail] = useState<Row>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(filters);
  const when = (value: unknown) =>
    typeof value === 'number'
      ? new Intl.DateTimeFormat(uiLocale === 'en' ? 'en-GB' : 'zh-CN', {
          timeZone: applied.timezone || 'Asia/Shanghai',
          dateStyle: 'short',
          timeStyle: 'medium',
          hourCycle: 'h23',
        }).format(value)
      : '—';
  const generation = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (detail?.id) detailRef.current?.focus();
  }, [detail?.id]);
  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch('/api/admin/' + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });
    if (!response.ok)
      throw new UserFacingError(
        response.status === 401
          ? t('管理凭据已失效，请退出后重新登录。')
          : response.status === 429
            ? t('请求较频繁，请稍后再试。')
            : response.status === 409
              ? t('这条反馈已被更新，请重新打开。')
              : t('读取或保存失败（{0}），请检查筛选条件后重试。', response.status),
      );
    return response;
  }
  async function load(cursor = '', values = filters) {
    const version = ++generation.current;
    setBusy(true);
    setError('');
    setDetail(undefined);
    try {
      const params = new URLSearchParams({ ...values, cursor });
      const result: Page = await (await api(kind + '?' + params)).json();
      if (version === generation.current) {
        setPage(result);
        setApplied(values);
      }
    } catch (e) {
      if (version === generation.current) setError(uiErrorMessage(e, t('请求失败')));
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    void api('storage')
      .then((r) => r.json())
      .then(setStorage)
      .catch(() => undefined);
    return () => {
      generation.current++;
    };
    // A keyed instance is created for every tab, and credentials never change in place.
  }, []);
  async function open(row: Row) {
    detailTrigger.current = document.activeElement as HTMLElement;
    if (kind !== 'feedback') {
      setDetail(row);
      return;
    }
    setError('');
    setBusy(true);
    try {
      setDetail(await (await api('feedback/' + row.id)).json());
    } catch (e) {
      setError(uiErrorMessage(e, t('请求失败')));
    } finally {
      setBusy(false);
    }
  }
  async function update(state: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await api('feedback/' + detail.id, {
        method: 'PATCH',
        body: JSON.stringify({ state, revision: detail.revision }),
      });
      const next = { ...detail, state, revision: Number(detail.revision) + 1 };
      setDetail(next);
      void api('storage')
        .then((r) => r.json())
        .then(setStorage)
        .catch(() => undefined);
      setPage(
        (old) =>
          old && {
            ...old,
            rows: old.rows.map((row) =>
              row.id === detail.id ? { ...row, state, revision: Number(row.revision) + 1 } : row,
            ),
          },
      );
    } catch (e) {
      setError(uiErrorMessage(e, t('请求失败')));
    } finally {
      setBusy(false);
    }
  }
  async function downloadArchive(key: string) {
    setBusy(true);
    setError('');
    try {
      const response = await api('archive?key=' + encodeURIComponent(key));
      saveBlob(await response.blob(), 'wenbu-' + key.split('/').slice(-2).join('-'));
    } catch (e) {
      setError(uiErrorMessage(e, t('请求失败')));
    } finally {
      setBusy(false);
    }
  }
  function focus(name: 'session' | 'operation' | 'conversation' | 'visitor', value: string) {
    const next = { ...filters, session: '', operation: '', conversation: '', visitor: '', [name]: value };
    setFilters(next);
    void load('', next);
  }
  const select = (name: keyof typeof filters, label: string, values: readonly string[]) => (
    <label>
      {label}
      <select value={filters[name]} onChange={(e) => setFilters({ ...filters, [name]: e.target.value })}>
        {!['timezone', 'audience'].includes(name) && <option value="">{t('全部')}</option>}
        {values.map((v) => (
          <option key={v} value={v}>
            {t(stateNames[v] ?? reportLabel(v))}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section
      className="history-explorer"
      aria-label={kind === 'events' ? t('使用历史') : kind === 'feedback' ? t('用户反馈') : t('历史归档')}
    >
      <div className="history-heading">
        <div>
          <span className="eyebrow accent">
            {kind === 'events' ? 'THE JOURNEY' : kind === 'feedback' ? 'VOICES & NOTES' : 'THE ARCHIVE'}
          </span>
          <h2>
            {kind === 'events'
              ? t('从一次操作，看见整个过程')
              : kind === 'feedback'
                ? t('听见用户，跟进改进')
                : t('历史数据，有据可查')}
          </h2>
          <p>
            {kind === 'events'
              ? t('按实际发生时间倒序排列。点击会话或操作标识，查看相关事件；旧版事件可能没有关联标识。')
              : kind === 'feedback'
                ? t('反馈、评价和处理状态集中在这里。主动分享的摘录与联系邮箱仅在展开详情时读取。')
                : t(
                    '超过一天的事件按小时归档到私有 R2。D1 保留最近 90 天明细；归档未成功的记录不会因到期被删除。',
                  )}
          </p>
        </div>
      </div>
      {kind === 'events' && (
        <p className="insights-quality-note">
          {initialFilters ? t('已继承概览的时间、人群与维度筛选。') : t('自然日与概览使用同一统计时区。')}
          {filters.asOf ? t(' 快照截至 {0}；点击回到最新可刷新快照。', when(Number(filters.asOf))) : ''}
          {t('人群：')}
          {reportLabel(filters.audience)}
          {t('。导出只含本页，不代表全部历史。')}
        </p>
      )}
      {storage && (
        <div className="history-storage">
          <span>
            <Database size={15} />
            {Number(storage.events.events).toLocaleString()}
            {t('条在线事件（含测试）')}
          </span>
          <span>
            {Number(storage.archives.archived_events).toLocaleString()}
            {t('条已归档（含测试）')}
          </span>
          <span>
            {t('待归档：')}
            {Number(storage.events.unarchived || 0).toLocaleString()}
            {t('条（含当天）')}
          </span>
          <span>
            <MessageSquare size={15} />
            {Number(storage.feedback.unread || 0)}
            {t('条待看反馈')}
          </span>
          <span className={storage.maintenance?.status === 'error' ? 'error-message' : ''}>
            {!storage.archiveConfigured
              ? t('归档未配置')
              : storage.maintenance?.status === 'error'
                ? t('最近归档失败 · 原始记录仍保留')
                : storage.maintenance?.last_success
                  ? t('最近归档：') + when(storage.maintenance.last_success)
                  : t('等待首次归档')}
          </span>
        </div>
      )}
      {kind !== 'archives' && (
        <form
          className="insights-filters history-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            {t('时间范围')}
            <select
              value={filters.start && filters.end ? 'custom' : filters.days}
              onChange={(e) => {
                if (e.target.value !== 'custom')
                  setFilters({ ...filters, days: e.target.value, start: '', end: '', asOf: '' });
              }}
            >
              {filters.start && filters.end && <option value="custom">{t('自定义日期范围')}</option>}
              {[1, 3, 7, 14, 30, 90, ...(kind === 'feedback' ? [365, 3650] : [])].map((n) => (
                <option key={n} value={n}>
                  {n === 3650
                    ? t('最近 10 年')
                    : kind === 'events'
                      ? t(n === 1 ? '1 个自然日（含今天）' : '{0} 个自然日（含今天）', n)
                      : t(n === 1 ? '最近 1 天' : '最近 {0} 天', n)}
                </option>
              ))}
            </select>
          </label>
          {kind === 'events' && (
            <>
              <label>
                {t('开始日期')}
                <input
                  type="date"
                  value={filters.start}
                  onChange={(e) =>
                    setFilters({ ...filters, start: e.target.value, asOf: '', granularity: 'auto' })
                  }
                />
              </label>
              <label>
                {t('结束日期')}
                <input
                  type="date"
                  value={filters.end}
                  onChange={(e) =>
                    setFilters({ ...filters, end: e.target.value, asOf: '', granularity: 'auto' })
                  }
                />
              </label>
              {select('timezone', t('统计时区'), ['Asia/Shanghai', 'UTC'])}
            </>
          )}
          {select('tool', t('功能'), tools)}
          {select('locale', t('语言'), ['zh', 'en'])}
          {kind === 'events' ? (
            <>
              {select('audience', t('统计人群'), audiences)}
              {select('actor_type', t('访问者类型'), actorTypes)}
              {select('source', t('来源'), sources)}
              <details className="history-more-filters">
                <summary>{t('更多维度：事件、依据、资源、设备与渠道')}</summary>
                <div className="history-extra-grid">
                  {select('event', t('事件'), [
                    ...clientEvents,
                    'calculation_succeeded',
                    'interpret_succeeded',
                    'agent_finished',
                    'agent_tool_finished',
                    'api_failed',
                    'mcp_finished',
                    'page_request',
                  ])}
                  {select('actor_name', t('客户端标识'), actorNames)}
                  {select('actor_purpose', t('请求用途'), actorPurposes)}
                  {select('classification_evidence', t('分类依据'), classificationEvidence)}
                  {select('resource_type', t('资源类型'), resourceTypes)}
                  {select('http_method', t('请求方法'), ['GET', 'HEAD', 'POST', 'OPTIONS', 'OTHER'])}
                  {select('status', t('结果'), statuses)}
                  {select('channel', t('使用方式'), ['web', 'api', 'cli', 'mcp'])}
                  {select('campaign', t('活动'), campaigns)}
                  {(['page', 'entry_page', 'medium', 'device', 'browser', 'os', 'mode'] as const).map(
                    (name) => (
                      <div key={name}>{select(name, reportLabel(name), reportDimensions[name])}</div>
                    ),
                  )}
                  <label>
                    {t('国家 / 地区')}
                    <input
                      value={filters.country}
                      maxLength={2}
                      placeholder="CN / US"
                      onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase() })}
                    />
                  </label>
                </div>
              </details>
            </>
          ) : (
            select('state', t('处理状态'), feedbackStates)
          )}
          <details className="history-more-filters">
            <summary>{t('关联会话、操作、对话或浏览器标识')}</summary>
            <div className="history-extra-grid">
              {(['session', 'operation', 'conversation', 'visitor'] as const).map((name, i) => (
                <label key={name}>
                  {[t('会话 ID'), t('操作 ID'), t('对话 ID'), t('访客 ID')][i]}
                  <input
                    value={filters[name]}
                    placeholder="UUID"
                    onChange={(e) => setFilters({ ...filters, [name]: e.target.value.trim() })}
                  />
                </label>
              ))}
            </div>
          </details>
          <label className="insights-test">
            <input
              type="checkbox"
              checked={filters.test === 'true'}
              onChange={(e) => setFilters({ ...filters, test: String(e.target.checked) })}
            />
            {t('包含测试数据')}
          </label>
          <button className="button" disabled={busy}>
            <Search size={14} />
            {t('查询')}
          </button>
        </form>
      )}
      <div className="history-applied" aria-label={t('明细已应用筛选')}>
        {Object.entries(applied)
          .filter(
            ([key, value]) =>
              value &&
              !['days', 'start', 'end', 'timezone', 'granularity', 'asOf', 'test'].includes(key) &&
              !(key === 'audience' && value === 'all'),
          )
          .map(([key, value]) => (
            <span key={key}>
              {reportLabel(key)}
              {t('：')}
              {reportLabel(value)}
            </span>
          ))}
      </div>
      <div className="insights-toolbar">
        <span>
          {page
            ? t(
                '本页 {0} 条 · {1}',
                page.rows.length,
                kind === 'archives'
                  ? t('完整归档文件')
                  : applied.test === 'true'
                    ? t('包含测试')
                    : t('已排除测试'),
              )
            : t('正在读取…')}
        </span>
        <button
          disabled={busy}
          onClick={() => {
            const next = { ...filters, asOf: '' };
            setFilters(next);
            void load('', next);
          }}
        >
          <RefreshCw size={14} />
          {t('回到最新')}
        </button>
        <button
          disabled={!page?.rows.length || busy}
          onClick={() =>
            saveBlob(
              new Blob([page!.rows.map((r) => JSON.stringify(r)).join('\n') + '\n'], {
                type: 'application/x-ndjson',
              }),
              `wenbu-${kind}-page.ndjson`,
            )
          }
        >
          <Download size={14} />
          {t('导出本页')}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {page?.rows.length === 0 && (
        <div className="history-empty">
          <CheckCircle2 size={28} />
          <p>{t('这个范围内还没有记录。')}</p>
          <span>{t('可调整时间、筛选项，或勾选测试数据检查接入情况。')}</span>
        </div>
      )}
      <div className="history-list" aria-busy={busy}>
        {page?.rows.map((row) => (
          <article className="history-row" key={String(row.id ?? row.key)}>
            <div className="history-time">
              <time>{when(row.occurred_at ?? row.created_at)}</time>
              <small>
                {kind === 'events'
                  ? t(
                      '{0} · {1}',
                      row.origin === 'server'
                        ? t('服务端操作')
                        : row.origin === 'edge'
                          ? t('服务端请求')
                          : t('网页事件'),
                      String(row.locale ?? '—'),
                    )
                  : kind === 'feedback'
                    ? `${row.category} · ${row.locale}`
                    : t('{0} 条事件', Number(row.event_count).toLocaleString())}
              </small>
            </div>
            <div className="history-main">
              <strong>
                {kind === 'events'
                  ? reportLabel(String(row.event))
                  : kind === 'feedback'
                    ? row.rating === 'none'
                      ? t('一条新建议')
                      : row.rating === 'helpful'
                        ? t('有帮助')
                        : row.rating === 'mixed'
                          ? t('还有提升空间')
                          : t('没帮到我')
                    : `${when(row.first_received_at)} — ${when(row.last_received_at)}`}
              </strong>
              {kind === 'feedback' ? (
                <p className="history-preview">{row.message || t('用户留下了评价。')}</p>
              ) : kind === 'events' ? (
                <p>
                  {row.page} · {reportLabel(String(row.actor_type))} · {reportLabel(String(row.actor_name))} ·{' '}
                  {reportLabel(String(row.classification_evidence))} · {row.tool} · {row.status}
                  {row.http_status ? ` · HTTP ${row.http_status}` : ''}
                  {row.action !== 'none' ? ` · ${row.action}` : ''}
                  {row.duration_ms ? ` · ${row.duration_ms} ms` : ''}
                  {row.setting !== 'none' ? ` · ${row.setting}: ${row.variant}` : ''}
                </p>
              ) : (
                <p>
                  {Math.round(Number(row.byte_count) / 1024)}
                  {t('KB · NDJSON · SHA-256 已记录')}
                </p>
              )}
              {kind === 'events' && (
                <div className="history-links">
                  {(['session', 'operation', 'conversation', 'visitor'] as const).map(
                    (name, i) =>
                      row[name + '_id'] && (
                        <button
                          key={name}
                          title={String(row[name + '_id'])}
                          disabled={busy}
                          onClick={() => focus(name, String(row[name + '_id']))}
                        >
                          {[t('会话'), t('操作'), t('对话'), t('访客')][i]}{' '}
                          {String(row[name + '_id']).slice(0, 8)} ↗
                        </button>
                      ),
                  )}
                </div>
              )}
            </div>
            <div className="history-row-action">
              {kind === 'feedback' && (
                <span className={'history-state state-' + row.state}>
                  {t(stateNames[String(row.state)] ?? String(row.state))}
                </span>
              )}
              <button
                disabled={busy}
                onClick={() => (kind === 'archives' ? void downloadArchive(String(row.key)) : void open(row))}
              >
                {kind === 'archives' ? (
                  <>
                    <Download size={14} />
                    {t('下载原始记录')}
                  </>
                ) : (
                  <>
                    {t('查看详情')}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>
      {page?.next && (
        <button
          className="button secondary history-more"
          disabled={busy}
          onClick={() => void load(page.next!, applied)}
        >
          {t('更早的记录')}
          <ArrowRight size={15} />
        </button>
      )}
      {detail && (
        <section ref={detailRef} tabIndex={-1} className="history-detail" aria-label={t('记录详情')}>
          <div className="history-detail-title">
            <h3>{kind === 'feedback' ? t('反馈详情') : t('事件详情')}</h3>
            <button
              onClick={() => {
                setDetail(undefined);
                detailTrigger.current?.focus();
              }}
            >
              {t('收起 ×')}
            </button>
          </div>
          {kind === 'feedback' ? (
            <>
              <p className="history-body">{detail.message || t('仅评价，无补充文字。')}</p>
              {detail.contact && (
                <p>
                  {t('联系邮箱：')}
                  {detail.contact}
                </p>
              )}
              {Boolean(detail.share_context) && (
                <details>
                  <summary>{t('用户主动分享的摘录')}</summary>
                  <pre>{detail.context_excerpt}</pre>
                </details>
              )}
              <label className="history-state-control">
                {t('处理状态')}
                <select
                  disabled={busy}
                  value={String(detail.state)}
                  onChange={(e) => void update(e.target.value)}
                >
                  {feedbackStates.map((v) => (
                    <option key={v} value={v}>
                      {t(stateNames[v])}
                    </option>
                  ))}
                </select>
              </label>
              <dl>
                {['id', 'page', 'tool', 'session_id', 'operation_id', 'conversation_id'].map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{detail[k] ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <pre>{JSON.stringify(detail, null, 2)}</pre>
          )}
          {detail.operation_id && onFollowOperation && (
            <button
              className="button secondary"
              onClick={() =>
                onFollowOperation(
                  String(detail.operation_id),
                  kind === 'feedback' ? 'events' : 'feedback',
                  Boolean(detail.is_test),
                )
              }
            >
              {kind === 'feedback' ? t('查看这次操作的使用历史') : t('查看这次操作的反馈')}{' '}
              <ArrowRight size={14} />
            </button>
          )}
        </section>
      )}
      <p className="insights-footnote">
        {t(
          '事件使用随机标识关联，不代表实名用户。此处导出当前页；完整分页导出与归档重建方法见项目 docs/analytics.md。归档文件包含测试事件，请按 is_test 筛选；历史合并按事件 id 去重。',
        )}
      </p>
    </section>
  );
}
import { UserFacingError, uiErrorMessage } from '../lib/ui-error';
