# Search delivery reliability

Keep publication, notification receipts, provider observations and actual indexing as distinct states. Do not erase failed requests, reset a provider pause, rotate endpoints to evade limits, or use Google's restricted Indexing API for general articles.

1. Audit the stored notification timeline, public ownership file, deployed manifest, current provider reports and active schedulers. Keep production operating data in the private operations directory.
2. Add bounded, sanitized IndexNow response diagnostics, an adaptive pause for repeated rejection, fresh-publication priority and fair selection after a rejected URL. Keep the daily scan, existing receipt history and longer Retry-After values.
3. Run the daily IndexNow attempt through a durable Cloudflare Workflow. Wait out small execution-time drift instead of silently skipping the next day; defer longer provider pauses without waking multiple outbound attempts.
4. Expose the next eligible Google job and a separate persisted URL-inspection ledger. Schedule follow-up checks without turning a requested receipt into an indexed result. Preserve uncertain dispatches and the shared quota pause.
5. Expand the existing technical health check to cover both language HTML, Markdown, JSON, sitemap membership and real destinations, and include delivery backlog/inspection due work in its observation.
6. Give the authenticated browser delivery work a daily evening slot after publication and IndexNow, while retaining the morning search/GEO review. Update the existing automation rather than duplicating article production.
7. Verify meaningful regressions and native runtime behavior, obtain a read-only Grok CLI review, merge through CI, deploy the reviewed tree, apply additive migrations and read back live state. Respect an active provider pause during verification; inspect the next eligible real attempt afterward.
