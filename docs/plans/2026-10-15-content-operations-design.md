# Wenbu bilingual content operations

Goal: operate three quality-gated bilingual topic publications per Shanghai day, with traceable topic selection, durable Cloudflare execution, search notifications and scheduled search/AI review.

## Architecture

Cloudflare Cron starts durable Workflows at 09:00, 15:00 and 21:00 Asia/Shanghai. D1 holds topics, runs, immutable publication revisions and review observations. Private R2 objects retain research, drafts and model reviews. The existing DeepSeek binding generates and separately reviews complete Chinese and English editions. Publication is an atomic D1 operation after deterministic and model review gates. No local computer is needed for article production, serving or IndexNow retries.

Published additions use the existing Wenbu layout and responsive editorial components. Existing guides keep their original content; separately reviewed additions extend the same canonical URL. New content is available as HTML, Markdown and JSON, in the knowledge index and MCP library. Sitemaps and IndexNow merge static and published content. Drafts are never public.

## Editorial contract

Three topics means up to six language pages, not three translated fragments. Every topic records a reader task, canonical owner, unique example/figure, source IDs, product action, evidence and review dates. Selection rejects duplicate intent and expired windows. A finite, checked initial backlog is replenished weekly; exhaustion or failed review is an explicit blocked run, not permission to invent a filler article.

Automated research fetches allowlisted first-party sources with bounded bodies, redirects and timeouts. It records source hashes and actual fetch dates. Model outputs are untrusted structured data, never executable HTML. Citations can reference only the fetched packet. Numerical calendar examples must come from deterministic tools or reviewed source material. Comparison pages distinguish public vendor statements, observed Wenbu behavior, unknown account-only features and editorial judgment; no fabricated pricing, accuracy scores or universal winners.

Quality gates check both editions, completeness, source coverage, visual/table/example structure, duplicate content, safe links and substantive novelty. An additional model pass checks factual support, bilingual parity and natural expression. Failures retain evidence and defer publication; retries and spending are bounded. Editorial AI review is not claimed as independent expert review.

## Discovery and maintenance

The comparison hub exposes existing FateTell and Labyrinthos pages and adds researched product comparisons. A daily technical check records accessibility, canonical, hreflang, sitemap, machine-readable knowledge and IndexNow diagnostics. Weekly topic replenishment and 7/14/28-day reviews use observed evidence, not invented volume or rankings.

Search Console/Bing and consumer AI surfaces require their own authenticated access. A Codex heartbeat performs a bounded daily review using available logged-in sessions and web tools, persists observations to the same operations ledger, and reports expired access rather than guessing. This supplemental review requires the Codex host to be available; the Cloudflare production pipeline is independent. No unsolicited social posts, emails or paid monitoring subscriptions are enabled.

## Delivery gates

1. Unit tests for slot idempotency, topic ownership, language gates, citation boundaries, rendering and publication transactions.
2. Native workerd/D1 tests for publication and public/admin isolation.
3. Full existing checks, build and CI.
4. Live workflow run using the configured model; verify actual bilingual HTML, exports, sitemap, linked hub and database receipts.
5. Enable schedules and read them back. IndexNow 200/202, indexing, ranking, human use and AI citations remain separate observations.
