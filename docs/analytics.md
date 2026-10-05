# 访问与使用统计

2026-10-01。Cloudflare Worker + D1 第一方统计，另接入 Microsoft Clarity 分析公开网页交互。管理入口 `/insights/`；页面 noindex，所有管理 API 要求管理密钥。D1 保存最近 90 天事件明细；私有 R2 保存长期原始事件归档。每小时 UTC 第 15 分钟归档已接收超过一天的事件，仅已归档事件允许从近期表清理。文末提供英文指标与使用说明。

## Microsoft Clarity

生产域名 `wenbu.app` 使用项目 `yqzdf8z0sr` 的官方异步脚本，覆盖中英文公开页面。`/insights/`、`/move/`（及其英文页）、本地预览和已标记测试会话不加载。默认通过 `consentv2` 拒绝广告与统计 cookie 存储，以无 cookie 模式运行；不把第一方 visitor/session 标识、聊天或出生资料发送到 Clarity 的自定义 API。热力图与录屏在 Clarity 项目中查看，不能与本站 PV/UV 直接相加。

工具、Agent 和手记的整个主内容区域使用 `data-clarity-mask="true"`，包含动态生成的内容。统计开关、DNT/GPC 和存储不可用状态共同阻止加载；运行中关闭会调用 `stop`，停止后续交互录制，已经传送的数据不会撤回。统计 cookie 同意始终保持 denied，重新开启也不授予广告 cookie 权限。CSP 仅对脚本、连接和图片放行 Clarity 官方子域与 `c.bing.com`，其余安全约束保留。Clarity 数据由 Microsoft 处理与保留，并不进入本站 D1/R2；遮罩不代表第三方无法处理网络 IP 或页面地址。

参考：[CSP](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp)、[内容遮罩](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)、[Cookie consent API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)。

## 第一次查看后台

1. 打开 `/insights/`，在密码框输入维护者持有的管理密钥。不要把密钥放进网址或截图。
2. 先选最近 7 天，保持“包含测试流量”关闭。看流量来源和进入页，再按语言、设备或活动筛选，避免只看总浏览量。
3. 找到开始操作多、服务端成功少的入口，再检查对应错误与耗时。区分输入错误、限流、用户中断和服务故障。
4. 看“Agent 提问引导”是否有人生成草稿、实际发送并完成回合。选项点击多不等于用户完成了探索。
5. 点击来源、页面、设备榜单中的名称继续筛选；点击顶部指标或曲线图例切换显示指标。用“查看数据”逐时段核对，或导出 CSV / 汇总 JSON。没有记录时先检查范围、筛选项和统计开关，不用演示数字补齐。

使用概览可选 **1 / 3 / 7 / 14 / 30 / 90 天**，按所选时区的日历日期计算并包含今天。默认北京时间（Asia/Shanghai），也可切换 UTC。1 天显示今天 00:00–23:00 的 24 个小时槽；3 天默认 72 个小时槽；7 天及以上默认按天。7 天以内也可手动切换小时/天粒度。自定义日期包含起止两天，限最近 90 个日历日。

尚未到来的小时留空，不伪装成零流量；过去没有事件的时段补零；当前小时/日期标记“尚未结束”。页面明确显示数据截至时刻。当天数据仍在变化，不能与完整一天直接比较。**使用历史和反馈列表仍按截至查询时刻的 N × 24 小时窗口筛选**，不要直接与概览的日历范围对账。AI 额度始终按上海时间零点重置，不随报表时区改变。

## 浏览器、搜索爬虫与 Agent 的区分

新增六个组合筛选：访问者类型、客户端标识、请求用途、分类依据、资源类型、请求方法。原有设备、渠道与引荐维度保持独立：`source=chatgpt` 是引荐；`actor_name=chatgpt_user` 是 UA 声明的访问客户端；`agent_complete` 是问卜产品完成回合。三者不互相推断。

- **浏览器页面浏览 / PV、匿名访客 / UV、会话**：来自网页事件。只计有浏览器特征的新记录，以及旧数据中非 bot 的网页记录。明确识别的自动化和无法识别的新浏览事件不计入这些指标。浏览器特征不保证真人，隐藏 UA 的自动化仍可能被漏分。
- **内容请求**：服务端记录的公开内容 GET 请求，不需要 JavaScript；包含 HTML、知识手册 Markdown/JSON 和 robots、sitemap、llms、SKILL、OpenAPI 等发现文件。保留响应码和耗时，包含重定向及错误。HEAD 单独列示。它不建立 visitor/session，也不增加 PV。服务端引荐只归类当前请求的 Referer/UTM，不推断会话首次来源；进入页记 /other/。已在 Cloudflare 边缘被拦截、未执行 Worker 的请求、图片/脚本资源和后台不在此口径内。
- **搜索爬虫请求**：Googlebot、Bingbot、Baiduspider 等传统搜索抓取；**AI 抓取 / Agent 请求**：AI 搜索、训练和用户委托的抓取合计，可按用途进一步筛选。没有 UA 或可信边缘依据的请求归未知。
- **服务调用**：服务端完成或失败记录，排除 Agent 内部工具阶段。MCP 使用外层 `mcp_finished` 计一次请求，内部计算成功仍计入相应功能成功指标。CLI/MCP 是工具客户端的声明，不代表真实个人身份。

“谁在请求内容”展示类型、客户端、用途、依据、资源和 HTTP 状态。各分类榜单的百分比以当前筛选内的内容 GET 总量为分母，不把客户端事件混进请求量。点击榜单应用筛选，趋势、总数和导出使用同一个已应用快照；CSV 保存时区、截止时间和完整筛选 JSON。明细可查询同样的六个分类字段，窗口仍是滚动 N 天。

分类版本 `1`：名字与用途由有限 UA 签名匹配；UA/客户端头都是可伪装的声明。只有原生 `request.cf.botManagement` 才能提供 Cloudflare verifiedBot、signedAgent 和 score；客户端伪造的同名 HTTP 头不会被采信。评分低于 30 是自动化推断，不能当作已验证身份。签名 Agent 未声明用途时仍标未知；Cloudflare 验证不独立证明 UA 中的厂商名字。边缘没有字段时存 `null`，不假装已核实。未来调整规则时必须增加版本并更新回归矩阵。

旧记录通过新增列默认标为 `legacy / version 0`，不会猜测它属于搜索、AI 或真人。历史静态抓取量没有采集，无法回补。“分类覆盖”显示旧记录、未识别请求、被排除的浏览事件及 CF 证据。不要把升级前后的内容请求曲线当作完整连续流量。

公开请求不保存 IP、完整 UA、URL 参数、正文或新身份指纹，只保留白名单类别、匹配标识、规则版本和可用边缘依据。关闭统计设置不含标识的 `wenbu_analytics=off` 偏好 cookie，使后续网页请求也遵守选择；已接收事件不自动撤回。R2 新归档为 `events/v3/`，保留新增分类列，旧 `v2` 文件仍可下载。

分类依据参考官方文档：[Cloudflare 边缘信号](https://developers.cloudflare.com/bots/reference/bot-management-variables/)、[OpenAI 抓取用途](https://developers.openai.com/api/docs/bots)、[Anthropic 三类客户端](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)、[Perplexity 搜索与用户请求](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)、[Google 抓取基础设施](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers)。

## 看什么

| 维度                                           | 用途                                 |
| ---------------------------------------------- | ------------------------------------ |
| 来源 / medium / campaign / 进入页              | 搜索、AI 引荐、社区和推广入口效果    |
| 页面 / 语言 / 设备 / 浏览器 / 系统 / 国家地区  | 内容与响应式体验                     |
| web / API / CLI / MCP                          | 请求使用的协议或客户端方式           |
| 工具 / Agent 模式 / 入口动作                   | 功能偏好与开始位置                   |
| 服务状态 / 耗时 / 模型调用 / 工具调用 / 产物数 | 完成率、限制、耗时和运行成本代理指标 |

概览支持来源、渠道类型、活动、浏览页面、进入页面、语言、设备、使用方式、功能事件、Agent 模式、浏览器、系统与两位国家/地区代码的组合筛选。测试流量默认排除。修改表单后点击“应用筛选”；时间快捷按钮和图表中的名称会直接应用。已生效条件显示为可移除标签；尚未应用的草稿不会改写旧图表的日期说明。

“功能事件”只保留该工具名的事件，不能代替页面筛选：网页浏览通常没有工具名，要看八字页面的流量，应选“浏览页面 /bazi/”。会话覆盖也只统计筛选后保留的事件，不是把符合某一步的整个会话自动扩展进来。

## 曲线与可视化

- 十个可切换趋势：内容请求、搜索爬虫请求、AI 抓取 / Agent 请求、服务调用，以及页面浏览、匿名访客、访问会话、成功计算、Agent 完成、服务错误。线型与颜色共同区分指标；键盘可逐点读取，也可切换完整数据表。
- 来源、页面和设备使用横向条形图，显示实际数量和占比；默认前五项，可展开全部。分母包含当前筛选的全部类别，不只前五项。
- 24 小时活跃分布把所选日期中的浏览量按钟点累加，用于看活跃时段；多天范围下不是某一天的实际曲线。
- 功能完成、服务结果和会话覆盖分别展示使用、运行结果与行为覆盖。“完成调用”包含示例调用；顶部成功计算指标排除示例，两者口径不同。
- 浏览量、成功计算、完成回合和错误可跨时间槽相加；匿名访客和会话在每个槽内去重，顶部总数在整个范围去重，**不能把逐小时访客/会话直接相加当总数**。

CSV 导出完整时间序列，时间边界为带 Z 的 UTC ISO 时间，未来槽的数值留空。汇总 JSON 另外包含所有生效筛选、时区、粒度和查询截至时刻。所有图表、总数与导出来自同一份报表响应；导出使用当前显示的结果，不使用尚未应用的草稿。

## 事件与口径

浏览器记录：`page_view`、可见时间满 30 秒的 `engaged`、50/90% `scroll_depth`、`cta_click`、`form_started`、`tool_started`、`result_viewed`、`ai_requested`、`ai_result_viewed`、`agent_started`、`agent_received`、`agent_stopped`、`artifact_opened`、`card_inspected`、`source_opened`、`context_opened`、保存/导出及 `client_error`。

服务端独立记录：`agent_tool_finished`（工具阶段的类别、状态与耗时，不含参数、正文或工具输出）、`calculation_succeeded`、`interpret_succeeded`、`agent_finished`、`mcp_finished`、`api_failed`。开始按钮、HTTP 200 或客户端自行上报，都不等同于实际完成。MCP 以真实工具返回为依据，Agent 以最终状态为依据；完成、等用户补充、受限、中断、超时、错误分开。

首页六个 KPI 是浏览、浏览器标识数、访问会话、非示例成功计算、完成的 Agent 回合、服务错误。示例、输入错误、限流和用户中断单列。Agent 一回合可有多次内部工具调用，不能把回合与工具调用相加成“用户人数”。MCP 工具完成在事件明细和性能表单列，不冒充网站转化。

会话覆盖要求同一会话包含访问、开始、服务端成功、保存事件，逐层取交集。它不是严格时间顺序漏斗；异步批量事件可能晚于服务端结果到达，不据此推断先后因果。来自 API、CLI、MCP 的无浏览器会话请求不能计算网页访客转化。

## Agent 提问引导

`guide_opened` 表示第一次选择主题或重新打开引导，`guide_step` 的 value 为 1–3（仅步骤编号），`guide_skipped` 表示转为直接输入，`guide_draft_created` 表示放入草稿，`suggestion_selected` 的 action 区分 clarification / followup。`agent_started` 的 action 区分 guided / clarification / followup / example；自由编辑后若原建议已不完整则归普通对话。

管理员后台的“Agent 提问引导”显示每步操作数和访问会话数。它能定位用户是否停在目标选择、背景补充或草稿阶段；回退和重复编辑都会产生操作，不能直接用次数相除当转化率。发送与实际服务端完成分别统计。测试流量遵循统一排除规则。

不记录选了工作还是关系、不记录选项原文，也不记录背景、对话或出生资料。引导选择在本页完成，直到用户发送后才作为对话内容交给 DeepSeek。

## 推广链接

只接受枚举值，防止私人文本进入统计。完整字典见 `src/lib/analytics-contract.ts`。

示例：`https://wenbu.app/tarot/deck/?utm_source=github&utm_medium=referral&utm_campaign=tarot-deck`。

允许的 campaign：`launch`、`tarot-deck`、`agent-studio`、`bazi-guide`、`developer-tools`、`none`。新增推广活动时先更新字典和测试。未知值归入默认分类，原始查询字符串不落库。一次会话保留首次入口归因，30 分钟无活动后重建。

评估知识手册时，可以比较文章的进入会话、阅读行为和工具入口点击，再检查同一会话是否有真实计算成功。页面/进入页明细不能单独证明一篇文章促成了转化。新文章路径必须加入 `pagePaths` 白名单；未知路径会归 `/other/`，因此不能靠后台补救发布时漏记的路径。

AI 引荐只表示浏览器可观察到的来源类别或约定的 UTM。很多应用不传 referrer，可能落入 direct / other；本后台不能证明某篇文章被模型引用，也不提供搜索排名或全网 GEO 曝光数据。模型调用次数当前来自 Agent 的回合统计，不含单次解读的模型调用明细；它是用量信号，不能当成 DeepSeek 账单。

## 隐私与管理

行为事件不收集问题、出生日期时间地点、命盘、对话正文、笔记、原始 IP、完整 URL、搜索词或自定义任意属性。单独的反馈表保存用户主动提交的文字、评价、可选邮箱；只有勾选并预览后分享的摘录会保存正文。路径经过站内白名单；来源仅分类；国家只保留两位国家代码。随机浏览器标识有效 30 天，不做指纹或跨设备身份合并，不等同于自然人数。

`/privacy/` 可关闭统计；DNT / GPC 自动关闭；浏览器无法使用存储时关闭。关闭时清空待发队列、移除当前标识，此后的服务请求发送 `X-Wenbu-Analytics: off`。已经收到的历史事件不会立即撤回；私有归档长期保存，目前不设自动到期。关闭使用统计不会取消维持服务所需的限流与 AI 额度计数。

API / MCP 可传 `X-Wenbu-Analytics: off`；CLI 用 `WENBU_ANALYTICS=off node wenbu.mjs ...`。不传标识的服务调用只记粗粒度工具状态，不建立隐形用户标识。

生产密钥为 Worker secret `ANALYTICS_ADMIN_TOKEN`。本机生成的副本在项目根目录 `.analytics-admin-token`，权限 0600、Git 忽略。通过密码输入框提交，仅用于 Authorization 请求头；不写网址、localStorage 或公开源码。退出和刷新页面后需重新输入。不要把密钥或原始用户数据贴进问题单。

## 可靠性、规模与限制

浏览器事件写入 IndexedDB outbox，最多 1,000 条、7 天；刷新或重新联网后继续补发，每批最多 10 条，以事件 UUID 在 D1 去重。网络 / 429 / 5xx 使用最长 60 秒的退避，输入错误逐条隔离。队列过期、超量、拒绝会尽力发送 telemetry_gap；浏览器不支持 IndexedDB 时退化为本页内存队列。退出或页面崩溃仍可能丢失尚未写入的事件。收集 API 与工具 API 使用独立限流器，管理员汇总接口也单独限速。统计写入失败不阻止占卜或 Agent 返回；服务端数据库写入失败会发出固定的 WENBU_ANALYTICS_WRITE_FAILED 运维日志信号，不记录异常正文或请求数据。当前没有持久消息队列，数据库不可用期间的服务端事件仍可能丢失；不能把本功能描述为无损计费账本。

公开客户端事件与归因可被模拟，不能用于计费或反作弊；服务端成功事件禁止由收集接口写入。广告拦截、关闭统计、网络故障、机器人会影响覆盖。来源归因是可观察的引荐或 UTM，不是广告平台归因系统。

D1 记录是实际写入而非采样估算；仍有读取 / 写入 / 数据库容量成本和账户限制。后台使用共享筛选的多组查询，当前按 90 天内索引时间窗口汇总，流量增长后应增加按天预聚合、监控 D1 rows_read / rows_written、再决定迁移，不预先承诺无限容量或零成本。查询同时限制事件发生时间和接收时间，避免未来时间戳或查询后才接收的事件混入本次快照。当天无记录时显示空状态，不生成演示数字。

运维与迁移见 [operations.md](operations.md)，上线验证见 [图表与筛选质量记录](reviews/analytics-trends-release.md) 和 [反馈与历史存储质量记录](reviews/feedback-history-release.md)。

## English: using the dashboard

Open `/insights/` and enter the administrator token in the password field. The token is sent in an Authorization header, not stored in the URL or localStorage. Reloading or signing out clears it from the interface. Keep screenshots and public reports free of credentials.

Start with the last seven days and test traffic excluded. Filter by source, registered campaign, language, device or channel, then compare starts with server-recorded outcomes. Review input errors, throttling, cancellations and service failures separately. Export the aggregate JSON with the selected period and filters when recording a finding.

The Overview offers 1, 3, 7, 14, 30 and 90 **calendar days, including today**, in Shanghai time (default) or UTC. One day shows today's 24 hourly slots; three days defaults to 72 hourly slots; longer periods default to daily points. Hourly detail is available for ranges up to seven days. Custom start and end dates are inclusive and must fall within the last 90 calendar days. History and Feedback retain rolling N × 24-hour windows. AI allowances always reset at midnight in Shanghai.

Past empty slots are zero; future slots are blank; the current slot is marked as incomplete. A partial current day is not directly comparable with a complete day. Visitors and sessions are deduplicated within each time bucket and across the full report separately: adding hourly uniques will overcount the period total.

Combine source, medium, campaign, page, entry page, language, device, channel, tool, Agent mode, browser, OS and country filters. Apply pending changes before comparing results; the report's visible labels and exports continue to describe the last applied snapshot. Clicking a ranked source, page, device or tool applies that filter. Tool filters retain tool-labelled events; use the Page filter to measure a tool page's visits.

The trend has six metric toggles, keyboard point navigation and a full table alternative. Ranked bars show counts and shares across all filtered categories, even when only the top five are expanded. The hour-of-day histogram adds views at each clock hour across the selected dates. Service outcomes and completed calls include examples where applicable; successful calculations in the headline metric exclude examples. Session coverage is calculated from the filtered events, not from all events belonging to a matching session.

CSV contains every time bucket with UTC ISO boundaries and blank future values. Aggregate JSON also includes the applied filters, timezone, granularity and query timestamp. Charts, totals and exports use the same response snapshot; draft changes do not relabel an old report.

| Metric                  | What it means                                                             | What it does not establish                         |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Page views              | Browser `page_view` events received                                       | Search impressions or unique people                |
| Visitors                | Distinct random browser IDs with a page view                              | Individuals or cross-device identity               |
| Sessions                | Browser sessions with a page view; renewed after 30 minutes of inactivity | Signed-in accounts                                 |
| Successful calculations | Server-confirmed calculation results, excluding marked examples           | Accepted interpretations or predictive accuracy    |
| Completed Agent turns   | Server `agent_finished` events with status `complete`                     | Independent factual validation of the report       |
| Service errors          | The specified API failures and Agent errors/timeouts                      | Every user input error or intentional cancellation |

The session-coverage view intersects visit, start, success and save events within a session. It is not a strictly ordered funnel: browser events arrive in batches and may reach the server after the corresponding success event. Native API, CLI and MCP calls without browser session IDs do not belong in a website conversion denominator.

Guidance counts show opens, steps, drafts, selections and sends. They do not record the chosen topic, option text or personal background. Backtracking and repeated edits create additional operations, so dividing raw step counts does not produce a valid conversion rate.

## English: attribution and data limits

Only registered sources, media, campaigns, actions and page paths are retained. Unknown article paths become `/other/`; register a new route before release. Current campaign values are `launch`, `tarot-deck`, `agent-studio`, `bazi-guide`, `developer-tools` and `none`. Attribution preserves the first entry of a session. Arbitrary URL queries and search terms are discarded.

### Knowledge library / 知识手册

The library uses `cta_click` with registered actions `library-start`, `library-article`, `library-filter`, `library-search`, `library-view` and `article-next`. Search and filter events include only the numeric result count in `value`. View events use `value: 1` for covers and `value: 0` for the thumbnail list; repeated clicks are operations, not unique visitors or completed reads. Queries remain in the browser; they are not put in the URL or sent with events. All 21 guide paths are registered, including their normalized English equivalents.

知识手册的统计分别记录新手入口、文章进入、主题筛选、搜索、视图切换和后续阅读；筛选与搜索只附带结果数量，不记录输入词。视图切换 library-view 的 value 为 1（封面）或 0（缩略图列表）；重复点击计为操作，不是独立访客。可以结合已有页面、来源、语言与工具使用记录评估路径，但单次点击不等于完成阅读、实际掌握知识或获得准确预测。

AI referral categories reflect an observable referrer or a registered UTM value. Apps can omit referrers, so some visits appear as direct or other. This dashboard does not measure model citations, search rankings or all AI-generated exposure. Recorded model-call totals currently come from Agent turns, not the separate single-reading route, and are not an invoice.

D1 events exclude prompts, birth inputs, charts, conversation text, notes, raw IPs and full referrer URLs. Random browser IDs expire after 30 days. Recent event rows stay in D1 for 90 days; private R2 archives have no automatic expiry. There is no fingerprinting or cross-device identity merge. Infrastructure providers still process request metadata under their own practices.

The privacy page offers an opt-out; the browser also honors DNT/GPC and disables analytics when storage is unavailable. Native clients can send `X-Wenbu-Analytics: off`; the CLI accepts `WENBU_ANALYTICS=off`. Opting out stops subsequent analytics and does not remove required quota controls or immediately erase received events.

Browser events can be blocked, lost or fabricated. Server success events cannot be submitted through the public collection endpoint, but analytics still is not a billing or fraud-detection ledger. QA requests use `X-Wenbu-Test: true`, or the dedicated browser tab sets `sessionStorage['wenbu.analytics.test']='true'` before loading product pages. Test events are excluded by default. See [operations](operations.md) for migration, access and retention procedures.

## 反馈、历史与归档（2026-09-29 升级）

- 页面反馈按钮与工具/Agent 结果评价入口共用私密表单。评价与文字至少有一项；邮箱可选。摘录默认关闭，勾选后可编辑预览。只发送用户实际提交的文本。反馈独立于统计开关，关闭统计时不附带访客、会话、操作或对话 ID。
- `feedback` 表保留评价、类别、正文、可选邮箱/摘录、同意标记、页面、随机关联 ID、状态和版本。当前不自动过期，不复制到事件归档。管理员可标记待查看、处理中、已解决、已归档；状态更新带 revision 防止覆盖其他管理员的更新。“已归档”是处理状态，不是删除。删除请求凭反馈编号由维护者核实后执行 D1 参数化 DELETE，不把私人数据贴到公开 issue。
- 使用历史显示 `occurred_at`（有效客户端时间或接收时间）、`received_at`（服务端接收时间）、`client_at`（原始设备时钟）、`page_id`、`sequence`、`operation_id`、`parent_operation_id`、`conversation_id` 和 schema/release。客户端时间只接受过去 7 天至未来 5 分钟的范围，其他值以接收时间排序但保留时钟诊断。旧事件只能补接收时间，不虚构旧会话的关联或正文。
- 排盘的一次开始、实际服务成功、结果展示和反馈共享 operation ID；AI 解读另建 operation 并关联 parent；Agent 使用 assistant message ID 作为 operation，浏览器会话 ID 与 Agent conversation ID 分开。普通行为按 session/page 关联。随机标识是可伪造的相关性信息，不构成身份或安全边界。
- 新事件还包括 `page_exit`（可见时长）、`setting_changed`（抽牌数量、正逆位、起卦与 Agent 模式）、`feedback_opened`、`telemetry_gap`。反馈数量以 feedback 表实际收件为准，不使用按钮点击代替。
- 每小时最多 5 批 × 500 事件归档，日处理上限约 60,000 条；观察 unarchived 与 oldest_received，持续增长需提高任务吞吐或增加队列。D1 租约防止 cron 与手动任务同时运行；确定性 SHA-256 对象名支持失败重试，上传成功后才事务写 manifest 和精确行标记。归档失败保留原始事件并更新 error 状态。对象没有公开域名或公共读权限。
- 管理端 `/api/admin/events`、`feedback`、`archives` 用带固定查询时刻的 `(time,id,asOf)` 游标分页（默认 50，最多 100）。feedback 详情才返回邮箱和主动分享的摘录。`/api/admin/storage` 显示存储量/积压/上次成功；`POST /api/admin/archives/run` 可补跑一轮，要求管理凭据及同源 Origin。归档通过受保护的 `/api/admin/archive?key=...` 下载。
- D1 最近事件和 R2 归档有重叠。重建历史时必须以 `id` 去重，并按 `is_test=0` 排除测试，再按 occurred_at / page_id / sequence 分析。归档中的设备/国家为接收请求时的近似分类。超过 90 天的查询通过归档离线分析，后台汇总仍限近期。

### 完整导出

在项目目录运行：

```sh
node scripts/export-history.mjs --kind=all --out=/absolute/private/wenbu-export-20260929
```

`--kind=events` 导出最近 90 天全部分页；feedback 默认最近 10 年（当前所有数据均在此范围）；archives 下载所有分页的 manifest 及原始文件并校验 SHA-256。`--days`、`--test=true`、`--operation=UUID` 等可限定明细；归档文件本身不按这些筛选裁剪。脚本读取环境变量 `WENBU_ANALYTICS_ADMIN_TOKEN` 或本地忽略的 `.analytics-admin-token`，不在参数/输出打印凭据。输出路径必须是尚不存在的新目录，避免覆盖旧导出；文件权限 0600，新目录 0700；保存在 Git 目录之外。中断的 `.partial` 不算完成，换一个空目录重跑。Feedback 批量导出不含邮箱/摘录；需要处理具体问题时由后台打开单条详情。

### English: history and feedback

The feedback form stores ratings, notes and an optional email privately. A question/result excerpt is shared only after an explicit choice and editable preview. Feedback works with analytics off, without analytics identifiers. Feedback and private event archives currently have no automatic expiry; private excerpts never enter event archives.

The History tab lets maintainers inspect individual events and follow session, operation, conversation or visitor IDs. Browser events persist in a bounded IndexedDB outbox (seven days / 1,000 entries) for later delivery, with UUID deduplication. Storage failures can fall back to memory; blockers, opt-outs and interrupted writes still limit coverage. Earlier missing or deleted events cannot be reconstructed.

The Archive tab exposes authenticated NDJSON downloads. D1 keeps recent events for 90 days; only rows successfully archived to private R2 can be pruned. Run the export script above to follow every page and verify archive hashes. Combined files must be deduplicated by event ID and filtered for test traffic. Do not treat analytics as a billing ledger or proof of predictive accuracy.

Technical references: [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 querying](https://developers.cloudflare.com/d1/best-practices/query-d1/).

## English: traffic classification

The dashboard separates browser page views from server-observed public content GET requests. Content requests cover HTML, full Markdown/JSON guides and discovery files; they never create visitor/session IDs or add a second page view. HEAD requests and HTTP outcomes are listed separately. Edge-blocked requests, asset files and private pages are outside this measure.

Actor type, declared client, purpose, evidence, resource format and method are separate filters. Traditional search crawlers, AI search/training crawlers, user-triggered fetchers, other automation and tool clients have distinct categories. A ChatGPT referral is not a ChatGPT crawler visit. Wenbu Agent completion remains a product outcome. Tool phases do not inflate service-call counts; an MCP request is counted by its enclosing completion record.

Names are UA declarations and may be spoofed. Browser hints do not prove a human visitor. Cloudflare verified-bot, signed-agent and score evidence is accepted only from Worker metadata, when available. Missing signals remain null. Verification of automation does not independently verify the provider name in a UA. Older rows keep their legacy status, and pre-upgrade crawl traffic cannot be reconstructed. CSV/JSON exports retain the applied filters and cutoff; detail exports and new v3 R2 archives retain classification evidence and version.

## 2026-10-03：测量口径 v2 与概览 / 明细一致性

口径以 `src/lib/measurement-contract.ts` 为唯一计算定义：总览、曲线、维度和导出共享筛选；上海 / UTC 的自然日解析由 `worker/report-range.ts` 提供。默认排除已标记测试。D1 是事件来源，R2 是私有保留归档；Clarity 是另一个第三方观察工具，其接收量不会拿来补齐或冒充 D1。

- **访问浏览器标识**：有 PV 的去重随机 ID，30 天有效，不是自然人数。**完成使用的浏览器标识**：服务器确认非示例计算、解读或 Agent 完成的浏览器 ID；不要求同范围已有 PV。没有可关联 ID 的调用在质量面板单列，不虚构用户。每个时段和渠道分别去重，因此不能相加成为完整范围的去重值。
- **服务调用**：API 终态 / MCP `tools/call` 终态计一次，排除 Agent 内部工具阶段及 MCP 内部计算阶段；正常 MCP 初始化和工具列表不计调用。此前 MCP 计算没有外层收尾，旧数据不能可靠补算。校准后的 MCP SDK 字段验证失败和未知工具也留下失败终态。输入错误、限速、取消、等待补充均与系统错误分开。
- **统计人群**：全部、浏览器（兼容旧非 bot 网页记录）、新分类浏览器、已识别自动化 / 工具、未知、旧数据。人群与 actor/UA/evidence 等是独立条件并取交集，矛盾条件返回空数据。浏览器提示不保证真人；UA 可以伪装。新分类筛选可排除无依据的旧记录，不能重新赋予历史数据更高可信度。
- **采集质量**：收到的客户端 / 服务端 / 内容请求、异常时钟替换、延迟超过 5 分钟、缺关联 ID、客户端报告的丢弃条数。这里只描述已收到记录，不能估计未收到的所有记录或承诺 100% 完整率。
- **明细**：从总览切换使用历史会继承所有维度、自然日起止、时区与 `asOf`；固定快照排除之后接收和未来发生的记录，分页仍按 `(occurred_at,id,asOf)`。修改时间清除固定快照；「回到最新」刷新截止时刻。普通导出只含当前页，完整历史使用受保护的导出脚本。
- **新增归因词汇**：GitHub `open-source-2026`、官方目录 `mcp-registry`、新手 `first-reading`。无已知来源包含真实直接访问和 referrer / UTM 丢失，不能当成准确的直接来源判断。
- **验证请求**：CLI 用 `WENBU_TEST=true`，API 用 `X-Wenbu-Test: true`。浏览器测试在首次导航前同时设置测试 cookie `wenbu_analytics_test=1` 和 sessionStorage 的测试标记；只设置后者无法标记已完成的首次 HTML 请求。初始化会同步一小时测试 cookie，完成后应清除。请求头 / cookie 的测试标记不会被客户端 test:false 覆盖；Clarity 同时检查两种标记。发布 smoke 的所有内容请求均标记测试。CLI 的知识 GET 也遵守 `WENBU_ANALYTICS=off`。

扩展事件或来源先修改闭合 contract、服务端验证、报表定义、UI 标签和真实路径测试。不要添加任意正文或查询字段；保持 archive 版本与旧客户端的兼容。写入失败使用不带请求内容的固定运维日志信号；这些日志不自动进入成功率分母。

Cloudflare 运维日志已开启，仅持久化固定错误信号，关闭 invocation 请求日志与 traces。D1 写入失败可在 Cloudflare 日志中查找 `WENBU_ANALYTICS_WRITE_FAILED`；未将这些错误假设为已收到的产品事件。[Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)。MCP 在解析前被拒绝的请求也计服务终态；正常初始化与列表不计调用。

## Verified accounts (2026-10-05)

The separate account section uses USERDATA, `account-v2`, its own rolling interval/language/test filters, and no joins to anonymous visitor IDs. It reports operational registrations, measurable coverage, signed-result saves, fixed guest cohorts, mature Day 1 / Day 7 activation cohorts, repeat value and cross-instance continuation. Different installation identifiers are not proof of physical devices. Tests and opt-out actions are excluded as labelled, and deleted accounts can reduce historical live cohorts. Email acceptance is not inbox delivery. See [complete definitions and data retention](accounts.md#account-measurement).

Browser prompt views and auth starts are approximate optional events; backend verification, registration and accepted-provider counters are independent. `wenbu.analytics.test` is propagated to a short-lived test preference cookie before subsequent navigation. To mark the first server page request, use `X-Wenbu-Test: true`; setting sessionStorage after a page has already arrived cannot reclassify that earlier request. Preference UI remains in a loading state until the browser setting has been read.
