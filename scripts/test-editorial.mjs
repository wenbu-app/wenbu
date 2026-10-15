import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url),
  { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require('miniflare'),
  { build } = require('esbuild');
const root = new URL('../', import.meta.url).pathname,
  temp = await mkdtemp(path.join(tmpdir(), 'wenbu-editorial-test-'));
await build({
  entryPoints: [path.join(root, 'tests/editorial-worker.fixture.ts')],
  outfile: path.join(temp, 'worker.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  external: ['node:*', 'cloudflare:*'],
  logLevel: 'warning',
});
await build({
  entryPoints: [path.join(root, 'tests/helpers/editorial-fixture.ts')],
  outfile: path.join(temp, 'draft.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  logLevel: 'warning',
});
const { fixtureDraft } = await import(pathToFileURL(path.join(temp, 'draft.mjs')).href);
let failReview = false,
  malformedNext = false,
  calls = 0,
  checks = 0;
const mf = new Miniflare({
  ...convertV4MiniflareOptions({
    host: '127.0.0.1',
    log: new Log(LogLevel.ERROR),
    workers: [
      {
        name: 'editorial-tests',
        script: await readFile(path.join(temp, 'worker.mjs'), 'utf8'),
        modules: true,
        compatibilityDate: '2026-09-28',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['ANALYTICS'],
        r2Buckets: ['ANALYTICS_ARCHIVE'],
        workflows: { EDITORIAL_WORKFLOW: { name: 'editorial-tests', className: 'EditorialWorkflow' } },
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
          if (new URL(request.url).hostname !== 'api.deepseek.com') return new Response('', { status: 503 });
          calls++;
          if (calls === 1) return new Response('Synthetic transient provider failure', { status: 503 });
          const input = await request.json(),
            review = input.messages[0].content.startsWith('You are a strict');
          assert.equal(
            input.thinking.type,
            review ? 'enabled' : 'disabled',
            'draft and editorial review use explicit reasoning budgets',
          );
          if (!review && malformedNext) {
            malformedNext = false;
            return Response.json({
              choices: [
                {
                  finish_reason: 'stop',
                  message: { content: JSON.stringify({ zh: { title: 'Malformed sample' } }) },
                },
              ],
            });
          }
          const draft = fixtureDraft();
          if (!review) {
            const packet = JSON.parse(input.messages[1].content),
              source = packet.sources[0];
            for (const e of [draft.zh, draft.en]) {
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
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify(
                    review
                      ? {
                          factual: !failReview,
                          bilingual: true,
                          useful: true,
                          original: true,
                          natural: true,
                          issues: failReview ? ['Unverified example'] : [],
                        }
                      : draft,
                  ),
                },
              },
            ],
          });
        },
      },
    ],
  }),
});
const check = (name, value) => {
  assert.ok(value, name);
  checks++;
  console.log('PASS ' + name);
};
const admin = () =>
  mf
    .dispatchFetch('https://wenbu.app/api/admin/editorial', {
      headers: { Authorization: 'Bearer local-editorial-test' },
    })
    .then((r) => r.json());
try {
  const db = await mf.getD1Database('ANALYTICS');
  for (const name of (await readdir(path.join(root, 'migrations'))).filter((n) => n.endsWith('.sql')).sort())
    await db.exec(
      (await readFile(path.join(root, 'migrations', name), 'utf8'))
        .replace(/--[^\n]*/g, '')
        .replace(/\s+/g, ' '),
    );
  let response = await mf.dispatchFetch('https://wenbu.app/__test/dispatch', {
    method: 'POST',
    body: JSON.stringify({ time: Date.parse('2026-10-15T01:00:00Z') }),
  });
  check('native Workflow dispatch accepts a stable slot', (await response.json()).status === 'queued');
  let state;
  for (let i = 0; i < 250; i++) {
    state = await admin();
    if (state.runs[0]?.status === 'published' || state.runs[0]?.status === 'blocked') break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check(
    'native Workflow completes source reading, draft, review and publication',
    state.runs[0]?.status === 'published',
  );
  check(
    'native model budget allows one transport retry before writing and review',
    state.runs[0].model_calls === 3 && calls === 3,
  );
  for (const prefix of ['', 'en/']) {
    response = await mf.dispatchFetch(`https://wenbu.app/${prefix}learn/daily-card-reflection/`);
    const html = await response.text();
    check(
      'native HTML serves complete ' + (prefix || 'zh'),
      response.status === 200 &&
        html.includes('editorial-figure') &&
        html.includes('editorial-table') &&
        !html.includes('id="editorial-document"></div>'),
    );
    check(
      'canonical points to the actual article ' + (prefix || 'zh'),
      html.includes(`rel="canonical" href="https://wenbu.app/${prefix}learn/daily-card-reflection/"`),
    );
    check(
      'public article removes template noindex ' + (prefix || 'zh'),
      !/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html),
    );
    check(
      'language switch leads to the other complete edition ' + (prefix || 'zh'),
      html.includes(`class="language-switch" href="/${prefix ? '' : 'en/'}learn/daily-card-reflection/"`),
    );
  }
  for (const locale of ['zh', 'en'])
    for (const ext of ['md', 'json']) {
      response = await mf.dispatchFetch(`https://wenbu.app/knowledge/${locale}/daily-card-reflection.${ext}`);
      check(
        'complete public ' + locale + ' ' + ext,
        response.status === 200 && (await response.text()).includes('Sources'),
      );
    }
  response = await mf.dispatchFetch('https://wenbu.app/sitemap.xml');
  check(
    'both article editions enter sitemap',
    (await response.text()).includes('/en/learn/daily-card-reflection/'),
  );
  response = await mf.dispatchFetch('https://wenbu.app/learn/');
  check(
    'library links to new article',
    (await response.text()).includes('href="/learn/daily-card-reflection/"'),
  );
  response = await mf.dispatchFetch('https://wenbu.app/indexnow-manifest.json');
  const manifest = await response.json();
  check(
    'live manifest keeps build identity and adds both language URLs',
    manifest.staticRevision && manifest.pages.some((p) => p.url.endsWith('/en/learn/daily-card-reflection/')),
  );
  response = await mf.dispatchFetch('https://wenbu.app/api/admin/editorial');
  check('operational data stays authenticated', response.status === 401);
  response = await mf.dispatchFetch('https://wenbu.app/api/admin/editorial/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer local-editorial-test', Origin: 'https://evil.example' },
  });
  check('foreign browser origin cannot start publication', response.status === 403);
  failReview = true;
  await mf.dispatchFetch('https://wenbu.app/__test/dispatch', {
    method: 'POST',
    body: JSON.stringify({ time: Date.parse('2026-10-15T07:00:00Z') }),
  });
  for (let i = 0; i < 100; i++) {
    state = await admin();
    if (state.runs.some((r) => r.slot === '2026-10-15-15' && r.status === 'blocked')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check(
    'failed editorial review blocks publication after one repair',
    state.runs.some((r) => r.slot === '2026-10-15-15' && r.status === 'blocked'),
  );
  check(
    'failed edition never replaces the existing guide',
    (await db.prepare('SELECT COUNT(*) AS n FROM editorial_publications').first()).n === 1,
  );
  check(
    'quality failure uses four logical model stages',
    state.runs.find((r) => r.slot === '2026-10-15-15').model_calls === 4,
  );
  failReview = false;
  malformedNext = true;
  // Keep this fixture on a first-party learning task; real vendor HTTP is not mocked here.
  await db.prepare("UPDATE editorial_topics SET status='blocked' WHERE category='compare'").run();
  await mf.dispatchFetch('https://wenbu.app/__test/dispatch', {
    method: 'POST',
    body: JSON.stringify({ time: Date.parse('2026-10-15T13:00:00Z') }),
  });
  for (let i = 0; i < 100; i++) {
    state = await admin();
    if (state.runs.some((r) => r.slot === '2026-10-15-21' && ['published', 'blocked'].includes(r.status)))
      break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const repaired = state.runs.find((r) => r.slot === '2026-10-15-21');
  check(
    'schema-invalid model output enters bounded repair and then passes editorial review',
    repaired.status === 'published' && repaired.model_calls === 3,
  );
  check(
    'schema repair preserves the earlier failed run',
    state.runs.some((r) => r.slot === '2026-10-15-15' && r.status === 'blocked'),
  );
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      scope:
        'native workerd + Workflows + D1 + R2 + HTMLRewriter; synthetic provider responses, no live model or mail calls',
    }),
  );
} finally {
  await mf.dispose();
  await rm(temp, { recursive: true, force: true });
}
