# Wenbu product experience and agent integration upgrade

## Intended outcome

Keep the paper, ink, original card art and bilingual identity. Give the question
and the resulting work more space. A newcomer can preview without details or a
turn, try one task, understand its method, then choose whether to save. A reader
can discover every published guide and continue with the article's context.
An external agent can discover, validate and use the public tools without a
model key or implicit access to private user data.

The chosen approach is an incremental production upgrade grounded in the current
screens and design tokens. A new brand direction and a separate app shell would
both enlarge migration and regression scope without resolving the measured
entry, discovery and connection issues first.

## Current-run audit findings

1. At 1280px the Agent always allocates a third of the width to a full example,
   even with no result. The conversation and two preview invitations compete.
   Make the result pane explicit and collapsible, open it for real work when
   appropriate, and keep a modal preview available before account initialization.
2. The library's static search/filter covers 21 original cards. Published
   additions are appended to a separate catalogue, outside those controls.
   Integrate new guides and updated identities into the existing topic groups,
   keep one card per canonical owner and count the full library.
3. Chinese article titles can split terms such as 紫微 across lines. Preserve
   important short terms, allow ordinary responsive wrapping, and keep long
   English labels and URLs from overflowing.
4. Tool output conventions are mostly hidden in details. Surface the selected
   clock/day-boundary/unknown-time assumptions and distinguish lunar-year zodiac
   from the BaZi year-pillar convention. Preserve source and method metadata.
5. MCP has structured content but no output schemas or prompt templates, and its
   methodology resource has a stale hard-coded product version. Daily practice
   and machine capability discovery are missing from the connection surface.
6. CLI discovery is limited to a full catalogue and known guide slug. Add doctor,
   capability, library search/read and prompt retrieval paths. Reject redirects
   before selected input can be forwarded to another host, keep byte bounds,
   make errors actionable and never automatically repeat a model request.
7. Public README still describes the retired draft-based guide and outdated
   network-only allowances. Align Chinese/English product and integration copy
   with the actual guest-first flow and optional account saving.

8. English Ten Gods labels substituted personality words for relationship names; restore conventional terms. Source-maintained blog refreshes also need deployed revision reconciliation into the existing search queue.

## Implementation and acceptance

- Adaptive Agent workspace, accessible pane controls, full example deep link,
  explicit article entry handoff, preservation of existing drafts and results.
- Shared spacing/type rules with comfortable reading measures, 44px key touch
  controls, visible focus and reduced-motion support. Check desktop and 390px
  mobile in Chinese and English through the real in-app browser.
- Complete, searchable bilingual guide catalogue and original covers. Test new
  guides, extensions, duplicates, filters, view switching and empty results.
- Versioned public capability contract; seven MCP tools including public daily
  practice, successful-output validation, selectable prompts and resources.
- Dependency-free CLI and matching Skill/docs/OpenAPI/release bundles. Test
  successful and invalid calls, server failures, redirect refusal, byte bounds
  and opt-out/test headers. Production smoke checks use synthetic input without model calls. Two bounded local end-to-end checks use the configured provider with explicit non-personal questions.
- Accuracy regressions for explicit/default timezone, unknown time, Li Chun vs
  lunar new year, day boundaries and preserved random results.
- Content growth: unique intent owner, answer-first useful content, current
  sources, appropriate tool/context handoff, mature usage evidence. Preserve
  scheduled quality gates, provider pauses and existing submission queues.
- Full repository verification, read-only Codex review and attempted Grok CLI
  review. Report unavailable review honestly. PR, CI, merge, Cloudflare deploy
  and independent live readback before delivery.

## Source guidance

- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features):
  ordinary technical and helpful-content requirements still apply; no special
  AI schema or guaranteed visibility.
- [People-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content):
  prioritize a useful reader outcome and original value.
- [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools):
  advertise output schemas only when structured output conforms to them.
- [MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/server):
  use the pinned runtime's supported stateless transport, resources and prompts.
- [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/):
  provider citation aggregates and grounding-query samples are distinct from
  rankings, referrals, ordinary crawlers and individual neutral-answer samples.

Raw screenshots, search/usage evidence and release receipts remain private.
No traffic or ranking guarantee, fabricated author credential or forced article
publication is part of this work. No new recurring timer is required.
