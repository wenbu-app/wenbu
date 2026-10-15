# 日签 / Daily card

## Decision

Add a bilingual `/daily/` and `/en/daily/` entry, discoverable from the home page and navigation. A daily card is a short reflective practice: reveal an illustrated upright tarot card, try a small action, then optionally record what actually happened. No birth form, signup gate, model call, or Agent allowance is required.

This is a retention and activation hypothesis, not a proven uplift. Three approaches were considered: personalized daily BaZi forecasts (birth-data friction and unclear prediction claims), generic luck scores (little durable value), and a stable daily card with a practical prompt (recommended, fits the existing deck, journal and guest-to-account journey).

## Research checked on 2026-10-15

- [Labyrinthos one-card reading](https://labyrinthos.co/pages/one-card-tarot) connects a small daily meditation to its journal and learning tools. Adopt the short practice and continuity; do not copy its artwork or wording.
- [CHANI app](https://www.chani.com/app?view=home) combines recurring content with reflection prompts and a journal. Adopt the content → reflection connection, without implying equivalent personalization or business results.
- [Lally et al. 2010](https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674) studied repeated everyday behaviours in a consistent context. This supports investigating a light daily ritual, not a claim that tarot improves wellbeing or that Wenbu retention will rise. Avoid punitive streaks and missed-day pressure.

## Experience

An editorial paper layout uses the existing original deck artwork, a restrained opening motion, visible date/timezone, one action and one evening question. Buttons remain disabled until hydration. Motion never delays access to the result and respects reduced-motion preferences. All 78 cards have original bilingual daily practices, including constructive, non-alarming treatment of traditionally difficult cards. There are no luck scores, reroll button, fabricated personal forecasts, automatic notifications or forced sharing.

After value: the guest sees that the entry is temporarily held in this browser and may explicitly save this entry to a free account. Signed-in users reuse existing cloud history and its revision/conflict/outbox system. A reflection is saved on explicit action. Continue-with-Agent carries the existing card, never redraws or spends a turn before the user sends a message. Authentication email is not treated as marketing consent.

## Architecture and safeguards

`POST /api/v1/daily` accepts only a valid IANA timezone, status/reveal operation, optional browser seed and an optional prior signed result. The server chooses the current calendar date and next midnight (DST-aware). The card is derived with HMAC from the stable guest/account identity and calendar date. Locale and timezone spelling do not change a card for the same date. It is a reproducible symbolic selection, not a random fortune or an astronomical calculation.

Existing daily journal records are reused for account continuity. A signed guest result may be carried into the same account after login, so signing in need not replace today's card. Results use the existing signed receipt and account save protocol. No new personal-data table or independent authentication system is introduced. Cookies and browser caches have the existing guest/account isolation rules. HTTP responses are private/no-store. The server does not accept a caller-chosen future date or card. Failed requests do not show a fabricated card; storage failures keep the result visible and allow export/retry.

The client checks server time on opening, foreground return and midnight. An old page cannot silently represent yesterday as today. Same-day revisits skip the opening ceremony; no multi-second artificial wait is added.

## Measurement

Extend the closed analytics vocabulary with the daily page/tool, reveal, revisit, reflection save and Agent handoff events. Keep server-ready responses separate from visible reveals and cloud persistence. No card notes, questions, email or birth data enter telemetry. Respect opt-out and test traffic exclusion. Insights shows daily usage and visitors who reveal on two or more distinct days in the selected report window; explicitly label this as repeat use, not D1/D7 cohort retention. D1/D7 uplift requires mature cohorts and an experiment or credible comparison; no launch-day claim is made.

## Release checks

Test server-day/DST rollover, identity stability, locale stability, guest-to-account adoption, signed-result tampering, schema validation, account isolation, blocked storage and closed-vocabulary analytics. Run the complete existing verification suite and lint, review the change, then exercise Chinese/English desktop/mobile, keyboard/reduced-motion and reload flows in a real browser. Deploy to the existing Cloudflare Worker, verify production bytes and live flows, and distinguish IndexNow acknowledgement from actual indexing or traffic.
