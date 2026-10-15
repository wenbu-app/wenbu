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
