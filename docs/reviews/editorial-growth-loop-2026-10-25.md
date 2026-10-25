# Continuous editorial delivery review

Policy 3 keeps three bilingual reader tasks per day and changes how the system recovers an unfinished slot. It does not lower publication gates or equate publication with search traffic.

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

A read-only Grok CLI attempt disabled tools, web and subagents. It returned no output before a 102-second timeout. Its review is unavailable, not passed.

The Cloudflare production schedule runs independently of a laptop. Authenticated Google/Bing and neutral AI-answer reviews continue through the existing Codex heartbeat and depend on the execution host and valid browser access. Google requests, actual indexing, visits, server-confirmed use and AI citations remain separate evidence. IndexNow pauses and all prior failure/acceptance history are unchanged.
