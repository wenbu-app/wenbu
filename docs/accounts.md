# Email accounts, guest trials and cloud history

Wenbu keeps the complete guest experience available. Email sign-in creates a verified account only after a six-digit code succeeds. Signing in to save a current result retains that result; it does not redraw cards or rerun a model. The account panel is available on Chinese and English pages.

## User behaviour

- Guests keep journal entries and conversations in their browser. The current result can be explicitly saved when signing in. Older browser records require selection; there is no automatic upload of the whole browser history.
- With cloud history enabled, a signed-in Agent message is acknowledged by the server before model generation. The server saves response checkpoints and the final state. Closing the page cancels the running task; this is not a background execution service.
- Saved cloud records are authoritative. The UI loads them into memory, independently of the browser's small localStorage allowance. Unsynced edits and paused-history changes have an account-owned local recovery buffer. A buffer capacity failure is visible and offers export; it does not truncate old records.
- Empty conversations are drafts, not cloud records. A current guest copy that conflicts with a newer cloud conversation must be kept as a new copy or discarded explicitly.
- Pausing cloud history leaves existing records intact. New local changes remain local after resuming until the user edits the record again. Pending and browser-only changes must be exported/retried or explicitly discarded before signing out.
- Account exports fetch every paginated record, verify revisions and reread the manifest. A changed revision rejects the export as incomplete. Exports include outstanding changes and paused-history copies.
- Public CLI/MCP continue to operate without accounts. They cannot read private cloud history. Private OAuth/MCP, passkeys and multi-user offline collaboration are outside this release.

## Storage and ownership

`USERDATA` is a separate private D1 database from `ANALYTICS`. It contains Better Auth identities/sessions, account settings, records, per-message parts, mutation receipts and consented account metrics. No content is copied into traffic analytics or R2 event archives.

Every list, read, write and export derives its owner from a verified session. Browser requests also send the expected owner; this rejects stale requests after another tab switches accounts. Origin checks protect mutations. Private responses are `private, no-store`, noindex and vary on cookies. Session secrets remain in HttpOnly cookies and are stripped from JSON responses.

Limits: 10 MiB of account content, 256 KiB per journal entry or chat message, and less than 1 MiB per record transfer. A conversation has at most 160 messages. The manifest pages through 50 records with a deterministic cursor; message parts are read together with their metadata in a D1 batch. Requests exceeding limits are rejected, never truncated. Authentication and index overhead are separate from the visible content allowance.

Writes use expected revisions, server content hashes and UUID mutation keys. D1 batches conditionally acquire a mutation before updating records, parts and byte counts. A repeated request acknowledges the original revision. A different payload under the same key is rejected. Browser imports use owner, schema, original ID and hash; repeat imports do not create duplicates.

## Authentication and mail

Better Auth 1.7.7 is pinned and exercised in workerd against native D1. Codes expire after five minutes, are encrypted at rest and are consumed once; three incorrect attempts invalidate a challenge. Resending rotates the code. Sessions expire after 30 days, cookie session caching is off, and session IP/UA columns are blanked on create/update.

The sender is `login@wenbu.app` through the Cloudflare Email Sending binding. The handler waits up to 12 seconds for provider acceptance. A provider error returns a failed state; timeout returns unknown. Better Auth's successful handler status alone is insufficient because the library catches mail callback errors; a request-scoped callback outcome determines the public response. There is no post-response promise masquerading as durable email delivery.

Durable limits include a 60-second email cooldown, six sends per mailbox/hour, 30 sends per network/hour and the configured global send budget. The OTP endpoint also allows at most 20 requests/network/minute, while each challenge still has three attempts. Rate-limit storage failure fails closed. Cloudflare provider quotas are independent of these application limits. Acceptance does not establish inbox delivery or deliverability across QQ/163/Gmail/Outlook.

## Quotas

The existing global UsageGate remains authoritative. A signed seven-day guest cookie identifies trial usage, not a user account. Guest-to-account linking moves current-day usage atomically in the same Durable Object without incrementing the global budget. Late requests resolve the same alias. Duplicate operation IDs are rejected before another paid call, including across sign-in and midnight.

Identity allowances are five AI interpretations and 12 Agent turns/day. Additional network ceilings are 50 interpretations and 120 turns; global budgets remain configured independently. Existing network-based usage cannot be attributed retroactively to an individual. The release does not reset the existing global counter. Actual provider tokens/cost are not inferred from allowance units.

## Deletion and restoration

`DeletionLedger` is an independent SQLite Durable Object namespace. An owner-specific HMAC names each instance. It stores an opaque owner ID, target IDs, deletion time and expiry, without email or content. The deletion intent is written before D1 erasure. Reads and writes check the ledger and fail closed if it is unavailable.

An alarm retries uncompleted erasure. A failed purge remains blocked even after its nominal expiry. Successful deletion markers remain for 45 days; D1 record tombstones contain no content and prevent stale requests from recreating deleted IDs. Restoring in the journal UI creates a new copy. Whole-account deletion requires a sign-in within the last ten minutes and explicit `DELETE`; identity, sessions and content cascade away.

After a USERDATA Time Travel restore:

1. Deploy `ACCOUNTS_MAINTENANCE=true` before restoring. Keep the same `ACCOUNT_DATA_KEY` and deletion namespace. Private routes return 503.
2. Restore USERDATA only. Do not restore/reset the independent ledger.
3. POST `/api/admin/accounts/reconcile` with the existing admin authorization and exact site Origin. It reapplies account/record deletion intents and revokes all sessions and outstanding codes. A failure keeps maintenance on; repeat the reconciliation.
4. Check the reconciliation response and synthetic isolation tests, then deploy maintenance false. Users sign in again.

Local workerd tests simulate restoration by putting deleted data back into native D1; the independent ledger still masks reads and rejects writes. This is different from an operator exercising a remote Cloudflare Time Travel restore. Do not describe the local test as a production restore drill.

## Account measurement

`account-v2` metrics live in USERDATA and are not joined to anonymous traffic IDs or email addresses in traffic reports. The account panel is fully masked and pauses Clarity while open. Browser measurement preference, DNT and GPC control optional operation/instance measurement.

- Registration is a server-created verified account, including operational counts for opt-outs. A returning login is not a new registration.
- Activation requires a server-signed result and successful save within 24 hours of account creation. The signed result may be from a consenting guest in the preceding seven days. Examples, unsigned legacy imports and opt-out results do not count.
- Guest conversion uses a fixed cohort of first server-completed trials. Registration and save have a seven-day window. Immature samples are shown separately; no changing-denominator conversion claim is made.
- Day 1 / Day 7 are complete Asia/Shanghai calendar days following activation day. Only mature activated cohorts enter each denominator, and a new completed operation is required.
- Repeat value requires a new completed operation after activation. Cross-instance continuation requires a different random first-party installation to read an older cloud record and then complete an operation within 24 hours. This does not prove a different physical device or natural person.
- Opt-out operations are not backfilled after opting in. Deleted accounts disappear from live cohorts. Report labels distinguish rolling cohort windows from natural-day email counters and chart groups.

Operation/mutation receipts and trial cohorts are pruned after 90 days in bounded hourly batches. Expired sessions/codes are also pruned. Account instance metadata lasts until account deletion. Signup prompt views and authentication starts are optional browser events; email-provider outcomes are server counters. Provider accepted is not delivered-to-inbox.

## Operations and release gates

Required bindings: `USERDATA`, `PRIVACY_LEDGER`, `AUTH_EMAIL`; server secrets: `AUTH_SECRET` and stable `ACCOUNT_DATA_KEY`. Never commit them or embed them in frontend code. Rotating AUTH_SECRET invalidates authentication material; changing ACCOUNT_DATA_KEY loses the mapping to deletion ledgers and must not be treated as routine rotation. Back it up independently of D1.

Apply all files under `migrations-userdata/` before deploying. Routine rollback must preserve private-route authorization, maintenance controls and deletion retries. Disable accounts with the current feature flag if necessary; do not roll back to a version that reopens deleted data or removes its erasure path.

```sh
npm run verify
npm run lint
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply wenbu-userdata --remote
npm run deploy
```

`npm run test:accounts` uses production handlers, native D1 and real Durable Objects with synthetic local mail/model responses. `node scripts/preview-accounts.mjs` provides a disposable local UI environment after a build; it reads no production credentials, cannot send real mail and loses its test data on exit.

Keep separate receipts for local tests, exact commit CI, deployment, live account route availability and actual mailbox delivery. The latter requires an authorized test recipient; no synthetic mailbox test proves deliverability. Start with a small application email budget, inspect failed/unknown send counters and pending saves, and disable account writes if owner isolation or deletion is compromised. Notify on repeated auth/provider failures and preserve existing records during rollback. Product retention and conversion need real mature cohorts; code checks do not establish growth.
