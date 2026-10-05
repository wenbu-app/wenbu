# Email accounts and cloud history — 2026-10-05

This release implements the first email-account/cloud-history slice while preserving complete guest trials and public tool/MCP/CLI access. It does not implement private MCP OAuth, passkeys, background Agent execution or collaborative offline editing.

## Local evidence

- `npm run verify`: 302 unit/regression tests, native workerd integration checks, type checks, build and content/asset audits pass. The final native handler suite contains 64 checks with synthetic mail and model responses.
- Native D1 tests exercise guest-result activation, stable imports, concurrent revision writes, ownership headers, pagination, UTF-8/account byte limits, server Agent checkpoints, one-time/concurrent/expired/incorrect OTP handling, provider failures, opt-out metrics, fixed guest cohorts, mature activation-day retention and cross-instance continuation.
- Recovery tests recreate deleted native D1 records/identity/session rows, prove that independent ledger state still blocks reads/writes, then replay deletion in maintenance and revoke all sessions. Unit tests exercise erasure retries beyond nominal expiry. This is a local restore simulation, not a remote production Time Travel drill.
- Browser testing used the disposable preview: complete guest conversation → email verification → save original conversation → follow-up → reload, plus account sign-out and Chinese/English account screens. Initial blank-conversation redirection and empty cloud drafts were found and corrected. A stale guest reimport now conflicts instead of overwriting an existing cloud continuation.
- English mobile at 375 × 812: page scroll width 375; account dialog width 345. Native dialog focus, text wrapping and scrollable content were checked. Screenshots contain synthetic `.test` account data only.
- Lint, Worker bundle dry-run and production dependency audit pass; no vulnerabilities were reported by the audit at validation time.

## Provisioning

A separate private USERDATA D1, four additive migrations, stable account data key and auth secret were provisioned. Existing traffic D1, R2 archives, global quota and model configuration are retained. Cloudflare Email Sending showed wenbu.app enabled/configured. No real email was sent during these local tests.

## External checks and limits

Grok CLI was invoked but returned HTTP 402 (usage balance exhausted). It produced no review verdict. A test recipient was requested from the user; actual provider acceptance/inbox arrival/OTP verification across real mail services are not established by the synthetic tests.

No claim is made about production conversion uplift, retention, mailbox delivery rate, search indexing or acquisition. Public release status and live checks are recorded separately in `release.json` after deployment.

![English mobile account entry](mobile-en.jpg)

![Returning to the original conversation after sign-in](return-to-conversation.jpg)
