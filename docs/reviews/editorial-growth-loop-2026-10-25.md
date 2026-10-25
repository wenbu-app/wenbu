# Continuous editorial delivery review

Policy 4 keeps three bilingual reader tasks per day and changes how the system recovers an unfinished slot. It does not lower publication gates or equate publication with search traffic.

## Changes reviewed

- Six demand lanes provide bilingual keyword hypotheses, reader intents and source-backed outcomes. Real search queries retain their provider and time window; no keyword volume is invented.
- Canonical commissioning admits distinct new owners and substantial missing coverage on existing owners. The critic must explain the contribution. Active duplicate reservations, format-only variants, unknown sources and unregistered comparison partners remain rejected.
- Each article receives up to three independent writing/review rounds, with actionable correction feedback and archived versions. A failed slot can select another supported task through the existing reconciler, with a 15-minute delay and six-attempt cap.
- Source health is recorded and reused in selection. Existing language copies are not counted as two newly read supporting sources. Research reads current public content, not just its static baseline.
- Daily planning runs at 06:30 Shanghai. A depleted reserve can be replenished in deduplicated six-hour buckets through the existing reconciler. Publishing has priority, and content/planning share the editorial lease.
- A persistent reservation precedes each provider request. Caps are twelve requests per article, 120 per Shanghai day and eight planning requests within that total. Lost acknowledgements can consume budget conservatively but cannot bypass it.
- A new addition preserves original text and previous reviewed additions. Public document identity remains stable, and revision-specific section anchors keep earlier MCP citations readable. Explicit corrections replace the affected latest edition rather than retaining incorrect text as a new addition. Immutable earlier revisions remain available privately.
- Production reports count successful slots once, distinguish today's due slots from tonight's target, report source-viable reserve and surface failure feedback. Daily growth reviews and actual search/weekly observations feed the next planning pass. The authenticated Insights panel exposes the same delivery and keyword coverage report.

## Verification and limits

Codex review covers scheduling deduplication, source identity, current-owner reading, cumulative content, exact section reads, CAS, request reservations, publication history and privacy boundaries. Tests include a repair succeeding on the third round, a failed draft never replacing a live edition, a repeated completed slot, an unavailable comparison source, an accepted substantial merge and concurrent requests at the daily budget boundary.

Native integration tests use workerd, Workflows, D1, R2 and HTMLRewriter with synthetic providers. They do not establish the quality of a real generated article. Production planning/publication must be checked against actual terminal receipts and both public language editions; raw operating data remains outside this public repository.

A read-only Grok CLI attempt disabled tools, web and subagents. It returned no output before a 102-second timeout. Its review is unavailable, not passed. A second read-only follow-up attempt for the batch fix also returned no output within 65 seconds; it provides no approval.

The Cloudflare production schedule runs independently of a laptop. Authenticated Google/Bing and neutral AI-answer reviews continue through the existing Codex heartbeat and depend on the execution host and valid browser access. Google requests, actual indexing, visits, server-confirmed use and AI citations remain separate evidence. IndexNow pauses and all prior failure/acceptance history are unchanged.

## Proposal batch follow-up

Live validation exposed a whole-array size gate that rejected two model responses even though every individual candidate was valid. Policy 4 validates items independently, sends at most 24 candidates to each critic, and retains overflow in private R2 for later passes. A one-time compatibility path recovers archived proposals from the preceding zero-admission policy. Recovered proposals receive fresh ownership/source review; recovery itself never admits them.

The private checkpoint retains a superset until the atomic D1 admission commits. A failed transaction leaves candidates recoverable. A cleanup outage can conservatively repeat criticism, but existing topic IDs prevent duplicate admissions. Complete decisions remain in per-run R2 archives; D1 receives a bounded projection. Zero admissions produce an `unfilled` receipt.

Regression coverage includes 28/26-item responses, invalid and duplicate neighbors, legacy archive recovery, bounded critic batches, reserve overflow, later pending-pool reuse, admission rollback without candidate loss, and a rejected proposal repaired under its original stable ID. Existing quality gates and publication history remain enforced.
