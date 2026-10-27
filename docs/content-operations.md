# 问卜内容运营 / Wenbu editorial operations

Current operating target: **three reader tasks per day, each published in complete Chinese and English**. The scheduled slots are 09:00, 15:00 and 21:00 Asia/Shanghai. A topic can be a new guide, a material addition to an existing canonical guide, or a researched product comparison. These are targets, not permission to publish a failed draft.

## What runs where

| Process                                           | Trigger                                                        | Execution and evidence                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Research, writing, separate review, publication   | Three daily slots; 15-minute missed-slot check                 | Cloudflare `wenbu-editorial` Workflow; D1 run and immutable revision; private R2 research/draft/review objects                                 |
| Technical search checks                           | After publication and daily 07:30 Shanghai                     | Workflow checks bilingual HTML/Markdown/JSON revisions, canonical, alternates, sitemap membership, directory links and actual CTA destinations |
| Candidate replenishment                           | Daily 06:30 Shanghai; depleted reserve rechecked after 6 hours | Distinct reader-task proposals, separate commissioning review, canonical-owner check, allowlisted sources; no invented traffic estimates       |
| Google/Bing reports and AI answer observations    | Daily Codex review; deeper Sunday review                       | Authenticated browser sessions and available research tools; results written to D1 through the authenticated observation API                   |
| IndexNow                                          | Daily 22:30 Shanghai, at least 24 hours apart                  | Only changed public URLs; persisted 200/202/429 evidence, concurrency lease and retry schedule; deployments do not send extra notifications    |
| Google priority indexing requests and inspections | Daily 22:45 Shanghai browser delivery review                   | Private D1 queue; one-time core-page bootstrap, committed bilingual revisions, visible acceptance and separate provider inspections            |

The Cloudflare publishing pipeline works without an open laptop. The supplemental Codex browser review requires its execution host and authenticated browser sessions. Expired access is recorded as unavailable and reported; it is not replaced by a fabricated zero or inferred indexing result.

Shared model-account failures are separate from editorial quality failures. A 401/402 blocks new editorial model reservations and topic attempts until the existing reconciler obtains a positive availability result from the provider's read-only balance endpoint. Checks are leased and spaced at least an hour apart while blocked; missing, malformed or inaccessible data remains unavailable. No credential, account identifier or monetary balance is retained. A positive result resumes eligible work without resetting any budget, historical attempt or search-provider pause. Apply `0013_editorial_model_provider.sql` before this runtime. Private `content:status` exposes `modelProvider`; its state does not disable independent technical checks or search delivery. Permanent request/account errors do not receive an automatic Workflow transport replay.

Manual `content:check` creates a fresh technical-health Workflow with a unique `editorial-health-manual-<uuid>` ID, so a release check cannot accidentally return the already-completed daily instance. The 07:30 scheduled check keeps its date-based deduplication. A queued receipt still requires reading that exact instance to confirm its terminal result.

## Google priority request queue

The user authorized one pass over all indexable non-article pages on 2026-10-17, followed by requests for newly published or materially updated articles. Home pages and tools have the highest priority, followed by library/comparison directories and public explanations. The bootstrap uses the deployed public manifest, excluding individual `/learn/` and `/compare/` articles, private/noindex routes, APIs and duplicate machine formats. It is idempotent per core URL. It is not a claim that all queued URLs have already been submitted.

```sh
npm run search:console -- status
npm run search:console -- next
npm run search:console -- seed
npm run search:console -- reconcile
npm run search:console -- claim <job-id>
npm run search:console -- record /absolute/private/path/to/receipt.json
npm run search:console -- inspect /absolute/private/path/to/inspection.json
```

Publication adds both language requests in the same D1 transaction as the new immutable revision. Pending older revisions are superseded, without deleting receipts. The daily heartbeat processes this queue through the authenticated `sc-domain:wenbu.app` browser property. It does not call Google's restricted Indexing API, and no duplicate local article timer is needed. A daily browser run depends on the host and its login session; Cloudflare cannot click Search Console by itself.

The technical health pass also reconciles exact committed publication revisions. This recovers a publication created before the queue was installed or a missed follow-up, with no new draft, model request or publication. Reconciliation is idempotent and cannot clear the provider pause. Since 1.5, the same deployed technical-health pass also compares source-maintained `/blog/<slug>/` pages using the deployed substantive-content manifest and `search_static_blog_revisions`. The first observation only establishes a baseline; later new or changed blog fingerprints enqueue exact revisions, with both languages handled as their actual URLs. This never drafts, publishes or submits to Google. Accepted/requesting/uncertain receipts and the global provider pause are preserved. Apply migration `0011_static_blog_search_revisions.sql` before deployment; prime and read back the old deployed blog baseline before the first 1.5 release so its current refresh is not mistaken for the initial archive. `next` reports the next pending or deferred job with its actual `eligible_at`; do not select pending jobs alone or overlook the previously quota-deferred page. An unresolved dispatched job blocks further dispatches until its outcome has been independently resolved.

The evening delivery heartbeat owns requests; the morning `seo-geo` heartbeat reads provider reports, indexing observations and search/GEO results. They do not each send the same queue. The evening run checks the actual terminal result of the day's 22:30 IndexNow Workflow, both editions of the latest publication, Google eligibility and due Google/Bing URL inspections. Only a concrete missing eligible daily run may be repaired once; never reset a pause or repeat an ambiguous request.

Claim a job before clicking Request indexing. Record `requested` with reason `accepted` only after the visible success confirmation. A provider quota, permission problem or CAPTCHA pauses the queue for at least 24 hours; leave pending jobs intact and report the coverage gap. Never solve a CAPTCHA without the required user handoff. A dispatched request without a clear outcome remains `requesting` or `uncertain`; do not automatically resend it. Resolve it only from independent visible evidence, using the receipt command. A later article revision does not clear a global provider pause. Replays of an accepted receipt are idempotent, and the same URL cannot be requested again within 24 hours. Inspect actual crawl/index status separately; `requested` is never relabelled as `indexed`.

Receipt input: `{"id":"<job-id>","outcome":"requested|deferred|uncertain","reason":"accepted|quota|captcha|permission|temporary_error|unknown_outcome","note":"short visible evidence without account identifiers or credentials"}`. Keep raw screenshots and queue exports in the private dated operations directory, and write sanitized summaries via `content:observe`.

### Actual indexing follow-up

Every current queue revision gets independent Google and Bing inspection rows, initially `unknown`, due after 24 hours. The provider's visible URL Inspection result is recorded with `inspect`, without clicking Request indexing again. Keep the exact observation time, explicit crawl time when available, declared canonical and indexed canonical. An inaccessible console is `unavailable`, not `not_indexed`; an unknown field stays null. The append-only inspection event history is independent of the submission ledger.

```json
{
  "id": "<job-id>",
  "provider": "google",
  "status": "indexed",
  "checkedAt": "<actual ISO UTC observation time>",
  "lastCrawlAt": null,
  "declaredCanonical": "https://wenbu.app/",
  "indexedCanonical": null,
  "note": "Visible URL Inspection result; crawl time or selected canonical was not available."
}
```

An indexed URL with a crawl predating the revision does not prove the update was crawled. The receipt labels revision crawl timing `before_update`, `after_update` or `unknown`. Unavailable observations retry after one day; unindexed URLs progress through bounded daily/3/7/14-day follow-up; indexed URLs are checked after seven days, or 28 days when a post-update crawl was explicitly observed. The queue exposes exact due counts and bounded lists. Check current revisions only; old request and inspection history remains available. Record source screenshots privately and never infer ranking, visits or AI citations from indexing.

## Topic selection and iteration

The initial source of truth is `src/data/editorial-topics.ts`. Each topic has a stable ID, canonical owner, reader task, distinct example/diagram, source IDs, product action and priority. Existing near-duplicate intents should enhance their original URL. A daily commissioning pass considers all existing guides, comparisons and queued tasks before accepting new work. Model proposals are candidates; each still requires actual source fetching and article review.

Commissioning uses article descriptions, section coverage and queued reader outcomes. Each proposal needs at least two distinct registered source documents (repeated IDs or fragment aliases do not count twice), its own ownership decision, the closest existing canonical path and an explanation of why improving that page cannot serve the proposed outcome. A different worksheet, diagram, duration or basic sub-step is insufficient for a new URL. A substantial source-backed missing answer may instead be accepted as an extension on the exact existing owner; the critic must explicitly identify the new coverage, and an active reservation at that owner cannot be duplicated. Missing, duplicated or unknown review decisions fail closed. New comparisons must name an explicitly registered consumer product, include its official vendor source and use that product's unique canonical owner; a historical text or calculation library cannot stand in for an unnamed app. Proposals, model outputs, ownership reviews and final decisions are archived privately in R2. Article review also receives the current canonical coverage.

Candidate envelopes are validated item by item. Each critic batch contains at most 24 candidates; valid overflow is checkpointed in private R2 and re-read by the next bounded pass. The checkpoint retains the full batch until the D1 admission transaction commits, including candidates from an interrupted pass. An invalid item does not discard valid neighbors. Full decisions remain in R2, with a bounded D1 projection. Zero-admission receipts say `unfilled`, rather than implying the reserve was replenished. The next pass also reads the latest planning observation: up to eight concrete rejection/correction summaries, independently of the latest search and growth signals. Full decisions remain in the private per-run archive. Rejection feedback is tied to its candidate version and deduplicated newest-first, excluding resolved IDs. A deterministic reservation or mode mismatch takes precedence over a critic’s positive merge explanation: show the actual ready task or required extend mode without implying existing owners cannot receive later substantive additions. Model input is compacted as complete values before JSON serialization, preserving exact retained URLs and time windows; it is never cut in the middle of JSON.

The commissioning policy is versioned. A verified policy upgrade permits one fresh pass without deleting the earlier attempt. Reconsideration is spaced by six days for a healthy reserve and six hours for a depleted reserve. The existing 15-minute reconciler uses quarter-hour instance IDs, while ordinary depleted-reserve replenishment retains its six-hour cooldown and the shared daily model budget. A startup lease race records `editorial_busy` without calling the model, retains the other writer’s lease, and permits a fresh instance after 15 minutes. Repeated IDs return their actual existing Workflow status rather than claiming a new queue. Publishing takes priority over planning. This does not add another publishing timer. An accepted proposal still needs source reading and every publication gate. A shortage is recorded when too few supported, distinct tasks remain; the system must not pad the queue to meet its reserve target.

Commissioning has a durable attempt ledger and shares the editorial lease. Both failed and completed attempts arm the cooldown. Replaying a completed Workflow returns its stored receipt; replaying an interrupted or blocked attempt cannot generate another batch. Candidate inserts, the ownership audit, the completed receipt and the successful timestamp commit in one D1 transaction. The ownership catalog includes actual bilingual static and dynamically published content, later paragraphs, table bodies and worked examples, plus reserved tasks in all retained states. Large article-coverage snapshots stay in private R2 rather than a Workflow step result.

Research inputs should grow through actual Search Console queries, product friction, anonymized aggregate feedback, official calendar windows and first-party competitor changes. Never publish private chats or birth information as an example. Raw search volume, conversion lift and AI citation rates remain unknown until measured. Do not treat a model's opinion of a trend as observed demand.

Comparison pages answer a real choice, link current official sources and give the other product credit for its strengths. Record the fetch date and distinguish vendor claims from observed Wenbu behavior. Prices and paid features cannot be invented. Do not create near-identical brand-name swaps or claim that cultural readings have proven predictive accuracy.

At 7 days, inspect discovery, sources and obvious usability errors. At 14 and 28 days, compare mature cohorts with their sample sizes, actual article-entry sessions and subsequent service success. CTA clicks, registrations, saved records and successful tool operations are distinct. Search requests and AI crawler fetches are not human visits or AI answer citations. Use weak evidence to create a research task, not to delete a young article automatically.

## Publication gates

1. At least two sources actually fetched, including a vendor source for comparisons. An unavailable/challenged page is not counted as read. Excerpts are explicitly labelled.
2. Complete new Chinese and English guides retain the full structure and depth contract. A server-verified extend task with both exact fetched bilingual owners uses a focused addition contract: prefer two or three new sections, retaining evidence, explanatory figure, table, worked practice, FAQs, terminology and the real product action. The original guide and earlier additions remain complete on the canonical page. Reject unsafe markup, unknown citations, repeated paragraphs, substantial literal owner repetition, thin text and unsupported certainty. An explicit correction can preserve accurate unaffected text; it does not need an invented new exercise. Length bounds protect against empty output, not rank content by word count.
   Finished instructions, example statuses and glossary terms may discuss missing personal inputs with words such as `待补标注`. Check complete rendered fields for actual draft scaffolding rather than banning that normal vocabulary. Standalone or bracketed placeholders, `待补充正文`, explicit unfinished-copy instructions, unresolved sources, TODO/TBD, URLs and HTML remain blocked. Field boundaries stay separate; the unmodified article still goes through source verification and the separate factual/usefulness/originality review.
3. A separate model pass with an explicit low reasoning budget checks support, bilingual parity, usefulness, originality and natural expression. This is AI-assisted review, not independent expert review.
4. Up to three writing/review rounds are allowed. Each critique names concrete defects and repairs, and every round is retained. A run has at most six logical model stages; each permits at most one transport retry, with a twelve-request physical cap. A failed slot continues with another eligible task through the existing reconciler, at least 15 minutes apart, up to six immutable attempts per slot. All editorial requests share a persisted daily cap of 120, including at most eight planning requests. A reservation is taken before the provider call; a crash may consume budget conservatively but cannot create unaccounted requests. Invalid schemas enter that same bounded repair path with exact field diagnostics. Raw visible output and finish reason are archived before validation, including truncation. Each failed attempt remains immutable; subsequent attempts use the same shared limits. A partial unique index permits only one live or published attempt per slot.
   A completed response with invalid JSON syntax is retained as a validation defect for that same repair path. Its bounded repair feedback identifies JSON syntax and the parser position when available, rather than only reporting missing language objects. It is not automatically replayed as a network failure and cannot satisfy a draft or review schema. Invalid output after the bounded repair still blocks publication.
5. Both editions become visible in one D1 transaction. Public HTML, Markdown, JSON, internal discovery, RSS and sitemap reflect the same committed revision. Existing base guides remain intact, with reviewed additions on their original canonical URL.

## Operations

Use the existing private admin credential through `WENBU_ADMIN_TOKEN_FILE`; never print it or put it in a URL or command argument.

```sh
npm run content:status
npm run content:run
node scripts/editorial.mjs plan
npm run content:recover -- editorial-YYYY-MM-DD-HH-retry-1
npm run content:revise -- /absolute/path/to/revision.json
npm run content:check
npm run content:observe -- /absolute/path/to/observation.json
npm run indexnow:status
```

`content:run` only queues an unfilled due slot or a bounded fresh attempt after all earlier attempts for that slot failed and the retry delay passed. It respects six attempts per slot, the daily model cap and existing successful slots. `node scripts/editorial.mjs plan` dispatches the current policy's deduplicated quarter-hour planning instance, subject to the normal six-hour cooldown; it cannot choose arbitrary topics, dates or prompts or bypass cooldown/budget. It cannot choose an arbitrary date, topic or model prompt. After fixing and checking a concrete source/code defect, `content:recover` can explicitly retry an eligible blocked run from today using the same topic. It retains every failure, allows at most three total attempts for that slot and refuses already published, active, previous-day or quarantined topics. It does not alter any quality gate, and is not called by scheduled publishing. `content:check` creates a fresh manual health instance; the scheduled daily instance remains date-deduplicated. The Insights overview includes an authenticated editorial status panel. All private operations use `no-store`, `noindex`, authentication and origin checks for mutations.

`content:revise` accepts a published `path`, its `expectedRevision` hash, and concrete editorial `instructions`. It fetches fresh sources and runs complete bilingual writing and both quality gates again. It preserves the first publication date and immutable earlier editions. Stale revisions and overlapping operations are refused; explicit corrections are capped at three per day. Durable queued request objects let cron recover an interrupted enqueue without inventing its instructions.

An observation JSON has `kind` (`search_console`, `bing_webmaster`, `geo_citation`, `weekly_review` or `topic_research`), `status` (`observed`, `attention`, `unavailable` or `passed`), optional `period` (`start`, `end`) and an `evidence` object. Keep snapshots outside Git and exclude secrets, cookies, private user text and account identifiers. Record provider, exact prompt, language, market, time, answer/citation URLs and coverage for AI observations. Search-result appearances are not AI answer citations.

## IndexNow diagnostics

The previous system hashed entire HTML. Shared scripts, CSS references and navigation could therefore queue many pages despite unchanged article substance. Fingerprints now use main content, relevant metadata and destinations. The fingerprint migration itself creates a one-time baseline difference.

Normal batches contain at most ten URLs. After repeated failures, the next eligible probe contains one URL. New URLs are prioritized. Successful receipts are spaced while the editorial system is enabled. `Retry-After` is retained and respected, including a longer server-provided wait. Do not reset backoff, rotate keys/providers to evade limits, or repeatedly submit the full site. Remote 429 responses remain a provider-side rejection; local throttling changes do not prove that the provider accepted a later request.

Read back `retry_after_ms`, endpoint host, response request ID and failure streak. Confirm the public key remains accessible. A receipt is not indexing. Google Search Console, Bing Webmaster Tools, search performance and observed AI citations are separate evidence layers.

`node scripts/indexnow.mjs --diagnostic-status` reads the private production transport and ownership-file observations. If a new, discriminating transport check is needed, `--diagnose` dispatches a deduplicated production Workflow with fixed credential-free HEAD/GET requests, never a URL notification or a pause reset. See [the diagnostic scope and coverage limits](indexnow.md#区分出口验证抓取与-url-通知). Read historical Cloudflare data with explicit retention, sampling and row limits before concluding that a verifier never fetched the file. UA claims are not verified identity; another project's publisher is not evidence of duplicate Wenbu submissions or a shared provider quota. Record the operator's no-contact decision and continue diagnosis without opening support tickets.

## Failure response and rollback

Stop new publications by setting `EDITORIAL_AUTOPUBLISH=false`, preserving rendering and existing publications. `EDITORIAL_ENABLED=false` disables the dynamic feature and falls back to the static site; it does not delete D1 or R2 history. Never change static noindex templates into public guides directly.

Investigate a blocked run through its archived research, draft and review keys. Fix the underlying source/schema/quality issue and test it. A fresh attempt has a new Workflow ID and preserves the earlier failed row and R2 evidence; it does not restart an old instance on an unknown code version. Transient source/provider failures do not permanently quarantine a topic; retries of that topic have a 24-hour cooldown. Three distinct quality failures quarantine it for operator review. Queued rows are reconciled with actual terminal Workflow state after 30 minutes, so an orphaned row cannot block later slots. Do not erase a failed run to manufacture a success. Immutable `editorial_revisions` are the recovery source for a published document. Preserve the existing hourly analytics/account maintenance triggers when changing schedules.

The quality workflow runs unit tests, native account checks, native Workflows/D1/R2/HTMLRewriter editorial checks and built content audits. A synthetic provider test is never reported as a real model publication.

## Continuous delivery and keyword feedback · policy 4

The six demand lanes in `src/data/editorial-demand.ts` cover BaZi/calendar checks, I Ching practice, tarot learning, Zi Wei reading, daily/journal practice, and Agent/product choice. Each new candidate carries a bilingual keyword brief, reader intent and canonical owner. Seed phrases are explicitly research hypotheses. Observed Search Console queries retain their actual provider/time window and are not converted into invented volume estimates. Keyword variants should strengthen a useful owner, not create doorway pages.

Commissioning runs up to two proposal/critical-review rounds. Rejected proposals receive concrete correction feedback; an empty first round prompts another lane and existing-owner gaps. Fresh source-health records prevent known unavailable vendors from filling the production reserve. First-party research reads the current public canonical text, including earlier additions. Each publication still re-fetches supporting sources, requires at least two supporting sources beyond the original language copies, checks exact evidence quotes and passes an independent editorial review. The same owner is not automatically updated more than once in 24 hours.

A substantial update preserves the original page, earlier reviewed additions and stable public citation identity. Corrections explicitly requested through `content:revise` replace the affected latest edition instead of preserving the erroneous text as another addition. CAS and the one-live-run-per-slot index guard overlap. Earlier immutable revisions and failed attempts remain available.

After an explicit correction, a formerly public pinned chapter returns a bounded `source_superseded` recovery pointer through MCP and the built-in Agent. It points to the current document and requires a fresh read. The resolver reads only owner/revision existence and section-count metadata from the private immutable history; it does not expose withdrawn text or grant a source receipt. Unknown or ambiguous pins remain invalid. See [the corrected-citation boundary](plans/2026-10-27-corrected-citation-recovery.md).

The authenticated `content:status` response exposes `production`, `productionPolicy`, `sourceHealth` and `modelBudgets`. Production reports count successful slots once, show today's due slots separately from tonight's target, summarize failure categories, source-viable reserve and keyword lanes. The Insights editorial panel displays the same report. The technical-health pipeline records immutable `growth_review` snapshots keyed by the Shanghai day and material state, covering the previous complete day and current reserve gaps. Unchanged evidence deduplicates; changed evidence can produce another snapshot on the same day. Planning reads the latest observation of each relevant kind, so frequent technical checks cannot displace the actual search/weekly signals.

The existing 08:00 Codex review owns actual 7/28-day search metrics, neutral AI-answer samples and the Sunday 7/14/28-day usage review. Feed relevant queries, pages, reader tasks, decisions and sources back through compact top-level observation fields. Measure article-entry sessions followed by real server success; clicks, crawls and MCP calls are separate. A missed daily target is an operational defect with retained reasons and recovery conditions, never a successful delivery. Budget or genuinely unavailable evidence can still prevent completion; no traffic or ranking is guaranteed.

## Review freshness and execution boundaries

Growth reviews are immutable snapshots keyed by the Shanghai day and a fingerprint of production, stock, source state and retained repair feedback. Unchanged evidence deduplicates; a new failure or changed reserve creates a new snapshot on the same day. Each planning pass refreshes sources and records the current review before reading the latest observation of each kind. Earlier daily-only snapshots remain retained.

Content publishing runs on Cloudflare. Codex product engineering, authenticated console checks and AI-answer sampling depend on their execution host and valid access. An active automation is a scheduling configuration, not proof that a given run completed. Read terminal receipts and private dated closeouts, retain missed coverage and continue from actual eligibility. The private iteration ledger is a handoff record; it does not execute tasks by itself.

Full policy and failure-path review: [2026-10-25 strategy review](reviews/strategy-review-2026-10-25.md).

Focused-addition calibration and validation contract: [2026-10-26 design](plans/2026-10-26-focused-editorial-additions.md).
