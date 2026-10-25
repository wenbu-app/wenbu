# Product experience and agent integration review · 1.5

This release follows the [design plan](../plans/2026-10-25-product-experience.md) and [product/content growth review](../research/product-growth-2026-10-25.md). It keeps the existing identity and artwork while improving how a person starts, reads a result and continues from a guide.

## Implemented repairs

- The Agent starts with space for the conversation. Results can be opened and closed on desktop as well as mobile; large screens can open real work without stealing keyboard focus. The full editorial example has its own working deep link and is available independently of account initialization. Compact first-step choices keep that example visible on short desktop screens.
- All published learning guides enter the existing search, topic filters and cover/list controls. Each canonical owner appears once. The count and CollectionPage ItemList match the visible topic groups, including new publications; updated static owners retain their existing covers.
- An article can hand its explicitly selected public source ID to a new conversation. The selected question is exactly the visible button text, unsent writing survives, and unrelated private context is excluded. Invalid/missing catalogue entries leave normal onboarding available.
- Important Chinese terms remain together at line breaks. Shared reading styles preserve a comfortable measure and spacing. Key controls retain focus visibility, touch targets and existing reduced-motion behavior.
- BaZi results surface their clock and boundary settings. Omitted API timezones return an explicit assumption warning. Lunar New Year animals and Li Chun year-pillar animals have separate conventions and English names. Conventional Ten Gods labels replace unsupported personality words in new output and old saved displays; the numerical/pillar rules are preserved.
- MCP exposes seven tools, three resources and two selectable prompts. Successful output schemas are checked both by Zod and the official SDK's JSON Schema validator. Library reference metadata no longer recommends an unavailable MCP tool. Published guide sections have exact, scoped source IDs; storage failures are not described as invalid birth data.
- The CLI adds connection diagnostics, capabilities, search/read and prompt retrieval. Redirects are refused before selected input can be forwarded. Request/response bytes and UTF-8 event sizes are bounded. Unknown commands return an actionable error without a stack. Matching Skill, README, OpenAPI and release bundles describe the current behavior.
- Current capability facts are available in HTML documentation, a public JSON manifest, the API and an MCP resource. The editorial pipeline can read that first-party contract when describing Wenbu. Content remains centered on a reader task and useful original examples, rather than article counts or keyword variants.
- Deployed source-maintained blog changes now join the existing Google request/inspection queue. Migration 0011 keeps an independent baseline. Its first observation does not resubmit the archive; later new or changed fingerprints enqueue only those revisions. Existing accepted/requesting/uncertain receipts and provider pauses remain intact. The six old deployed blog URLs were primed and read back before this rollout. No additional timer or provider request is introduced.

## Verification

`npm run verify` passed: type checks, **486 unit tests**, **84 native account checks**, **52 native editorial checks**, the static-link/metadata audit, 78-card artwork audit, 42 original complete bilingual knowledge editions and IndexNow manifest/sitemap parity. `npm run lint` passed. The native checks use synthetic providers and do not send real email.

Real browser checks covered Chinese/English layouts at 1280px, 390px and 320px, the complete example, article handoff, retained drafts, collapsible results, calendar sample input and technical-term wrapping. The 320px page and English pillar labels had no horizontal overflow. Screenshots and raw operational evidence remain in the private release folder.

Production readback also caught fixed-height artwork cropping the newly published guide covers in list view. Those covers now keep the same responsive aspect ratio as the original collection, with card artwork scaled to the actual column width.

Two bounded local end-to-end turns also used the configured model service with explicitly synthetic questions. The Chinese article handoff completed with two read sections, a sourced report and its draft retained. The English teaching example completed after calculation, search and reading, correctly distinguishing Rabbit by Lunar New Year from Dragon by Li Chun. These examples are evidence for those flows, not a general accuracy benchmark or a claim of predictive validity.

Codex source review checked privacy boundaries, result focus, canonical ownership, schema conformity, errors and queue idempotency. It found and repaired the strict JSON Schema/extra-field mismatch, dynamic-section lookup, generic English relationship labels and the static-blog queue gap. A read-only Grok CLI attempt, with tools/web/subagents disabled, returned no output within **91.74 seconds** and was terminated. Its review is **unavailable, not passed**.

The release verification follow-up also repairs two stale assumptions in the operator tooling: manual technical checks use a fresh Workflow ID instead of reusing that morning's instance, and full-site smoke checks compare sitemap URLs with the publication manifest while verifying its static build fingerprint and current MCP capability contract. Neither check sends a model or indexing request by default.

## Evidence boundaries

A successful build, deployment, provider submission, actual crawl/index result, search traffic and an AI citation are separate outcomes. No traffic or ranking improvement is established by this release. Existing daily bilingual publication, quality gates, IndexNow backoff and browser-based Google follow-up remain authoritative. Public MCP and CLI do not gain access to private account history; the public daily card can differ from a personal one. An updated local Registry manifest is not itself a Registry publication receipt.
