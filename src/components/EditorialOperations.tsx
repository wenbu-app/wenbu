import { useState } from 'react';
import type { ModelScene, ModelUsageReport } from '../../worker/model-usage';
const sceneNames: Record<ModelScene, string> = {
  editorial_draft: '初稿 / Draft',
  editorial_repair: '改稿 / Revision',
  editorial_review: '独立审稿 / Editorial review',
  commissioning_proposal: '补充选题 / Topic proposals',
  commissioning_review: '选题审核 / Topic review',
  agent: '问卜对话 / Agent',
  interpretation: '普通解读 / Interpretation',
};
const number = new Intl.NumberFormat('zh-CN');
const yuan = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 4 });

function ModelUsage({ report }: { report: ModelUsageReport | { status: 'unavailable' } }) {
  const [day, setDay] = useState('all');
  if (report.status === 'unavailable') return <p role="status">用量账本暂不可用 / Usage data unavailable</p>;
  const rows = report.rows.filter((row) => day === 'all' || row.day === day);
  const days = [...new Set(report.rows.map((row) => row.day))];
  const shown = Object.entries(sceneNames).flatMap(([scene, label]) => {
    const group = rows.filter((row) => row.scene === scene);
    if (!group.length) return [];
    const sum = (
      field:
        | 'calls'
        | 'failed_calls'
        | 'measured_calls'
        | 'priced_calls'
        | 'prompt_tokens'
        | 'completion_tokens'
        | 'cache_hit_tokens'
        | 'cache_miss_tokens'
        | 'reasoning_tokens'
        | 'cost_cny_nanos',
    ) => group.reduce((total, row) => total + (row[field] ?? 0), 0);
    const measured = sum('measured_calls'),
      priced = sum('priced_calls');
    const count = (
      field:
        'prompt_tokens' | 'completion_tokens' | 'cache_hit_tokens' | 'cache_miss_tokens' | 'reasoning_tokens',
    ) => (group.some((row) => row[field] !== null) ? number.format(sum(field)) : '—');
    return [
      <tr key={scene}>
        <th scope="row">{label}</th>
        <td>
          {number.format(sum('calls'))} ({number.format(sum('failed_calls'))} 失败 / failed)
        </td>
        <td>
          {number.format(measured)} / {number.format(sum('calls'))}
        </td>
        <td>{count('prompt_tokens')}</td>
        <td>{count('completion_tokens')}</td>
        <td>
          {count('cache_hit_tokens')} / {count('cache_miss_tokens')}
        </td>
        <td>{count('reasoning_tokens')}</td>
        <td>
          {priced ? yuan.format(sum('cost_cny_nanos') / 1e9) : '—'} ({priced} / {sum('calls')})
        </td>
      </tr>,
    ];
  });
  return (
    <div style={{ margin: '24px 0' }}>
      <h3>模型用量与费用 / Model usage and cost</h3>
      <p style={{ fontSize: 13 }}>
        {report.startDay} – {report.endDay} · 北京时间 / Shanghai time。
        根据已收到的用量和调用时段估算人民币费用，括号内为有计价数据的调用数。/ CNY estimates use received
        usage and request time. Parentheses show priced calls.
      </p>
      {days.length > 0 && (
        <label>
          日期 / Day{' '}
          <select value={day} onChange={(event) => setDay(event.currentTarget.value)}>
            <option value="all">全部记录 / All recorded days</option>
            {days.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </label>
      )}
      {shown.length ? (
        <div className="editorial-table" tabIndex={0} role="region" aria-label="模型用量 / Model usage">
          <table>
            <thead>
              <tr>
                <th>场景 / Scene</th>
                <th>请求 / Calls</th>
                <th>有回执 / Measured</th>
                <th>输入 / Input</th>
                <th>输出 / Output</th>
                <th>缓存命中 / 未命中 · Hit / miss</th>
                <th>推理 / Reasoning</th>
                <th>估算费用 / Estimated cost</th>
              </tr>
            </thead>
            <tbody>{shown}</tbody>
          </table>
        </div>
      ) : (
        <p>该时段暂无用量记录 / No usage records for this period.</p>
      )}
      <p style={{ fontSize: 12 }}>
        推理 token 已包含在输出中。缺失的用量和费用显示为“—”。/ Output includes reasoning tokens. Missing
        figures are shown as “—”.{' '}
        <a href={report.pricing.source} target="_blank" rel="noreferrer">
          计价来源 / Pricing source ↗
        </a>
      </p>
    </div>
  );
}

type Status = {
  enabled: boolean;
  autopublish: boolean;
  cadence: { hours: number[] };
  topics: { status: string; total: number }[];
  runs: {
    id: string;
    slot: string;
    topic_id: string;
    status: string;
    error_code: string | null;
    published_urls_json: string | null;
  }[];
  observations: { id: string; kind: string; status: string; checked_at: number }[];
  production?: {
    days: {
      day: string;
      target: number;
      due: number;
      published: number;
      missed: number | null;
      attempts: number;
    }[];
    readyTasks: number;
    viableReadyTasks: number;
    reserveTarget: number;
    sourceHealth?: { available: number; unavailable: string[]; stale: number; missing?: number };
    keywordCoverage: {
      pillar: string;
      readyTasks: number;
      publishedOwners: number;
      zh: string[];
      en: string[];
    }[];
    failureCounts: Record<string, number>;
  };
  productionPolicy?: { reviewRounds: number; attemptsPerSlot: number; modelCallsPerDay: number };
  modelBudgets?: { day: string; model_calls: number; planning_calls: number }[];
  modelUsage?: ModelUsageReport | { status: 'unavailable' };
  state: { last_content_at: number | null; last_health_at: number | null };
};
export default function EditorialOperations({ token }: { token: string }) {
  const [data, setData] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sourceChecksNeeded =
    (data?.production?.sourceHealth?.stale ?? 0) + (data?.production?.sourceHealth?.missing ?? 0);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/editorial', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('内容运营状态暂不可用 / Could not load editorial operations');
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="editorial-operations"
      style={{ border: '1px solid #d3d6c7', padding: 24, margin: '24px 0' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 8px' }}>内容运营 · Editorial operations</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7464' }}>
            生产、质检、发布、搜索检查分别记录。/ Production, review, publication and search checks.
          </p>
        </div>
        <button className="button secondary" onClick={load} disabled={busy}>
          {busy ? '读取中… / Loading…' : '查看运行状态 / Load status'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="editorial-meta">
            <strong>
              {data.enabled && data.autopublish
                ? '自动发布已启用 / Autopublishing on'
                : '自动发布未启用 / Autopublishing off'}
            </strong>
            <span>
              Asia/Shanghai · {data.cadence.hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(' / ')}
            </span>
            <span>每天 3 个双语主题 / 3 bilingual topics per day</span>
            <span>待生产 / Ready: {data.topics.find((t) => t.status === 'ready')?.total ?? 0}</span>
          </div>
          {data.production && (
            <div style={{ margin: '24px 0' }}>
              <h3>产量与覆盖 / Delivery and coverage</h3>
              <p style={{ fontSize: 13, lineHeight: 1.9 }}>
                今日发布 / Published today: <strong>{data.production.days.at(-1)?.published} / 3</strong>
                {' · '}已到期 / Due: {data.production.days.at(-1)?.due}
                {' · '}无近期来源阻断 / No recent source block: {data.production.viableReadyTasks} /{' '}
                {data.production.reserveTarget}
                {' · '}模型请求 / Model requests:{' '}
                {data.modelBudgets?.find((b) => b.day === data.production?.days.at(-1)?.day)?.model_calls ??
                  '—'}{' '}
                / {data.productionPolicy?.modelCallsPerDay ?? '—'}
              </p>
              {sourceChecksNeeded > 0 && (
                <p style={{ fontSize: 13, lineHeight: 1.9, color: '#6b7464', margin: '12px 0 20px' }}>
                  来源记录待核验 / Source checks needed: {sourceChecksNeeded}。
                  上方数量包含可用性尚未重新核实的候选，每篇发布前仍需读取来源。/ The count includes
                  candidates whose source availability has not been rechecked. Sources must be read again
                  before publication.
                </p>
              )}
              <div
                className="editorial-table"
                tabIndex={0}
                role="region"
                aria-label="每日内容交付 / Daily content delivery"
              >
                <table>
                  <thead>
                    <tr>
                      <th>日期 / Day</th>
                      <th>发布 / Published</th>
                      <th>到期 / Due</th>
                      <th>尝试 / Attempts</th>
                      <th>未交付 / Missed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.production.days.slice(-7).map((d) => (
                      <tr key={d.day}>
                        <td>{d.day}</td>
                        <td>
                          {d.published} / {d.target}
                        </td>
                        <td>{d.due}</td>
                        <td>{d.attempts}</td>
                        <td>{d.missed ?? '今日尚未结束 / In progress'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details style={{ marginTop: 18 }}>
                <summary>关键词方向与储备 / Keyword lanes and reserve</summary>
                <p style={{ fontSize: 12 }}>
                  下列为编辑任务与研究假设，不代表搜索量或排名。/ Editorial coverage is not search volume or
                  ranking.
                </p>
                {data.production.keywordCoverage.map((lane) => (
                  <p key={lane.pillar} style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <strong>{lane.pillar}</strong> · {lane.readyTasks} 待写 / ready · {lane.publishedOwners}{' '}
                    已发布主页面 / published owners
                    <br />
                    {lane.zh.join(' · ')}
                    <br />
                    {lane.en.join(' · ')}
                  </p>
                ))}
              </details>
            </div>
          )}
          {data.modelUsage && <ModelUsage report={data.modelUsage} />}
          <div
            className="editorial-table"
            tabIndex={0}
            role="region"
            aria-label="最近内容任务 / Recent editorial runs"
          >
            <table>
              <thead>
                <tr>
                  <th>排期 / Slot</th>
                  <th>选题 / Topic</th>
                  <th>状态 / Status</th>
                  <th>结果 / Result</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <td>{r.slot}</td>
                    <td>{r.topic_id}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.error_code ??
                        (r.published_urls_json
                          ? JSON.parse(r.published_urls_json).map((url: string) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block' }}
                              >
                                阅读 / Read ↗
                              </a>
                            ))
                          : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: '#6b7464' }}>
            失败后自动修补或换题补位，达到预算上限则记录缺口。提交回执不等于收录；爬虫访问不等于 AI 引用。/
            Failed drafts are repaired or replaced within the request budget. Submission is not indexing; a
            crawl is not an AI citation.
          </p>
          <ul>
            {data.observations.slice(0, 6).map((o) => (
              <li key={o.id}>
                {o.kind} · {o.status} ·{' '}
                {new Date(o.checked_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
