# Daily URL notifications and priority Google requests

User authorization: IndexNow checks once per 24 hours; submit indexable non-article pages once through Search Console, then handle new article revisions automatically in the existing daily review.

1. Separate IndexNow's daily 22:30 Shanghai trigger from the editorial missed-slot trigger; remove deployment pushes and enforce a durable 24-hour scan minimum without resetting provider backoff.
2. Add a private D1 queue. Atomically enqueue published bilingual revisions, seed core public pages once, prioritize home/tools, retain accepted/blocked/uncertain receipts and pause globally on provider limits.
3. Validate unit and native D1/Workflow behavior, run a read-only Grok review, merge/deploy the exact reviewed tree, verify the cloud schedule and queue, then execute available authenticated Google requests until a real quota or challenge blocks further work. Update the existing heartbeat rather than creating another publishing timer.

Submission acceptance, actual crawl/indexing, rankings/traffic and AI answer citations remain independent. No search operating data or authenticated screenshots belong in public Git.
