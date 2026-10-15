# Editorial automation repair ledger

Grok CLI completed the initial read-only review with actionable findings (see `grok-initial-review.md`).

| Finding | Repair | Evidence |
| --- | --- | --- |
| Cached lease expires during durable execution | Reacquire at each model phase and publication attempt; never steal an active lease | Lease-recovery regression; native Workflow test |
| Transport retry consumes the repair budget | Four logical phases, one retry per phase, bounded eight physical requests; keep every physical call count | Native synthetic 503 retry plus review/repair checks |
| Publication replay changes dates or revision JSON | Prepare the document in a durable step and reuse the retained immutable JSON on replay | Revision/live JSON equality regression |
| Exhausted priority task blocks the queue | Prefer never-attempted tasks; mark exhausted candidates blocked | Queue-selection regression |
| Early failure takes an instance ID without a run row | Persist a queued row before dispatch; retry the same ID after an unknown transport outcome; retain early failures | Dispatch failure and next-slot regression |
| Only English original read for extensions | Fetch both canonical language originals before drafting | Bilingual research regression |
| Extension metadata contradicts original body | Preserve original title, publication date and source list; update modification and identify the added CreativeWork | Structured data regression |
| Existing guide catalogue identity overwritten | Keep original guide ID and add an editorial alias; complete library reads include additions | Knowledge-index merge and native exports |
| Comparison export claims full scope but omits base comparison | Include original comparison copy, table and sources in full Markdown/JSON | Original comparison export regression |
| Compare prefix can collide with learn exports | Reserve `compare-` for comparison exports; reject conflicting candidates and drafts | Reserved-prefix regression |
| Mutable source instructions and incomplete citation coverage | Treat excerpts as untrusted; reject explicit model-directed instructions; all factual components declare read source IDs; require literal supporting quotes with bounded external quotation | Injected-source and invented-quote regressions |

The quote check verifies literal presence, not semantic truth. A separate editorial model checks support and scope. AI review is not independent expert validation; unusual or unsupported material must remain blocked.

Also corrected conditional-asset caching: dynamic responses strip original validators and body lengths, so a static 304 cannot conceal a newly published addition.

## Follow-up review and live-model findings

Grok's follow-up found six areas requiring attention. Same-site HTTPS redirects are now bounded and checked at every hop; unrelated-host redirects remain excluded. Transient failures retain retryable topics with a 24-hour cooldown, while three actual quality failures quarantine a topic. Content diversity is a preference rather than a compare-only backlog deadlock. Orphaned queued rows reconcile with actual Workflow state. Existing guide titles survive on HTML, knowledge-index and Agent library surfaces. All source-bearing components now render their citations, evidence notes are public, and Chinese quote characters count toward the external quotation limit.

The review's statement that the array-form createBatch throws for duplicate IDs is incorrect: current official Cloudflare documentation states that it silently skips existing IDs. The stale queued-row risk is nevertheless real, and is repaired through terminal-state reconciliation.

The first real provider run exposed truncation and schema failures despite successful synthetic checks. Structured calls now explicitly disable the provider's default thinking mode, writing has a bounded section/length budget and full JSON Schema, raw visible outputs are archived before parsing, and schema failures enter the same single repair cycle with precise field paths. A native regression proves malformed output can be repaired and reviewed, without publishing the invalid first draft. Migration 0006 preserves failed attempts and permits one fresh attempt per failed slot, with no historical row deletion.

The next real runs exposed two additional protocol defects: a negated Chinese guarantee crossed punctuation into a prediction phrase, and the model put approval reasons into its blocking-issues array. The detector now respects negation and clause boundaries. Reviews receive their own JSON Schema, an explicit low reasoning budget and an instruction to put only blocking defects into issues; malformed review output remains a failed gate with retained diagnostics. A tightly scoped authenticated recovery command re-runs a repaired topic once more, keeping the failed rows, source evidence, and per-attempt request caps intact. The public comparison hub now has a specific bilingual description and comparison breadcrumb.

## Recovery review closeout

Grok's final recovery review identified missing CTA/evidence-claim safety coverage and unreconciled non-queued orphan stages. Both are repaired with regression checks; the publication step repeats deterministic validation immediately before persistence. Its remaining claim that a retry has no later trigger is contradicted by the deployed 15-minute dispatcher in worker/index.ts and the native dispatch retry checks. No cron is added to multiply submissions.

Published content also has an authenticated revision path: expected-revision concurrency checks, fresh research, bilingual generation and review, preserved first publication dates, immutable prior versions and a three-correction daily cap. This enables factual corrections without editing production JSON behind the quality gate. Comparison task titles now name their actual reader decision. Seed changes update only unattempted canonical tasks, preserving attempted definitions and historical documents.

A real bilingual revision reached the final review and exhausted its earlier 12k-token reasoning allowance. Review calls now have a 32,768-token bound and one transport retry in the final pass, still inside the eight-request run cap and five-minute step deadline. Invalid or truncated output remains blocked. Comparisons also read the current daily-product page so decisions are not reduced to engine and API documentation. Static comparison covers now use the same original vector illustration family as new pages.
