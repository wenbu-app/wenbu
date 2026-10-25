import { useState } from 'react';
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
  state: { last_content_at: number | null; last_health_at: number | null };
};
export default function EditorialOperations({ token }: { token: string }) {
  const [data, setData] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
                {' · '}来源可用的待写任务 / Source-viable tasks: {data.production.viableReadyTasks} /{' '}
                {data.production.reserveTarget}
                {' · '}模型请求 / Model requests:{' '}
                {data.modelBudgets?.find((b) => b.day === data.production?.days.at(-1)?.day)?.model_calls ??
                  '—'}{' '}
                / {data.productionPolicy?.modelCallsPerDay ?? '—'}
              </p>
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
