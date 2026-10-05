# Release verification — 2026-10-05

## Published state

- Main implementation: [PR #12](https://github.com/wenbu-app/wenbu/pull/12), merge `a16a759319666c4d9cea5fc5c898574bb2fb1fd2`.
- Follow-up semantic repair discovered in the live flow: [PR #13](https://github.com/wenbu-app/wenbu/pull/13), merge **`a20690af3c17708fe348bdbf654d74c9ef0ed603`**.
- Final Cloudflare Worker version: **`bf5a7cea-d62d-4b1b-b53a-152a09d1b4d4`**. Published to wenbu.app, www.wenbu.app and wenbu.genedai.me.
- Prior version in this release: `989a5d5a-21aa-4da8-8df8-2f6757da1ea7`, superseded by the version above.
- [Main CI for the deployed commit](https://github.com/wenbu-app/wenbu/actions/runs/37269040526): success. Both PR checks also passed.
- Local verification: 304 unit tests, 64 native account checks, type checks, lint, build, and site/art/knowledge/IndexNow audits passed.

## Live verification

[Final smoke evidence](live-smoke-final.json): 96 page/resource checks, 4 API calculations, 6 MCP tools and bilingual library reads passed. No model request is included in this script.

[Account smoke evidence](live-accounts.json): 14 checks passed on the first deployment, including public session state, unauthorized access, rejected invalid mail requests, trial receipt and protected reporting. No account was created and no email was sent. The later follow-up patch did not modify account handlers.

The browser separately exercised the **real official DeepSeek API**, using public learning prompts without personal birth details:

1. Clicked “我想了解命理与占卜”: one user message, then one focused clarification with four options.
2. Clicked the overview option: directly started the next turn, retained the unsent test draft, and completed a report with sources and a comparison visual.
3. After the follow-up fix, reloaded the previous report: intake questions were removed from clickable suggestions; clear example/evidence requests remained in chat.
4. Asked for a two-paragraph report: generated user-perspective follow-ups such as “解释一下为什么四种方法互相验证不算独立检验”.
5. Clicked that question in the **report panel**: sent the exact visible text once, retained another unsent draft, and completed a further sourced report. No visible turn errors; one composer throughout.

[DOM receipt](live-flow.json) records the four submitted messages, retained draft, final suggestions and error count. These are synthetic release-testing inputs. The configured/requested model remains `deepseek-v4-flash`; the API’s reported model label visible in the UI was `deepseek-flash`. A successful sample demonstrates this flow, not universal model reliability.

Screenshots: [live entry](live-welcome.jpg), [real clarification](live-clarification.jpg), [sourced report](live-report-followups.jpg). Local bilingual and 320px/375px evidence is indexed in [the audit](README.md).

## Explicit limitations

- Grok CLI review was attempted read-only and returned **HTTP 402: usage balance exhausted**. No Grok review verdict was obtained; successful tests/CI/browser checks are separate evidence.
- The automatic IndexNow hook ran and respected the existing backoff: `submitted: 0`. No new submission, indexing, ranking or traffic result is claimed.
- Report wording compatibility filtering recognizes common intake patterns; it is not a universal semantic classifier. New output is also guided through system and tool-schema instructions.
- This verifies the interaction change. It does not measure conversion or retention lift, or verify real mailbox delivery.
