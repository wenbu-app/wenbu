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
            质检未通过会顺延。提交回执不等于收录；爬虫访问不等于 AI 引用。/ Failed quality checks defer
            publication. Submission is not indexing; a crawl is not an AI citation.
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
