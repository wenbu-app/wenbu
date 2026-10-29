import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url),
  { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require('miniflare'),
  { build } = require('esbuild'),
  root = new URL('../', import.meta.url).pathname,
  temp = await mkdtemp(path.join(tmpdir(), 'wenbu-review-test-'));
let checks = 0;
const check = (name, value) => {
  assert.ok(value, name);
  checks++;
  console.log('PASS ' + name);
};
try {
  for (const [name, entry, external] of [
    ['worker', 'tests/editorial-worker.fixture.ts', ['node:*', 'cloudflare:*']],
    ['draft', 'tests/helpers/editorial-fixture.ts', []],
  ])
    await build({
      entryPoints: [path.join(root, entry)],
      outfile: path.join(temp, name + '.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      external,
      logLevel: 'warning',
    });
  const { fixtureDraft } = await import(pathToFileURL(path.join(temp, 'draft.mjs')).href);
  for (const scenario of ['criticism', 'exhausted', 'malformed-approval']) {
    const inputs = [],
      draftInputs = [];
    let mf;
    mf = new Miniflare({
      ...convertV4MiniflareOptions({
        host: '127.0.0.1',
        log: new Log(LogLevel.ERROR),
        workers: [
          {
            name: 'review-tests',
            script: await readFile(path.join(temp, 'worker.mjs'), 'utf8'),
            modules: true,
            compatibilityDate: '2026-09-28',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['ANALYTICS'],
            r2Buckets: ['ANALYTICS_ARCHIVE'],
            workflows: { EDITORIAL_WORKFLOW: { name: 'review-tests', className: 'EditorialWorkflow' } },
            assets: {
              directory: path.join(root, 'dist'),
              binding: 'ASSETS',
              run_worker_first: true,
              routerConfig: { has_user_worker: true },
              assetConfig: { html_handling: 'force-trailing-slash', not_found_handling: '404-page' },
            },
            bindings: {
              SITE_URL: 'https://wenbu.app',
              EDITORIAL_ENABLED: 'true',
              EDITORIAL_AUTOPUBLISH: 'true',
              DEEPSEEK_MODEL: 'deepseek-v4-flash',
              DEEPSEEK_API_KEY: 'synthetic-only',
              ANALYTICS_ADMIN_TOKEN: 'local-editorial-test',
            },
            outboundService: async (request) => {
              if (new URL(request.url).hostname === 'wenbu.app')
                return mf.dispatchFetch(request.url, { headers: request.headers });
              if (new URL(request.url).hostname !== 'api.deepseek.com')
                return new Response('', { status: 503 });
              const input = await request.json(),
                packet = JSON.parse(input.messages[1].content),
                isReview = input.messages[0].content.startsWith('You are a strict');
              let content;
              if (isReview) {
                inputs.push(packet);
                const invalid = scenario === 'exhausted' || inputs.length === 1,
                  reject = scenario === 'criticism' && draftInputs.length < 2;
                content = {
                  factual: !reject,
                  bilingual: true,
                  useful: true,
                  original: true,
                  natural: true,
                  issues: reject ? ['The example mixes two documented response channels.'] : [],
                  corrections: reject
                    ? [
                        {
                          component: invalid ? 'example.intro / '.repeat(10) : 'example.intro',
                          defect: 'The example mixes a tool response with a conversation stream.',
                          repair: 'Use one response channel and its documented terminal signal.',
                          sourceId: 'methods',
                        },
                      ]
                    : [],
                };
                if (invalid && !reject) content.invalidRepresentation = true;
              } else {
                draftInputs.push(packet);
                content = fixtureDraft();
                content.zh.sections[0].paragraphs[0] += ' 本地模拟写作轮次：' + draftInputs.length;
                content.en.sections[0].paragraphs[0] += ' Synthetic writing round: ' + draftInputs.length;
                const source = packet.sources[0];
                for (const e of [content.zh, content.en]) {
                  e.answerSourceIds = [source.id];
                  for (const s of [...e.sections, e.figure, e.table, e.example, ...e.faq, ...e.glossary])
                    s.sourceIds = [source.id];
                  for (const ev of e.evidence) {
                    ev.sourceId = source.id;
                    ev.quote = source.excerpt.slice(0, 30).trim();
                  }
                }
              }
              return Response.json({
                choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
              });
            },
          },
        ],
      }),
    });
    try {
      const db = await mf.getD1Database('ANALYTICS');
      for (const name of (await readdir(path.join(root, 'migrations')))
        .filter((n) => n.endsWith('.sql'))
        .sort())
        await db.exec(
          (await readFile(path.join(root, 'migrations', name), 'utf8'))
            .replace(/--[^\n]*/g, '')
            .replace(/\s+/g, ' '),
        );
      const dispatch = await mf
        .dispatchFetch('https://wenbu.app/__test/dispatch', {
          method: 'POST',
          body: JSON.stringify({ time: Date.parse('2026-10-15T01:00:00Z') }),
        })
        .then((r) => r.json());
      check(scenario + ': queues a native Workflow', dispatch.status === 'queued');
      let run;
      for (let i = 0; i < 200; i++) {
        run = await db.prepare('SELECT * FROM editorial_runs ORDER BY created_at DESC LIMIT 1').first();
        if (run && ['published', 'blocked'].includes(run.status)) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      check(
        scenario + ': all protocol retries see the exact same draft',
        inputs.length >= 2 && JSON.stringify(inputs[0].draft) === JSON.stringify(inputs[1].draft),
      );
      check(
        scenario + ': schema feedback goes to the reviewer only',
        inputs[1].reviewProtocolRepair?.schemaIssues.length > 0 &&
          inputs[1].reviewProtocolRepair.instruction.includes('SAME unchanged draft') &&
          draftInputs.every(
            (p) => !p.revisionInstructions?.review?.issues.some((s) => s.startsWith('Review schema:')),
          ),
      );
      const bucket = await mf.getR2Bucket('ANALYTICS_ARCHIVE'),
        validation = await (await bucket.get(`editorial/${run.id}/review-validation-1.json`)).json(),
        raw = await (await bucket.get(`editorial/${run.id}/model-review-1.json`)).json();
      check(
        scenario + ': invalid raw review and fail-closed validation are retained',
        !!raw.content &&
          validation.checked.factual === false &&
          validation.protocolRepair.schemaIssues.length > 0,
      );
      if (scenario === 'criticism') {
        check(
          'negative criticism survives protocol repair before a real article repair',
          inputs[1].reviewProtocolRepair.previousReview.factual === false &&
            inputs[1].reviewProtocolRepair.previousReview.corrections[0].repair.includes(
              'one response channel',
            ) &&
            inputs[2].reviewProtocolRepair === undefined &&
            JSON.stringify(inputs[2].draft) !== JSON.stringify(inputs[1].draft) &&
            draftInputs[1].revisionInstructions.review.factual === false,
        );
        check(
          'a corrected draft publishes only after a valid independent approval',
          run.status === 'published' &&
            run.model_calls === 5 &&
            draftInputs.length === 2 &&
            inputs.length === 3,
        );
      } else if (scenario === 'exhausted') {
        check(
          'repeated invalid reviews exhaust three rounds without rewriting or publishing',
          run.status === 'blocked' &&
            run.model_calls === 4 &&
            draftInputs.length === 1 &&
            inputs.length === 3 &&
            (await db.prepare('SELECT COUNT(*) AS n FROM editorial_publications').first()).n === 0 &&
            (await db.prepare('SELECT COUNT(*) AS n FROM search_console_queue').first()).n === 0,
        );
      } else {
        check(
          'an invalid all-true response cannot pass before a separate valid review',
          run.status === 'published' &&
            run.model_calls === 3 &&
            draftInputs.length === 1 &&
            inputs.length === 2,
        );
      }
      check(
        scenario + ': every physical request has a persisted reservation',
        (await db.prepare('SELECT SUM(model_calls) AS n FROM editorial_daily_budgets').first()).n ===
          draftInputs.length + inputs.length,
      );
    } finally {
      await mf.dispose();
    }
  }
  console.log(`PASS ${checks} native editorial review checks`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
