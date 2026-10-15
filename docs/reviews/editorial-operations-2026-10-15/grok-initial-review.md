# Grok CLI initial review

Read-only review completed with exit 0 on 2026-10-15. These findings describe the pre-repair snapshot; see the repair ledger and regression tests.

**Durable execution and idempotency**

- The 25-minute lease is taken only inside the cached `claim-topic` step (`worker/editorial-store.ts` 23–28). Later steps may each run for 5 minutes plus one retry (`worker/editorial-workflow.ts` 32–35), and a resumed instance does not run `claim-topic` again. `publishEditorial` still requires `lease_until > now` (`worker/editorial-store.ts` 135–137). When that check fails, the run is stored as `blocked` and a retry cannot take the lease again, because `release-editorial-lease` is already a completed step (`worker/editorial-workflow.ts` 160–173).
- `countCall` increments `model_calls` before the model request (`worker/editorial-workflow.ts` 45–50, 75–77). A retried step counts again. The cap is 4, and the repair path needs 4 calls (`94–130`). One transient failure leaves no budget for repair, and the next increment throws `editorial_model_budget`.
- `publishedAt` and `updatedAt` are created inside the publication step (`worker/editorial-workflow.ts` 142–156). The revision id does not include them. A replay hits `INSERT OR IGNORE` on `editorial_revisions` and `ON CONFLICT DO UPDATE` on `editorial_publications` (`worker/editorial-store.ts` 132–142), so the stored revision JSON and the live document JSON diverge. `published_at` on the publication row is not updated.
- `attempts` increments at claim time (`worker/editorial-store.ts` 65–73) and the selector requires `attempts<3` (line 50). The same highest-priority topic is chosen for every slot. Three transient failures leave it `ready` forever. `replenishTopics` will not replace that path (`worker/editorial-workflow.ts` 274–286).
- `dispatchEditorial` treats a missing `editorial_runs` row as a free slot (`worker/editorial-workflow.ts` 188–193) and always uses the id `editorial-${slot}`. If the workflow errors before that insert (`editorial_busy`, `editorial_backlog_exhausted`, or a storage error at `worker/editorial-store.ts` 29 and 64), the instance id is already taken. `slots.find` keeps returning that slot, so the 15:00 and 21:00 runs never start. The IndexNow cron calls this every 15 minutes (`worker/index.ts` 434–438).

**Bilingual publication**

- Extend research reads only the English original: `knowledge/en/${slug}.md` or `/en/compare/${slug}/` (`worker/editorial-research.ts` 30–45). Seeded extend topics include `first-reading`, `tarot-beginner`, `birth-time-timezone`, `fatetell`, and `labyrinthos`. The Chinese page is still published and appended (`worker/editorial-render.ts` 216–237) from a draft that never saw the Chinese original. The cited “current” source URL is the English document.

**Citation integrity**

- On extend pages, `rewriteMetadata` replaces the page title and the only `application/ld+json` script with the addition’s headline, dates, and `citation` URLs (`worker/editorial-render.ts` 89–160). The original `<h1>` and the original source list stay in the body (`216–237`). Structured data no longer matches the visible article.
- `/knowledge/index.json` overwrites an existing guide that shares the slug (`worker/editorial-discovery.ts` 83–102). `first-reading`, `tarot-beginner`, and `birth-time-timezone` stop being `guide-${slug}` and lose the original catalogue record.
- Compare extensions do not merge the original page into Markdown or JSON (`worker/editorial-render.ts` 177–185). Those responses are `scope: "full"` and `truncated: false` (`191–203`) while the HTML page still shows the original comparison and its sources.
- Knowledge URLs treat a leading `compare-` as a comparison (`worker/editorial-render.ts` 172–174`, `worker/traffic.ts`145–152). A learn slug such as`compare-tools`is allowed by`candidateSchema` (`worker/editorial-workflow.ts`199–201) and is then resolved as`compare/tools`, so the learn export 404s or serves another document.

**Security**

- Allowlisted pages are fetched at publish time and passed to the model (`worker/editorial-research.ts` 47–66). `draftIssues` only checks that section and table source ids were in that fetch set (`worker/editorial-schema.ts` 119–132). Whether those excerpts support the claims is decided by a second call to the same `editorialModel` (`worker/editorial-workflow.ts` 95–121). A later edit to an allowlisted vendor or GitHub page can instruct both calls to approve text the excerpts do not support. FAQ, figure, example, and glossary have no source ids (`worker/editorial-schema.ts` 23–54).
