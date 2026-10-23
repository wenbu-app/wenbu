# IndexNow 自动提交 / Automatic URL notifications

问卜通过 IndexNow 通知搜索引擎：哪些公开页面已经新增、更新或删除。提交使用主域名 `https://wenbu.app`，只包含 sitemap 中可索引的 HTML 页面。后台、私人手记、迁移页面、API、MCP、查询参数和知识手册的重复 Markdown/JSON 版本不进入清单。

## 何时自动运行

- Cloudflare Cron 每天北京时间 22:30（UTC 14:30）检查当前部署的公开页面，覆盖当天 09:00、15:00、21:00 的文章。服务端用 D1 的 `last_scanned` 限制两次实际扫描至少相隔 24 小时，包括没有内容变化的检查。
- `npm run deploy` 不再额外提交。旧脚本的 `--after-deploy` 参数仅查询状态；关闭本地终端不会取消 Cloudflare 的日检查。文章漏跑检查保留独立的 15 分钟触发，不调用 IndexNow。
- 比较正文、相关元数据与目标链接的 SHA-256 指纹，仅发送新增、实质更新和删除；共享 CSS 或导航变化不重新推送全站。动态文章也来自同一个已提交版本。
- 正常每批最多 10 个地址，连续失败后最多 1 个；剩余变化保留到后续日检查。成功和失败均至少等待 24 小时；服务器给出更长的 `Retry-After` 时继续遵守，不重置既有退避或失败记录。
- 连续 429 的恢复等待依次为至少 24、48、72 小时，之后保持 72 小时；服务方给出的更长等待仍优先。每天仍检查是否到期，不在暂停期内发送请求。未尝试的地址优先，近期发布的中英文版本优先于旧更新；失败地址按最早尝试时间轮转，避免一个旧 URL 占住每次单地址恢复探测。
- `wenbu-indexnow` Cloudflare Workflow 执行日任务。若前一天启动或补跑较晚，到期点在未来 24 小时以内时持久等待再执行，避免因几秒或十几分钟的偏移而跳过整天；更长的服务方暂停留给后续日触发，避免积累多个长睡眠实例。通知步骤不自动重试，D1 锁与日间隔仍是最终保护。

The build produces a deterministic manifest from the same indexable pages as the sitemap. The Worker reads it through the deployed asset binding, merges committed bilingual publications, compares substantive fingerprints with D1 and posts only additions, changes and removals. The daily trigger is independent of editorial reconciliation and analytics maintenance. Builds, deployments, tests and pull-request checks do not send an extra notification. A persisted 24-hour scan minimum also protects against duplicate triggers or repeated operator commands.

## 数据与凭证

根目录的 UTF-8 验证文件由 `src/data/indexnow.json` 生成；它是网站所有权验证文件，必须公开可读取。IndexNow 的验证 key 不能用于登录后台，也不复用模型密钥或管理员密码。修改 key 时，必须同步部署配置与验证文件。

新增的 D1 表与使用统计、反馈及归档维护相互独立：

| 表                     | 保存内容                                                  |
| ---------------------- | --------------------------------------------------------- |
| `indexnow_pages`       | 最后收到 HTTP 200 / 202 的公开 URL 与 HTML 指纹           |
| `indexnow_submissions` | 每次尝试的时间、清单版本、地址列表、数量、HTTP 状态与结果 |
| `indexnow_state`       | 上次检查与实际扫描时间、错误代码、重试时间与并发锁        |

新增的 `pending_count` 只在实际扫描后更新；尚未扫描时是未知，不能当成零。回执的 `diagnostics_json` 记录固定服务端响应的允许列表头、接收时间及最多 800 字符的拒绝摘要，读取上限 4 KiB。所有权 key、邮箱和 Bearer 内容经过脱敏；不保存 cookie。服务方返回的内容始终是诊断数据，不是操作指令。旧回执缺少诊断时保持为空，不能反推具体限流原因。

不读取对话、出生资料、访问者 ID 或反馈文本。D1 的提交记录不进入公开 API。管理员查询继续使用现有认证、限流、`no-store` 与 `noindex` 响应。

A five-minute D1 lease prevents overlapping jobs. A single D1 transaction stores each receipt and advances the fingerprints only for HTTP 200 or 202. Failed batches remain eligible for retry. Delivery is **at least once**: if the service receives a request but the Worker loses its response or fails before persisting it, a later retry can repeat those URLs. This is preferable to silently dropping an update.

## 运维与排查

首次部署本功能前应用新增迁移；后续常规发布不需要重建任何表：

```sh
npx wrangler d1 migrations apply wenbu-analytics --remote
npx wrangler whoami
npm run deploy
npm run indexnow:status
```

需要明确补跑时使用 `npm run indexnow:submit`。它仍遵守 24 小时扫描间隔、并发锁、去重和退避，不提供跳过核对、强制重提全站或任意 URL 参数。日常巡检只用 `indexnow:status` 读取状态，不触发页面扫描或通知。

维护脚本从 `WENBU_ADMIN_TOKEN`、`WENBU_ADMIN_TOKEN_FILE`，或已有的忽略文件 `.analytics-admin-token` 读取凭证。不要把凭证放进命令参数、文档或 Git。定时任务在 Worker 内直接运行，不需要这些本地环境变量。

- `GET /api/admin/indexnow`：最后检查状态、已接收页面数与最近 20 次提交记录摘要。
- `POST /api/admin/indexnow/run`：立即检查当前部署。需要管理员认证、主域名及匹配的 `Origin`；请求方不能指定提交地址。
- `npm run audit:indexnow`：检查 sitemap 一致性、HTML 指纹、私有路由排除及验证文件；已加入 `npm run verify` 和 GitHub CI。

### 区分出口、验证抓取与 URL 通知

`node scripts/indexnow.mjs --diagnose` 仅派发一次受管理员认证和主域名 Origin 保护的生产 Workflow 诊断。每个 UTC 日期使用同一实例 ID，不新增定时器、不重试诊断步骤。它以通知器相同的 User-Agent 执行四个固定读取：无参数、无 key、无请求体的 IndexNow **HEAD**、公开验证文件 **GET**、Cloudflare trace **GET**、AWS checkip **GET**。不发送 URL 通知，也不改变原有 `retry_at`、失败计数、扫描时间或提交回执。

`node scripts/indexnow.mjs --diagnostic-status` 只读取持久结果和验证文件访问计数。两个 IP 回显服务所见的 IP 仅属于各自目的站的观察，不能当成 IndexNow 所见出口；Cloudflare 站点可能展示跨 zone 的 Worker 身份，而非外网出口。HEAD 返回 405 只能说明这种方法未被统一拒绝，不能证明 POST 配额恢复。Worker 与本机对照必须使用相同方法和 User-Agent，并注明时间。未知、重复或位置参数直接报错，不再因误写 `status` 而进入通知路径。

读取 Cloudflare Flags 时，`cache.crawlhints_enabled` 是 Crawler Hints 的启用值，`cache.crawlhints_card` 是入口显示标记；字段未返回时记为 unknown。分别核对主域和旧别名所在 Zone。旧 Zone 开启该功能不能单独证明它向主域重复提交了 URL；修改 Zone 级开关还会影响其中其他主机，需按实际提交来源与站点范围判断。

验证文件的 GET/HEAD 保持原始响应，异步记录独立的运维数据，不计入访客/PV。每小时保留请求总数、200 数量和前 32 条有限元数据，保留 30 天。样本仅含时间、方法、状态、UA 声称的来源分类及可用的 Cloudflare ASN/colo/verifiedBot；不存 key、原始 UA、IP、查询参数、cookie 或访客身份。超出 32 条后计数仍累加，不能把样本当成完整来源明细。缺失的 verifiedBot 是 unknown，不能当作 false；UA 声称 Bing 也不能自行证明来自 Bing。

这份日志仅覆盖已经到达 Worker 的请求，WAF 提前阻断或 Worker 日志之前的历史需要另查 Cloudflare Analytics，并记录时间窗、数据保留范围、采样和查询上限。数据表由 `0010_indexnow_observability.sql` 创建；诊断结果限管理员读取，原始运营证据不得提交公开仓库。

| 状态                            | 含义 / Meaning                                                     |
| ------------------------------- | ------------------------------------------------------------------ |
| `submitted` / HTTP 200          | 接口成功收到这批 URL；不代表已经收录                               |
| `pending_validation` / HTTP 202 | 已收到 URL，所有权验证仍待完成；保留原始回执，不把它改写为成功验证 |
| `unchanged`                     | 当前页面与上次收到的内容相同，没有再次请求 IndexNow                |
| `retrying`                      | 网络、协议、静态资源或存储失败；查看 `last_error`、`retry_at`      |
| `backoff`                       | 尚未到重试时间，没有向 IndexNow 发请求                             |
| `daily_wait`                    | 距上次实际扫描不足 24 小时，未读取资源清单或向外提交               |
| `busy` / `lease_lost`           | 已有任务运行，或本轮失去锁；后续任务会继续核对                     |

HTTP 202 已表明接收，不会重复推送同一批未变页面。IndexNow 没有用于查询某批验证结果的回执 API；如需核实后续状态，在 Bing Webmaster Tools 检查，后续内容变更也会留下新的提交回执。

Cloudflare 的 Cron 配置传播可能需要几分钟。`last_scanned` 记录实际扫描的开始时间，提交回执证明是否尝试通知；仅有 Cron 配置不能证明已运行。迁移从最近一次通知尝试保守初始化扫描时间，不删除历史回执或改写 `retry_at`。暂停 IndexNow 时只移除 `30 14 * * *`，保留文章补位、发布与每小时归档任务。

每天的实例 ID 为 `indexnow-YYYY-MM-DD`（北京时间日期），重复派发同一实例不会重复执行通知。状态中的 `needsProviderReview` 表示需要核查持续拒绝，不能解读为所有权文件错误或已修复服务端限流。排查顺序是实际请求时间和地址、验证文件公开可达性、robots/canonical、Bing 接收报告、响应头和拒绝摘要；不要通过换 key、地址、IP 或参与者接口绕过暂停。若服务方仍不提供原因，保存日期和 request ID，明确记录服务端原因尚未确认。

### Cron 派发证据

Worker 使用固定元数据日志记录 `wenbu_cron_received`，并分别记录 IndexNow 的 `indexnow_cron_enqueued`、`indexnow_cron_direct_result` 或 `indexnow_cron_dispatch_failed`。记录只包含 Cron、计划时间、固定实例 ID、结果状态或错误类型与数字代码；不序列化请求、环境或异常正文。自动请求调用日志可以保持关闭。

`enqueued` 只证明创建 Workflow 的调用返回成功，实际启动、通知回执和收录仍分别核对。派发失败保留原始异常的失败语义，不自动重试或改走其他发送路径。这些日志不补写部署前的历史，也不能解释服务方 429 的具体原因。

## 收录与效果的边界

IndexNow 是更新通知协议。提交回执、搜索引擎抓取、实际收录、排名及流量是不同状态，不能互相替代。一次提交会在采用该协议的搜索引擎间共享，无需给每个参与者重复提交同一批地址。

Protocol references: [Bing integration instructions](https://www.bing.com/indexnow/getstarted#implementation), [IndexNow documentation and response codes](https://www.indexnow.org/documentation). Checked 2026-10-01.
