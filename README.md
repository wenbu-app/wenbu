# Wenbu · 问卜

免费排盘、抽牌与查阅资料，把结果变成可以继续思考的问题。

Free charts, tarot and source-based learning for a question you want to explore.

[中文网站](https://wenbu.app/) · [English website](https://wenbu.app/en/) · [知识手册](https://wenbu.app/learn/) · [Documentation](docs/README.md)

## Open source / 开源接入

[![Wenbu preview](https://wenbu.app/og.png)](https://wenbu.app/?utm_source=github&utm_medium=referral&utm_campaign=open-source-2026)

[MCP quickstart](integrations/mcp/README.md) · [CLI](integrations/cli/README.md) · [Agent Skill](skills/wenbu/SKILL.md) · [Releases](https://github.com/wenbu-app/wenbu/releases) · [Contribute](CONTRIBUTING.md)

[Official MCP Registry record · app.wenbu/mcp](https://registry.modelcontextprotocol.io/v0.1/servers/app.wenbu%2Fmcp/versions/latest). Domain ownership is verified; this directory record does not imply endorsement or an installation. 官方目录登记已完成，可核对远程地址、版本与源码。

Connect remote MCP at `https://wenbu.app/mcp`, use the dependency-free CLI, or install the Skill from `skills/wenbu/`. Read the [integration guide](integrations/README.md) to choose a connection and run a reproducible example. The full application and integrations are MIT licensed. This is a public repository, not an anonymous-data or feedback export.

## 第一次用，从这里开始

| 你想做什么               | 建议入口                                                             | 需要准备什么                                         |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| 还不知道怎么问           | [Agent 对话](https://wenbu.app/agent/)                               | 选一个主题和目标，再修改生成的草稿；点击发送后才开始 |
| 围绕眼前一件事思考       | [塔罗](https://wenbu.app/tarot/) / [易经](https://wenbu.app/iching/) | 一个具体问题，不需要出生资料                         |
| 看出生资料对应的传统命盘 | [八字](https://wenbu.app/bazi/) / [紫微](https://wenbu.app/ziwei/)   | 公历生日与当地时间；八字还需时区，紫微必须知道时刻   |
| 弄懂术语与计算规则       | [知识手册](https://wenbu.app/learn/)                                 | 可以从入门内容读起，再核对结果里的计算约定           |

传统符号适合学习和自我反思。历法计算能否复核，与解释能否预测现实是两件事；问卜不把排盘结果当作人生结论。

### 有哪些功能

- 八字：四柱、可见五行计数、未知时辰处理、午夜或子初换日选项，以及可选的近似真太阳时修正。五行数量不等于旺衰或喜用神。
- 易经：三钱法起卦，保留自下而上的六爻、动爻、本卦与之卦。
- 塔罗：完整 78 张牌，不放回抽取 1 张或 3 张，可选逆位；牌面为原创 AI 插画。
- 紫微：十二宫与星曜，公开 iztro 的排盘约定；目前宫位和星曜名称保留中文。
- Agent：使用 DeepSeek 调用实际工具、读取站内文章与精选外部资料、生成带来源的札记，并继续修改已有结果。研究范围限于资料目录。
- 保存与接入：浏览器手记、会话导出、MCP、CLI、Skill 与 REST API。

### 免费与资料处理

计算、抽取、学习内容、手记和 MCP 无需注册或付费。单次 AI 解读每个网络每天最多 5 次，Agent 每天最多 12 回合，上海时间零点重置；仍受全站共享预算限制。AI 不可用时，独立工具仍可使用。详见[免费额度](https://wenbu.app/free/)。

未登录时，会话与手记暂存在当前浏览器。邮箱验证码登录后可开启云端记录、选择导入旧记录，并跨设备回看；不要求注册才能查看完整结果。计算请求会发送至问卜的 Cloudflare 服务；使用 AI 时，消息和所选上下文会经该服务发送给 DeepSeek。导出文件可能包含私人资料，下载不等于自动分享，也不等于匿名化。详见[隐私说明](https://wenbu.app/privacy/)。

## Start with a question

Use [Wenbu Agent](https://wenbu.app/en/agent/) if you would like help framing a question. Choose a topic and an aim, edit the suggested draft, then send it. Choosing an option does not submit the draft for you.

For a question about the present, [tarot](https://wenbu.app/en/tarot/) and the [I Ching](https://wenbu.app/en/iching/) need no birth details. [BaZi](https://wenbu.app/en/bazi/) and [Zi Wei](https://wenbu.app/en/ziwei/) arrange traditional charts from birth information. The [handbook](https://wenbu.app/en/learn/) explains how to begin and what the results mean.

The tools calculate or draw the symbols; AI can help discuss them. These are cultural and reflective practices, not scientifically established ways to predict a person's future. Visible element counts, for example, do not establish element strength or favorable elements.

## Run locally / 本地运行

Requires **Node.js 22.12 or later** and npm. From this repository:

```sh
npm ci
npm run verify
npm run preview
```

Open [localhost:8787](http://localhost:8787). `verify` checks types, runs tests, builds the site and audits links and card assets. `preview` serves that build and the Worker API. Rebuild after changing static pages. `npm run dev` provides the faster Astro UI development server but does not supply Worker API routes.

AI is optional. To enable it locally, put server-only `DEEPSEEK_API_KEY` and `QUOTA_SALT` in an ignored `.dev.vars` file. No key belongs in browser code. See [operations](docs/operations.md) for setup, deployment and rollback.

## Connect your own agent / 接入自己的 Agent

Use Streamable HTTP at `https://wenbu.app/mcp`. It exposes six tools:

| Tool              | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `calculate_bazi`  | Four Pillars with time-zone and day-boundary conventions                   |
| `cast_iching`     | Random three-coin cast or six supplied lines, bottom to top                |
| `draw_tarot`      | One or three cards from the 78-card deck, without replacement              |
| `calculate_ziwei` | Twelve palaces from a known local birth time and traditional sex parameter |
| `search_library`  | Search Wenbu guides, symbol notes and reference metadata                   |
| `read_library`    | Read a guide or symbol entry by its returned ID                            |

MCP does not call DeepSeek or need your model key. Your host supplies its own interpretation. External reference search results are links and metadata; MCP has no `read_reference` tool, so the host must open those pages itself before citing their contents. Set `locale` explicitly to `zh` or `en`: MCP defaults to English, while REST and CLI calculations default to Chinese. Some traditional names remain in Chinese.

中文接入说明与可复制示例见 [Agent 接入](https://wenbu.app/agents/)；英文说明见 [Agent integrations](https://wenbu.app/en/agents/)。

### Try the CLI

The checked-in CLI has no dependencies. This reproducible example uses no personal information and makes no model call:

```sh
node public/wenbu.mjs --help
node public/wenbu.mjs iching '{"lines":[7,7,7,7,7,7],"locale":"en"}'
```

It returns a `kind: "iching"` JSON result with the six supplied lines and no changing lines. For a new random draw:

```sh
node public/wenbu.mjs tarot '{"count":3,"reversals":true,"locale":"en"}'
```

Keep personal inputs in a file or stdin rather than shell history: `node public/wenbu.mjs bazi --file birth.json`. The [integration page](https://wenbu.app/en/agents/) supplies a complete synthetic file. `WENBU_URL=http://127.0.0.1:8787` selects a local preview; `WENBU_ANALYTICS=off` opts out of coarse service analytics.

Read [the Skill](public/SKILL.md) before adding it to your host. It does not grant access to other conversations or files. A chart's context export and an Agent API request have different schemas; do not pass an export directly to the `agent` command.

## The built-in Agent

[Open the workspace](https://wenbu.app/en/agent/) or use `node public/wenbu.mjs agent --file request.json`. This is a separate route that calls DeepSeek on Wenbu's account and requires the person's choice to share the supplied message and context. See the bilingual [Agent protocol](docs/agent-protocol.md) for a complete request and streaming examples.

The Agent can plan, calculate, read the curated library and available allowlisted pages, ask for missing details and write a report. It has no unrestricted web search or background execution. Reports and their citations are model-authored; a successful source read does not verify every interpretation. Follow-ups preserve the original cards or lines unless a new draw is requested.

Guest conversations and artifacts stay in the browser. Email-verified accounts can enable private cloud history; older browser records require explicit selection for import. Requests send the selected context and a bounded recent history through Cloudflare to DeepSeek. Clearing browser storage removes local records; it does not delete provider records or reset quotas. The app does not promise end-to-end encryption; cloud sync requires an account with cloud history enabled.

## Limits and architecture

| AI allowance           | Current configuration                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Single reading         | 5 attempts per network per Shanghai day                                       |
| Agent conversation     | 12 turns per network per Shanghai day                                         |
| Work per Agent turn    | Up to 5 model calls, 12 tool executions and 120 seconds                       |
| Site-wide model budget | 1,000 attempts per day shared by both AI routes, with Agent use capped at 600 |

Shared networks can share an allowance. Failed or cancelled attempts may count. Calculators and MCP do not use the model budget, but request rate limits still apply. Visitors are not charged; the operator pays upstream and infrastructure costs.

Cloudflare Workers serves Astro static assets and API routes. A SQLite Durable Object manages AI quotas, D1 holds first-party product events and private feedback, private R2 preserves raw event archives, and rate-limit bindings protect the endpoints. The UI uses Astro 7 and React 19; calculations use pinned versions of lunar-typescript and iztro. Fonts are self-hosted. The optional model runs through DeepSeek's official API with requested model `deepseek-v4-flash`; responses record the model name reported by the provider.

Feedback is available from every public page and from reading/Agent results. Administrators can inspect linked usage history, triage feedback and download private NDJSON archives at `/insights/`. See [storage, export and privacy details](docs/analytics.md). Personal excerpts are shared only by an explicit choice in the feedback form.

## Check and contribute

Public page changes are automatically sent to IndexNow after deployment, with a Cloudflare check every 15 minutes as a fallback. Submission receipts and retries are stored in D1; a receipt is not proof of indexing. See [IndexNow operations](docs/indexnow.md).

See [review evidence](docs/reviews/README.md), [calculation methodology](https://wenbu.app/en/methodology/) and [analytics definitions](docs/analytics.md). Type checks, automated tests, browser checks, deployed smoke tests and actual search traffic are separate kinds of evidence. Software tests do not validate divinatory predictions.

Report a problem with reproducible steps, the selected convention and a synthetic example. Keep birth details, private questions and credentials out of public issues.

MIT license. Third-party packages retain their own licenses.

## Email accounts and cloud history

Complete guest trials remain free. Email verification lets users save the current result, sync conversations and journal entries, select older browser records to import, and export or delete their account data. Public MCP and CLI remain available without access to private history. See [account architecture, privacy and recovery](docs/accounts.md) for limits, reliable saving, quota linking and measurement definitions.
