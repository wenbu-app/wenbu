# Wenbu CLI

Node.js 22.12+ · MIT · no dependencies. Run calculations, read complete bilingual guides, or explicitly send a turn to Wenbu's DeepSeek Agent.

## Download and inspect

```sh
curl -fsS https://wenbu.app/wenbu.mjs -o wenbu.mjs
# Inspect wenbu.mjs before running it.
node wenbu.mjs --help
node wenbu.mjs iching '{"lines":[7,7,7,7,7,7],"locale":"en"}'
node wenbu.mjs daily '{"timezone":"Asia/Shanghai","locale":"en"}'
node wenbu.mjs library
node wenbu.mjs guide bazi-basics en
```

The daily command returns a stable upright card, a small action and a reflection question for the server-confirmed local date. It does not use birth data or a model. Native clients without a `seed` share a public card; pass a stable random UUID `seed` for a separate identity, never an email or birth detail. This is independent of private website accounts.

The fixed-lines example returns hexagram 1 with no changing lines. Calculations and guide reads do not call a model or require an account/key.

Release tarballs also install locally: `npm install --global ./wenbu-cli-1.3.1.tgz`, then `wenbu --help`. Verify the release SHA256SUMS first. The downloadable archive is independent of npm registry publication.

## Personal inputs

Use one named file or stdin; avoid putting birth details or private text into shell history:

```sh
node wenbu.mjs bazi --file birth.json
cat birth.json | node wenbu.mjs bazi -
```

The CLI reads only that input. It does not discover files or attach old conversations. [Synthetic input and complete protocol](https://wenbu.app/en/agents/?utm_source=github&utm_medium=referral&utm_campaign=open-source-2026).

`WENBU_ANALYTICS=off` opts out of coarse service and guide-request analytics. `WENBU_TEST=true` marks validation requests as tests. `WENBU_URL=http://127.0.0.1:8787` selects local development; other endpoints must use HTTPS. Requests can be limited per network; inspect errors before retrying.

The `agent --file request.json` command sends the selected message/history/context to DeepSeek through Wenbu and requires `consent:true`. It returns NDJSON events. Check the final `done` event: `complete`, `waiting`, `limited` and error are different outcomes. No terminal event means an incomplete stream. AI has [published daily allowances](https://wenbu.app/en/free/).

[Source](../../public/wenbu.mjs) · [OpenAPI](https://wenbu.app/openapi.json) · [Privacy](https://wenbu.app/en/privacy/) · [MIT license](../../LICENSE)
