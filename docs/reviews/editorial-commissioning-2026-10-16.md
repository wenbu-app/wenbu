# Commissioning review and repairs

Two completed read-only Grok reviews checked the ownership gate and timing rules.
The deeper review identified missing dynamic body coverage, a whole-step replay
window around admission/audit writes, and unsafe parsing of a legacy observation.

Repairs load actual static and dynamic bilingual editions, include all reserved
tasks, store the large coverage snapshot in private R2, and add a durable attempt
ledger. Candidate admission, its audit, successful receipt and state timestamp
commit atomically. Replays return that receipt or retain a blocked result; failed
attempts also arm the cooldown. Legacy policy JSON is parsed defensively.

The claim that a normal topic claim removes the topic from `ready` does not match
the store: only `editorial_runs` advances through drafting/review states. The
catalog nevertheless includes every retained topic state to cover legacy and
quarantined reservations. The stale six-day timing concern is covered by the
depleted-reserve 24-hour rule and its Sunday timing regression test.

Tests include real native D1 transaction fault injection, failed/completed replay,
actual dynamic edition coverage, vendor aliases and complete review coverage.
Final follow-up review and release evidence are recorded after verification.
