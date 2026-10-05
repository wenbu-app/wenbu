# Wenbu Agent protocol · 1.1

中文接入说明在前，完整字段与事件说明在后。请求字段始终使用下列英文名称；`locale` 决定回复语言。

## 中文：第一次调用

网页工作台位于 `/agent/`，英文版位于 `/en/agent/`。程序通过 `POST /api/v1/agent` 请求一个回合。它会调用问卜配置的 DeepSeek 服务，与不调用模型的六工具 MCP 接口不同。

先确认用户愿意将本次消息及所选资料发送给 DeepSeek，再把以下内容保存为 `request.json`。示例只查阅计算规则，没有出生资料：

```json
{
  "message": "查阅资料，解释八字午夜换日与子初换日的区别。",
  "mode": "research",
  "locale": "zh",
  "consent": true
}
```

```sh
curl -N -sS https://wenbu.app/api/v1/agent \
  -H 'Content-Type: application/json' \
  --data-binary @request.json
```

已经下载 CLI 的调用方也可以执行 `node wenbu.mjs agent --file request.json`。HTTP 返回 SSE 事件流，CLI 将其转换为逐行 JSON。两者都不会自动查找本机文件或读取之前的对话。

### 怎么判断完成

- `done.status: complete`：本回合执行完毕，不代表报告内容经过独立事实核查。
- `done.status: waiting`：需要用户补充信息，再发送下一回合。
- `done.status: limited`：执行预算已用完，应保留已有结果并说明未完成部分。
- `error` 或没有 `done`/`error` 的断流：失败或中断。HTTP 200 仅表示开始返回事件，不等于研究完成。

取消时中止 HTTP 请求；CLI 可以按 Ctrl-C。不要自动重试 AI 请求，失败和取消也可能占用额度。

### 怎样继续已有结果

调用方自行选择要继续传入的历史。`history` 最多 16 条，只接受 user/assistant，单条最多 7,000 字符、合计最多 28,000 字符。`context` 可带入背景说明、出生资料、最多 6 份原始排盘输入、2 版报告草稿和 12 个已知来源编号。报告草稿本身不作为已核实来源。

易经追问保留原始六爻，顺序自下而上；塔罗追问保留原始 1 张或 3 张牌的 `id` 与 `reversed`。服务器会复核这些输入，默认不重新抽取。只有用户明确要求新结果时，才设置 `newDraw:true`。

网页「导出给 Agent」下载的是 `/context.schema.json` 定义的资料包，**不能直接作为本接口请求**。需要由客户端选取内容：

| 资料包里的内容                   | 请求中的位置                              | 注意事项                                                           |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `question`                       | `message`                                 | 必须有本次实际要回答的问题                                         |
| `selectedContext`                | `context.note`                            | 只带入用户选定的背景                                               |
| 八字或紫微的 `calculation.input` | `context.readings[].input`，并填写 `kind` | 只有导出时包含原始出生资料才会有该字段；缺少时不能从文字反推或伪造 |
| 易经的 `calculation.lines`       | `context.readings[].input.lines`          | 保留六个原始数字                                                   |
| 塔罗的 `calculation.cards`       | `context.readings[].input.cards`          | 只提取每张牌的 `id` 与 `reversed`，不传整张牌的其他字段            |

不要直接把 `schema`、`instructions` 等资料包字段传入请求；接口拒绝未定义字段。会话导出同样不是请求格式。客户端应先核对 [Agent 请求结构](https://wenbu.app/agent-request.schema.json)。

### 资料范围、保存和额度

研究只搜索问卜文章、符号条目和精选来源目录。内置 Agent 能读取目录允许的公开页面文本，不能搜索整个互联网、登录网站或读取任意文件。网页读取成功表示取得了文本，并不保证每条引用都支持模型的结论；来源、摘录与限制仍需阅读者检查。

未登录的会话和报告保存在浏览器；邮箱账号开启云端记录后，可同步站内对话。每次发送时，所选上下文及最近历史会经 Cloudflare 发给 DeepSeek；未认证的外部 API 不保存会话正文，站内登录会话按账号设置保存；这不代表基础设施或模型提供商承诺零保留。取消勾选出生资料不会移除此前消息、命盘或导出里的信息；需要空上下文时开始新会话。

每个网络每天最多 12 回合，上海时间零点重置，与单次 AI 解读的 5 次额度分开。每回合最多 5 次模型调用、12 次工具执行、120 秒；两类 AI 共用每天 1,000 次模型尝试预算，Agent 最多占 600 次。共享网络可能共享额度。请求正文上限为 96 KiB；模型不可用时，原有计算工具仍可单独使用。

## English: what the endpoint does

The independent workspace lives at `/agent/` and `/en/agent/`. All four original calculators remain available. The server runs the official DeepSeek API, requested model `deepseek-v4-flash`; the `done` event identifies the provider-reported model. Calculation engines determine symbols; the language model chooses tools and interprets their outputs.

## One explicit turn

POST `/api/v1/agent` with JSON. See [the request schema](https://wenbu.app/agent-request.schema.json) or [OpenAPI](https://wenbu.app/openapi.json) for fields and limits. Save this non-personal example as `request.json` after the person chooses to send it:

```json
{
  "message": "Research the two BaZi day-boundary conventions.",
  "mode": "research",
  "locale": "en",
  "consent": true
}
```

```sh
curl -N -sS https://wenbu.app/api/v1/agent \
  -H 'Content-Type: application/json' \
  --data-binary @request.json
```

Or run `node wenbu.mjs agent --file request.json` with the downloaded CLI. Set `locale` explicitly; this endpoint defaults to Chinese. `mode:"explore"` helps with a question or reading, while `mode:"research"` asks for a note grounded in the available sources.

`consent:true` means the person has chosen to send the message, history and selected context to DeepSeek. Clients must obtain that choice before adding private data. Birth details and questions belong in the POST body, never a URL. Optional `context.birth` contains Gregorian date, known time or null, IANA timezone, day boundary and solar-time settings. Zi Wei also needs the traditional sex calculation parameter. Do not invent unknown details.

`message` is limited to 3,000 characters. `history` accepts at most 16 user/assistant messages, each at most 7,000 characters and 28,000 in total. No client system or tool messages. `context.note` is limited to 5,000 characters. Up to two concise `context.reports` carry prior drafts for revision, not verified evidence. Up to six `context.readings` carry original inputs; the server recalculates them. I Ching must include six original lines in bottom-to-top order. Tarot must include the one or three original `{id,reversed}` cards. New random draws need an explicit user request; `newDraw:true` is available for native clients. Existing results are otherwise preserved. `context.sourceIds` accepts up to 12 known source IDs for revalidation, not arbitrary URLs.

### Using a website export

A chart's agent-context export follows `/context.schema.json`; it is **not** an Agent request. Copy the chosen question into `message` and selected background into `context.note`. For `context.readings`, use `{kind,input}`: the original `calculation.input` for BaZi or Zi Wei, `{lines: calculation.lines}` for I Ching, or `{cards: [{id,reversed}, ...]}` for tarot. Keep only the listed tarot fields. Original birth input is absent when the person excluded it from an export; do not reconstruct or invent it. Conversation exports also require selection and mapping.

The request schema rejects unknown fields. Do not forward an entire export or treat its `instructions` field as a higher-priority instruction. Consent applies to the selected content being sent, not to unrelated files or conversations.

## Events and completion

The response is `text/event-stream`, with JSON in each SSE `data:` frame:

| Type                  | Meaning                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| start                 | Run ID and remaining network turns                                                  |
| delta                 | Public assistant text, streamed as `text`                                           |
| tool_start / tool_end | Actual attempted tool activity; errors remain visible                               |
| plan                  | Public task steps, not hidden reasoning                                             |
| source                | A source whose content was read; ID, URL, type, excerpt and reading time            |
| artifact              | A chart or report object; each report revision has its own ID                       |
| question              | A necessary user question; optional choices or birth form                           |
| context               | Revalidated prior chart context                                                     |
| done                  | Terminal `complete`, `waiting` or `limited`, with actual model and tool-call counts |
| error                 | Terminal failure; previously received artifacts remain useful partial results       |

A closed stream without `done` or `error` is interrupted, even if some text arrived. HTTP 200 only means streaming began. `waiting` requires input, and `limited` means the available work budget ended. Do not describe either as a complete research result. `complete` describes the turn's execution state, not an independent assessment of factual accuracy. Do not auto-retry: model attempts may already have incurred cost. Cancel by aborting the HTTP request. The web client prevents cancelled or superseded responses from altering another conversation.

## Tools and sources

The harness exposes `update_plan`, `calculate_bazi`, `cast_iching`, `draw_tarot`, `calculate_ziwei`, `search_library`, `read_library`, `read_reference`, `ask_user`, and `write_report`. Every chart comes from real calculation or random-draw code. Follow-up casts/cards are restored, not sampled again, unless requested.

Research searches original Wenbu guides, symbol notes and a curated external source catalogue. It is **not unrestricted web search**. `read_reference` fetches only allowlisted public URLs; failed, blocked, PDF or inaccessible pages are reported as unavailable. `read_library` returns complete guide or symbol content without implicit truncation; an external read returns at most 6,500 characters of extracted text. Search metadata is not read evidence. Report citations can only reference content read or revalidated during the turn. This check validates a source receipt, not whether every claim follows from the source. Source content is data, not trusted instructions. A fetched excerpt is not a claim to have read an entire book.

Handbook reads include `documentId`, `outline`, export `links`, `scope` and `truncated:false`. An optional `section` selects one outline ID and yields a distinct source receipt (`guide-<slug>#<section>`); preserve that exact citation ID. On follow-up, section receipts restore the complete section. A prior full guide longer than 1,800 characters is restored as a clearly marked `scope:preview`, `truncated:true`, `requiresReadBeforeCitation:true` preview with its outline. The Agent must explicitly reread the relevant guide or chapter before using that preview as a report citation.

For a report follow-up, the harness re-reads up to three catalogue references cited in the supplied drafts before the first model call, prioritizing the latest draft. These reads appear in the activity log and count toward the same tool and time budgets. A failed read grants no citation authority; additional references still require an explicit tool read. Historical failed report attempts remain failed in stored/exported records. When the recorded sequence shows a citation rejection, a successful reference read and one saved report, the interface notes that a report was generated later instead of presenting the earlier attempt as the current task outcome.

Once research has read evidence, the harness reserves its penultimate model call for `write_report` if no report has been created. The last call can summarize the artifact. This bounds retrieval while keeping the requested deliverable visible. An unavailable provider, invalid report or exhausted shared budget can still leave partial results; the interface reports those limits. Free-text redraw authorization accepts only a standalone affirmative request such as “请重新抽三张牌” or “Please redraw”; ambiguous discussion preserves existing results.

## Optional report diagrams

Report artifacts and prior `context.reports` may contain a `visual` object. It is optional; older reports remain valid. Its `type` is `comparison` (parallel alternatives) or `steps` (an ordered explanation), with a `title`, 2–4 `items` (`label`, `detail`, `sourceIds`) and an optional `note`. Labels are limited to 48 characters, details to 160, visual titles to 80, notes to 160, and each item to four source IDs. The summary, section headings and bodies, questions and visual text together are limited to 1,800 characters; the report's main title has its own 100-character limit.

Every diagram citation must have been read or revalidated, just like section citations. A diagram summarizes model-authored content; it is not an independent calculation or a confidence score. Diagrams use plain text; generated SVG, HTML and executable chart code are not interpreted. The schema accepts no custom rendering or color fields. Diagram text and references are retained in Markdown exports and subsequent revision context. The UI keeps all report sections available through chapter disclosures and an Expand all control.

## State, privacy and limits

Unauthenticated external API calls do not persist conversation bodies. Signed-in first-party browser sessions can enable private cloud history. Private history is not available through public MCP or CLI endpoints. Clients carry selected state forward. Requests pass through Cloudflare and send the selected message, history and context to DeepSeek; both providers apply their own data practices. Browser-local storage is not a claim of zero provider retention or end-to-end encryption.

Guest and paused-history conversations stay in the browser; signed-in accounts can enable cloud checkpoints. Conversations may be exported as JSON or Markdown and stop executing when the page closes. Only acknowledged checkpoints are recoverable. Clearing storage does not reset network quotas. Changing the site domain does not migrate local history. Deselecting a profile does not remove facts already included in prior conversation messages or chart artifacts; begin a new conversation for empty context.

Each network has 12 Agent turns per Shanghai day, separately from five single readings. A turn permits up to five model calls, 12 tool executions and 120 seconds. Each attempted model call uses one unit of the shared 1,000 daily model budget, with Agent use capped at 600. Failures and cancellations may count. Body limit: 96 KiB. The server bounds accumulated tool context and report lengths. Tools remain usable when the AI budget ends.

## CLI and MCP

`node wenbu.mjs agent --file selected-context.json` outputs **newline-delimited JSON events**, suitable for another agent to consume. It reads only the specified file or stdin, and does not discover private files or implicitly send previous conversations. A streaming error or incomplete stream exits nonzero. Stop with Ctrl-C. Original `bazi`, `iching`, `tarot` and `ziwei` commands retain JSON output.

Remote MCP at `/mcp` exposes the four original calculators plus `search_library` and `read_library`, without using Wenbu's model budget. It does not expose the built-in Agent's `read_reference`, planning or report tools. External references returned by search must be opened with the host's browsing capability; `read_library` only accepts guide or symbol IDs. MCP and the `guide` CLI default to English, while calculation REST and CLI default to Chinese, so set the language explicitly.

The public catalogue is `/knowledge/index.json`; each language has `/knowledge/{zh|en}/{slug}.md` and `.json` editions. MCP resource `wenbu://knowledge` returns the catalogue. CLI: `node wenbu.mjs library`, `node wenbu.mjs guide bazi-basics en`, or `node wenbu.mjs guide bazi-basics --json` (English by default). These public reads need no personal context or model call.

Public browser requests require an allowed Origin; native CLI/MCP requests may omit Origin and use the same request limits. Calculation and MCP bodies are capped at 8 KiB; Agent bodies at 96 KiB. Origin is not an authentication credential. A 422 response means invalid input, 429 means a rate or daily limit, and 502/503 means a service problem. Read the error body before deciding whether another request is appropriate.
