# Editorial source and syntax repair review

The `waite` source previously paired Waite's title with Gutenberg ebook 43548,
which Gutenberg attributes to L. W. De Laurence. The registry now links directly
to Waite's Part III, already used by the handbook for card and reversal entries.

Verified references:

- [Gutenberg catalog and author](https://www.gutenberg.org/ebooks/43548)
- [Waite, Part III](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3)

Completed malformed model JSON remains archived and rejected. The existing single
repair receives an explicit syntax instruction and a parser offset when available.
No brackets are silently inserted, no failed draft is accepted, and no extra model
call or transport retry is added. A native Workflow regression checks that the
syntax feedback reaches repair before the independent review and atomic publish.
The drafting instruction also distinguishes a coincidentally repeated card from
a draw that can be reproduced on demand.

Validation: 444 unit tests, native account and editorial tests, type checks, build,
site/art/knowledge/IndexNow audits and ESLint passed. A read-only Grok CLI review
was attempted with tools and subagents disabled. It produced no completed report
within the bounded attempt and was stopped; this is unavailable, not a review pass.
Operating evidence and model drafts remain private.
