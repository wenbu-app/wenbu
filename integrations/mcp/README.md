# Wenbu MCP

Seven tools for BaZi, the I Ching, tarot, Zi Wei, public daily practice and source-based learning. Remote endpoint: **https://wenbu.app/mcp**. Stateless Streamable HTTP, no Wenbu account or API key. Wenbu MCP does not call DeepSeek; the connected host provides interpretation.

中文说明：[接入问卜](https://wenbu.app/agents/?utm_source=github&utm_medium=referral&utm_campaign=open-source-2026)。计算约定、完整结果和不确定性会随工具结果返回，请保留这些信息。

## Connect

For hosts that support a remote URL in `mcpServers`:

```json
{ "mcpServers": { "wenbu": { "url": "https://wenbu.app/mcp" } } }
```

Use [mcp.json](mcp.json), or adapt it to your host's remote-MCP format. Installing the Skill does not configure this connection. There is no local stdio process in this configuration.

## A first reproducible call

```sh
curl -fsS https://wenbu.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary @integrations/mcp/examples/iching.json
```

The synthetic example supplies six fixed yang lines. Read `result.structuredContent`: the original hexagram is number 1 and the changing-line list is empty. Hosts should follow their normal initialization flow; the stateless server supports independent requests for compatibility.

| Tool              | Inputs / behavior                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `calculate_bazi`  | Gregorian date, nullable time, IANA timezone, day boundary and optional approximate solar-time correction |
| `cast_iching`     | Six supplied values, bottom to top, or a new three-coin cast                                              |
| `draw_tarot`      | One or three cards without replacement; optional reversals                                                |
| `calculate_ziwei` | Known local civil date/time and the traditional sex calculation parameter                                 |
| `search_library`  | A bounded catalogue of original learning content and curated reference metadata                           |
| `read_library`    | Complete original guide/symbol content or a named section; preserves scope and source links               |
| `get_daily_card`  | Public daily card and practice; server date and selected IANA timezone; no private history                |

Set `locale` to `zh` or `en`. Defaults to English. Some traditional names remain Chinese. Resources: `wenbu://methodology`, `wenbu://knowledge` and `wenbu://capabilities`.

## Structured output and selectable prompts

MCP JSON bodies are capped at 64 KiB, including selected prompt arguments. Each tool advertises its successful `outputSchema`, returns `structuredContent` and a text JSON copy. Check `isError` before consuming it. Invalid input is not a result; service failures are separately marked `source_unavailable`. Search reference metadata returns `nextTool:null` and `nextAction:"open_source_with_host"`; use host browsing before citing the original page.

`get_daily_card` accepts `timezone` (IANA, default UTC) and `locale`. Its `scope:"public"` card can differ from a personal browser/account card. It uses the server calendar, no model, no private history and no account storage.

Selectable prompts `reflect_on_reading` and `research_with_sources` return templates for the host model. They do not invoke AI or discover private context. For discovery use `node wenbu.mjs doctor`, `prompts` or [capabilities](https://wenbu.app/api/v1/capabilities).

## Limits and privacy

MCP calculates cultural symbols, not verified predictions. Calculations reach Wenbu's Cloudflare service. No prompts, birth inputs or chart contents enter the event analytics store. Coarse tool-call analytics can be disabled with `X-Wenbu-Analytics: off`. Your host controls its own history and model data practices. Back off on HTTP 429.

[Source implementation](../../worker/mcp.ts) · [Registry manifest](server.json) · [English guide](https://wenbu.app/en/agents/?utm_source=github&utm_medium=referral&utm_campaign=open-source-2026) · [MIT license](../../LICENSE)

[Published official MCP Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/app.wenbu%2Fmcp/versions/latest): domain-authenticated `app.wenbu/mcp`, latest published version. The record exposes the remote URL and source repository; it does not automatically configure your host or establish an endorsement.
