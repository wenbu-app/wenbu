import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
type Report = {
  available: boolean;
  version: string;
  trial: { completed: number; registered: number; saved: number; mature: number };
  continued: { repeat_value: number; cross_instance: number };
  exclusions: { tests: number };
  from: number;
  to: number;
  totals: { registered: number; measured: number; activated: number };
  cohorts: { day: number; eligible: number; returned: number }[];
  daily: { day: string; registered: number; activated: number }[];
  delivery: { event: string; count: number }[];
  legacyImportAccounts: number;
};
const labels: Record<string, string> = {
  code_requested: '验证码请求',
  provider_accepted: '邮件服务已接收',
  send_failed: '发信失败',
  send_unknown: '发送状态未知',
  email_verified: '邮箱验证成功',
  account_created: '账号创建事件',
};
export default function AccountInsights({ token }: { token: string }) {
  const [days, setDays] = useState('7'),
    [locale, setLocale] = useState('all'),
    [test, setTest] = useState(false),
    [version, setVersion] = useState(0),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setReport(null);
    void fetch(
      `/api/admin/accounts/analytics?days=${days}&locale=${locale}&test=${test ? 'include' : 'exclude'}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: abort.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error('账号统计暂不可用，请稍后刷新。');
        return r.json() as Promise<Report>;
      })
      .then(setReport)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [token, days, locale, test, version]);
  return (
    <section className="account-insights" aria-labelledby="account-insights-title">
      <div className="account-insights-heading">
        <div>
          <span className="eyebrow">VERIFIED ACCOUNTS</span>
          <h2 id="account-insights-title">从试用到持续使用</h2>
        </div>
        <button className="text-button" onClick={() => setVersion((v) => v + 1)}>
          刷新账号数据
        </button>
      </div>
      <p>独立统计已验证邮箱账号。下方筛选只作用于本区，不与浏览器、爬虫或渠道访问量混算。</p>
      <div className="account-insights-filters">
        <label>
          观察区间
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            {[1, 3, 7, 14, 30].map((d) => (
              <option value={d} key={d}>
                最近 {d} 天
              </option>
            ))}
          </select>
        </label>
        <label>
          注册时的语言
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="all">全部语言</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
          包含标记为测试的账号
        </label>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !report ? (
        <p role="status">正在读取账号数据…</p>
      ) : !report.available ? (
        <p>账号统计尚未启用；暂不显示为 0。</p>
      ) : (
        <>
          <div className="account-insights-metrics">
            {[
              ['验证注册', report.totals.registered, '所选区间新建账号，含关闭统计的账号'],
              ['可测量账号', report.totals.measured, '已允许使用统计的新账号'],
              ['首次有效保存', report.totals.activated, '可测量账号中，注册 24 小时内保存有效结果'],
              ['旧记录导入账号', report.legacyImportAccounts, '导入单列，不代替激活'],
            ].map(([label, value, detail]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <p>
            统计版本 {report.version} · Asia/Shanghai · 可测量覆盖{' '}
            {report.totals.registered
              ? `${Math.round((100 * report.totals.measured) / report.totals.registered)}%`
              : '暂无注册样本'}{' '}
            · {test ? '包含' : '排除'} {report.exclusions.tests} 个测试账号
          </p>
          <div className="account-insights-metrics">
            {[
              ['完成试用的游客', report.trial.completed, '首次完成在观察区间内；有服务端凭据且允许统计'],
              [
                '7 天内注册 / 保存',
                `${report.trial.registered} / ${report.trial.saved}`,
                `同一批游客；${report.trial.mature} 个已完成 7 天观察期`,
              ],
              ['激活后再次使用', report.continued.repeat_value, '注册队列中，激活后又完成新操作的账号'],
              [
                '跨浏览器实例继续',
                report.continued.cross_instance,
                '注册队列中，在另一实例读回旧记录并完成新操作；不等于设备数',
              ],
            ].map(([label, value, detail]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          {report.daily.some((d) => d.registered > 0) ? (
            <div className="account-insights-chart">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={report.daily} margin={{ top: 15, right: 18, bottom: 5, left: -15 }}>
                  <CartesianGrid stroke="#dfe3d5" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v) => String(v).slice(5)} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    name="验证注册"
                    type="linear"
                    dataKey="registered"
                    stroke="#52735c"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    name="首次有效保存"
                    type="linear"
                    dataKey="activated"
                    stroke="#ba7050"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p>这个区间还没有新注册账号。</p>
          )}
          <table>
            <caption>按激活日分组的回访 · 只看完成观察期的账号</caption>
            <thead>
              <tr>
                <th>观察窗口</th>
                <th>成熟样本</th>
                <th>完成新操作</th>
                <th>回访率</th>
              </tr>
            </thead>
            <tbody>
              {report.cohorts.map((c) => (
                <tr key={c.day}>
                  <td>第 {c.day} 天</td>
                  <td>{c.eligible}</td>
                  <td>{c.returned}</td>
                  <td>{c.eligible ? `${((100 * c.returned) / c.eligible).toFixed(1)}%` : '尚无成熟样本'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>口径、覆盖范围与邮件发送</summary>
            <p>
              首次有效保存须有服务端结果凭据。注册前 7
              天内的有效试用结果可计入，旧浏览器记录导入不可计入。回访要求完成一次新操作，不把打开页面或查看历史算作使用。
            </p>
            <p>
              注册与激活各自按所选滚动区间取队列；回访使用激活日后的上海时间自然日。曲线按注册日分组；邮件计数按上海自然日。删除账号会从这些实时分组中移除。关闭统计的账号不进入激活或回访分母，未成熟样本不显示为
              0%。“邮箱验证成功”是验证次数，可能包含同一账号的再次登录。
            </p>
            <p>
              邮件服务已接收不代表邮件进了收件箱。目前未将收件箱投递率列为已知指标。统计关闭期间的操作不会在重新开启后补算；跨实例使用独立随机标识，不与匿名访问标识关联。
            </p>
            <div className="account-delivery-counts">
              {report.delivery.map((d) => (
                <span key={d.event}>
                  {labels[d.event] || d.event} <strong>{d.count}</strong>
                </span>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
