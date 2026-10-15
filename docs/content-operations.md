# 问卜内容运营 / Wenbu editorial operations

Current operating target: **three reader tasks per day, each published in complete Chinese and English**. The scheduled slots are 09:00, 15:00 and 21:00 Asia/Shanghai. A topic can be a new guide, a material addition to an existing canonical guide, or a researched product comparison. These are targets, not permission to publish a failed draft.

## What runs where

| Process                                         | Trigger                                        | Execution and evidence                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Research, writing, separate review, publication | Three daily slots; 15-minute missed-slot check | Cloudflare `wenbu-editorial` Workflow; D1 run and immutable revision; private R2 research/draft/review objects                           |
| Technical search checks                         | Daily 07:30 Shanghai                           | Workflow checks public HTML, language alternates, canonical, sitemap and machine formats; records an observation                         |
| Candidate replenishment                         | Sunday 06:00 Shanghai                          | Distinct reader-task proposals, separate commissioning review, canonical-owner check, allowlisted sources; no invented traffic estimates |
| Google/Bing reports and AI answer observations  | Daily Codex review; deeper Sunday review       | Authenticated browser sessions and available research tools; results written to D1 through the authenticated observation API             |
| IndexNow                                        | After deployment and every 15 minutes          | Only changed public URLs; persisted 200/202/429 evidence, concurrency lease and retry schedule                                           |

The Cloudflare publishing pipeline works without an open laptop. The supplemental Codex browser review requires its execution host and authenticated browser sessions. Expired access is recorded as unavailable and reported; it is not replaced by a fabricated zero or inferred indexing result.

## Topic selection and iteration

The initial source of truth is `src/data/editorial-topics.ts`. Each topic has a stable ID, canonical owner, reader task, distinct example/diagram, source IDs, product action and priority. Existing near-duplicate intents should enhance their original URL. A weekly commissioning pass considers all existing guides, comparisons and queued tasks before accepting new work. Model proposals are candidates; each still requires actual source fetching and article review.

Research inputs should grow through actual Search Console queries, product friction, anonymized aggregate feedback, official calendar windows and first-party competitor changes. Never publish private chats or birth information as an example. Raw search volume, conversion lift and AI citation rates remain unknown until measured. Do not treat a model's opinion of a trend as observed demand.

Comparison pages answer a real choice, link current official sources and give the other product credit for its strengths. Record the fetch date and distinguish vendor claims from observed Wenbu behavior. Prices and paid features cannot be invented. Do not create near-identical brand-name swaps or claim that cultural readings have proven predictive accuracy.

At 7 days, inspect discovery, sources and obvious usability errors. At 14 and 28 days, compare mature cohorts with their sample sizes, actual article-entry sessions and subsequent service success. CTA clicks, registrations, saved records and successful tool operations are distinct. Search requests and AI crawler fetches are not human visits or AI answer citations. Use weak evidence to create a research task, not to delete a young article automatically.

## Publication gates

1. At least two sources actually fetched, including a vendor source for comparisons. An unavailable/challenged page is not counted as read. Excerpts are explicitly labelled.
2. Complete Chinese and English editions with equivalent sections, useful text, explanatory figure, table, worked practice, FAQs and terminology. Reject unsafe markup, unknown citations, repeated paragraphs, thin text and unsupported certainty.
3. A separate model pass checks support, bilingual parity, usefulness, originality and natural expression. This is AI-assisted review, not independent expert review.
4. One bounded repair is allowed. A run has at most four model requests. Failures retain private evidence and remain blocked; another deployment does not reset the slot.
5. Both editions become visible in one D1 transaction. Public HTML, Markdown, JSON, internal discovery, RSS and sitemap reflect the same committed revision. Existing base guides remain intact, with reviewed additions on their original canonical URL.

## Operations

Use the existing private admin credential through `WENBU_ADMIN_TOKEN_FILE`; never print it or put it in a URL or command argument.

```sh
npm run content:status
npm run content:run
npm run content:check
npm run content:observe -- /absolute/path/to/observation.json
npm run indexnow:status
```

`content:run` only queues an unfilled due slot. It cannot choose an arbitrary date, topic or model prompt. `content:check` is idempotent for the current day. The Insights overview includes an authenticated editorial status panel. All private operations use `no-store`, `noindex`, authentication and origin checks for mutations.

An observation JSON has `kind` (`search_console`, `bing_webmaster`, `geo_citation`, `weekly_review` or `topic_research`), `status` (`observed`, `attention`, `unavailable` or `passed`), optional `period` (`start`, `end`) and an `evidence` object. Keep snapshots outside Git and exclude secrets, cookies, private user text and account identifiers. Record provider, exact prompt, language, market, time, answer/citation URLs and coverage for AI observations. Search-result appearances are not AI answer citations.

## IndexNow diagnostics

The previous system hashed entire HTML. Shared scripts, CSS references and navigation could therefore queue many pages despite unchanged article substance. Fingerprints now use main content, relevant metadata and destinations. The fingerprint migration itself creates a one-time baseline difference.

Normal batches contain at most ten URLs. After repeated failures, the next eligible probe contains one URL. New URLs are prioritized. Successful receipts are spaced while the editorial system is enabled. `Retry-After` is retained and respected, including a longer server-provided wait. Do not reset backoff, rotate keys/providers to evade limits, or repeatedly submit the full site. Remote 429 responses remain a provider-side rejection; local throttling changes do not prove that the provider accepted a later request.

Read back `retry_after_ms`, endpoint host, response request ID and failure streak. Confirm the public key remains accessible. A receipt is not indexing. Google Search Console, Bing Webmaster Tools, search performance and observed AI citations are separate evidence layers.

## Failure response and rollback

Stop new publications by setting `EDITORIAL_AUTOPUBLISH=false`, preserving rendering and existing publications. `EDITORIAL_ENABLED=false` disables the dynamic feature and falls back to the static site; it does not delete D1 or R2 history. Never change static noindex templates into public guides directly.

Investigate a blocked run through its archived research, draft and review keys. Fix the underlying source/schema/quality issue, test it, and use the Workflow's explicit instance controls if a technical retry is warranted. Do not erase a failed run to manufacture a success. Immutable `editorial_revisions` are the recovery source for a published document. Preserve the existing hourly analytics/account maintenance triggers when changing schedules.

The quality workflow runs unit tests, native account checks, native Workflows/D1/R2/HTMLRewriter editorial checks and built content audits. A synthetic provider test is never reported as a real model publication.
