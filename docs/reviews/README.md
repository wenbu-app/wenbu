# Quality and review evidence

- [2026-10-06: single-card trial, linked outcomes, provider-neutral UI and mature account cohorts](onboarding-release-2026-10-06/README.md).

- [2026-10-06: post-release onboarding research, nine fresh journey steps](onboarding-next-2026-10-06/README.md) — 11 screenshots, one real DeepSeek turn, a separate tool draw, source inspection and private aggregate analysis; recommendations only, no runtime change or deployment.

- [引导与试用第一阶段：执行约束、完整示例、原文结果与验收](onboarding-implementation-2026-10-06/README.md)

- [2026-10-06: onboarding and trial journey research with fresh live evidence](onboarding-trial-2026-10-06/README.md) — research and proposed design; no runtime change or deployment.

- [2026-10-06: deep bilingual UI / UX research, full-route checks and systematic interaction recovery](ui-ux-depth-2026-10-06/README.md).

- [2026-10-05: full UI / UX audit, contextual saves and bilingual analytics](ui-ux-2026-10-05/README.md).

- [2026-10-05: registration timing research and live guest-to-save entry review](registration-timing-2026-10-05/README.md) — original research; implementation and release status are recorded in the UI / UX audit above.

- [2026-10-05: conversation-first Agent onboarding, direct replies and bilingual UI verification](agent-onboarding-2026-10-05/README.md).

- [2026-10-03: GitHub organization and integration ownership migration](organization-launch-2026-10-03.md).

- [2026-10-03: calibrated measurement, open integration release and official MCP Registry](growth-measurement-release.md).

- [IndexNow automatic submissions, retries and verification](indexnow-2026-10-01/README.md).

- [Illustrated handbook release](handbook-2026-09-30/README.md): all 21 bilingual guides, worked examples, accessible figures and complete Markdown/JSON/MCP/CLI reading.

- [wenbu.app domain migration: live DNS, HTTPS, redirects and compatibility verification](domain-migration-2026-09-30.md)

## Latest: analytics trends and multidimensional filters (2026-09-29)

The [analytics visualization release](analytics-trends-release.md) records hourly/daily curves, 1/3/7/14/30/90-day and custom-date filters, ranked distributions, exports, 178 tests, local fixture/browser evidence and the separate release checks. The Grok CLI attempts did not return a verdict.

## Latest: private feedback and retained usage history (2026-09-29)

The [feedback and history release](feedback-history-release.md) records bilingual feedback, linked event history, private D1/R2 storage, authenticated exports and administration. Evidence includes 150 passing tests, CI, offline delivery recovery, live feedback correlation, a verified R2 archive and real DeepSeek tool phases. Grok CLI did not return a completed review; that limitation is separate from the successful tests and production checks.

## Latest: article covers and browsing views (2026-09-29)

The [cover release](library-covers-release.md) restores illustrated covers across the library, homepage and notes, adds a thumbnail list view, and records a reproduced search regression, its repair, two Grok reviews and responsive browser checks. See the [cover design](../plans/2026-09-29-library-covers.md) for image, motion and accessibility choices.

## Latest: beginner library and bilingual editorial review (2026-09-29)

The [library content release](library-content-release.md) records 21 bilingual guides, new reading paths, topic search, article companions, Agent Team cross-review of knowledge, GTM and interface documentation, and separate local, Cloudflare and live evidence. The [design](../plans/2026-09-29-library-content-design.md) explains the beginner journey and measurement boundaries.

## Latest: bilingual interface and motion polish (2026-09-29)

The [interface polish release](interface-polish-release.md) records responsive English/Chinese layout fixes, useful input and result hints, restrained event-driven motion, three Grok review passes, browser measurements and release evidence.

## Latest: guided Agent conversations (2026-09-29)

The [guided conversation release](agent-guidance-release.md) adds intent-based onboarding, editable clarification options, contextual follow-ups and a privacy-bounded guidance report. It records three Grok reviews and fixes, keyboard/mobile QA, real DeepSeek turns, Cloudflare deployment, exact served assets and analytics receipts. Earlier records below retain their historical scope.

## Original deck and analytics (2026-09-29)

The [deck and analytics release](deck-analytics-release.md) records 78 generated illustrations, historical DST calculation repair, clearer product entry points and first-party usage measurement. It separates local validation, Grok review, Cloudflare deployment and actual data receipts. Historical counts and deployment IDs below refer to earlier releases.

Verification date: 2026-09-28. Records distinguish local checks, deployed responses, browser checks and search outcomes.

Public repository: https://github.com/Digidai/wenbu. Initial application commit acb9ee01288ab6afba75ffc764d52c260fade633 passed the GitHub Linux clean-install, typecheck, 54 tests, build, site audit and lint workflow: https://github.com/Digidai/wenbu/actions/runs/36400663693. The repository's Quality workflow runs the same checks on subsequent pushes. The deployed application recheck is recorded separately in live-final.json; the final CSS-only polish is checked against the served asset in asset-final.json.

## Agent workspace release (1.1.0)

The [visual notebook release](agent-visuals-release.md) adds original instrument icons, compact tool activity, interactive report diagrams, chapter disclosures and expandable source excerpts. Its evidence separates scripted UI checks, actual DeepSeek generation and revision, source reviews, and deployment.

The later [generation motion release](agent-motion-release.md) adds event-driven paper/ink motion, persistent pause and system reduced-motion support. Its research, actual Grok verdicts, controlled browser playback and real production checks are documented separately.

The follow-up [report retry fix](report-retry-fix.md) corrects the source-preparation failure and misleading historical attempt status identified by the user. Its [production evidence](report-retry-live.json) is separate from the initial release acceptance below.

The independent Agent entry is a later release. Its current evidence is in [Agent release verification](agent-release.md), with [harness research](../research/agent-harness-2026-09-28.md), [design review](agent-design-review.md), [code review](agent-code-review.md), and [focused verification](agent-fixes-review.md). These reviews returned actual Grok CLI verdicts; fixes and limits are recorded separately. The earlier 54-test release below remains historical evidence, not the current test count. `live-smoke.json` is the most recent public regression check; initial AI evidence is preserved in `local-ai-smoke.json` and the original release records.

## Original four-tool release (1.0)

## Completed checks

- Production build: 63 HTML pages; 60 indexable pages. Journal pages and 404 are noindex.
- Typecheck: Astro and Worker TypeScript, zero errors/warnings.
- Tests: 54 passing, covering calendar fixtures and edge cases, all64hexagram identities, tarot invariants, API validation/origin/body boundaries, actual SQLite quota queries and MCP messages.
- ESLint: passing.
- Static audit: 2390 internal link/asset references, canonical destinations, locale alternates, JSON-LD and metadata checked.
- Production dependency audit: zero reported vulnerabilities at check time. This is not a promise that dependencies have no unknown issues.
- Secret scan of every built asset: the provided key was absent. .dev.vars is Git-ignored; secrets are Cloudflare Worker secrets.
- Official DeepSeek authentication and real synthetic requests: successful. Requested deepseek-v4-flash; served deepseek-flash. See local-ai-smoke.json and live-smoke.json.
- CLI: actual HTTP call from public/wenbu.mjs; known all-yang hexagram returned1.
- Cloudflare first deployment: live custom hostname and TLS verified. workers.dev and preview URLs disabled.
- Final deployed version: 04fc86dc-566b-45cd-a2f3-e8ef4a24b3a2. See deploy-final.txt.
- Live smoke: 60 indexable pages plus8public assets/error routes; all four APIs; official MCP Client initialize/list/call/resource listing; privacy headers; invalid-input, oversize and foreign-Origin checks. See live-smoke.json.

## Browser checks

Codex browser at desktop viewport and390×844mobile viewport:

- Homepage, responsive navigation, typography and bespoke SVG illustration.
- BaZi example chart, visible element counts, mobile no-horizontal-overflow.
- Actual DeepSeek request with explicit consent and synthetic data; structured result, model provenance and remaining allowance.
- Save reading and note, navigate to journal and open persisted details.
- English tarot: three separate selection actions produce three distinct cards; card reveal, reversed label and mobile layout checked.
- I Ching: real cast, original/resulting hexagrams and marked moving lines; context-export preview.
- BaZi context download: the browser produced an actual JSON file; its contents were independently inspected. Birth details were excluded by default. See download-smoke.json. The browser download-event waiter timed out, so the filesystem receipt is the evidence of download success.
- Zi Wei: live calculation and final local traditional branch-position layout; selectable palace, stars and age interval; mobile layout checked.
- No browser console errors in inspected tool flows. Additional browser engines, real mobile hardware, Lighthouse and real-user Core Web Vitals are not claimed as tested.

Saved evidence: [desktop homepage](screenshots/home-desktop.png), [mobile homepage](screenshots/home-mobile.png).

## grok-cli review

### Architecture review — completed

Invoked installed grok-cli read-only against the design contract and Wrangler config before runtime implementation. Its P0 entries were missing implementation requirements, not observed production defects. The returned report is preserved in [grok-architecture.md](grok-architecture.md); the dispositions below supersede its preimplementation status statements.

Disposition:

- Calendar conventions, DST rejection, late Zi options, unknown-hour omission and upstream/independent fixtures implemented.
- Singleton global SQLite object, atomic dual-counter reservation, input/output limits, timeout and explicit Shanghai day implemented.
- Stateless Web-Standard MCP; both slash variants; real official-client smoke implemented.
- POST-only private payloads, no-store/noindex responses, explicit selected context and privacy statements implemented.
- IPv6 /64 grouping, request rate limit, custom host only, real canonical/hreflang/sitemap implemented.
- Alarm pruning preserves current-day allowance and expires older rows.

Two recommendations were deliberately not adopted:

1. Refund every failed upstream request: a timed-out provider can still bill. Attempts remain counted and this is disclosed.
2. Accept Origin:null and arbitrary loopback Origins on production: native clients omit Origin; only production same-origin is accepted in browsers, with loopback allowed solely for local development targets.

### Implementation review — no verdict returned

Broad, focused, isolated-session and small-function attempts did not produce a final verdict. The last attempt used grok-4.7-build-fast with a verbatim source snapshot, a read-only prompt, web search and subagents disabled, and one model turn. After more than 11 minutes with no output it was interrupted on 2026-09-28. Earlier logs included a telemetry export network error; that does not establish the cause of the missing inference response. The prompt is retained as release-prompt.md. Raw CLI logs remain local and Git-ignored.

The architecture review is complete. The full implementation review by grok-cli is **unverified**, not passed. The deterministic tests, CI, manual source checks and live browser/API checks above are separate evidence and do not replace that requested review.

## Defects found and repaired during implementation

- Removed fabricated noon time from unknown-hour result display.
- Fixed quota alarm so it cannot reset the current day or delete the SQL table.
- Excluded JSON-LD blocks from executable CSP hashing, keeping Cloudflare header lines below2000characters. Verified live CSP.
- Corrected Skill download path, CLI example flag, source link and404language alternates.
- Prevented aborted AI responses from attaching to a new calculation; reset consent for new charts.
- Update a saved reading by stable ID instead of duplicating it after AI/note changes.
- Preserve original question, selected context and model provenance in saved readings.
- Reject I Ching interpretation input without original lines instead of silently casting again.
- Added accessible name to the mobile journal icon; fixed duplicated“宫”suffix.
- Increased the contrast of empty-state and resulting-hexagram secondary text.
- Keep secrets out of browser builds and public Git files.

## Bounds of this release

Calendar outputs follow the disclosed engine conventions; no “all schools agree” or prediction-accuracy claim. Live success is not search submission, indexing, ranking or traffic. No GSC/Bing submission, paid product testing, trademark clearance, registrar purchase, broad browser certification or uptime/SLA result is asserted.
