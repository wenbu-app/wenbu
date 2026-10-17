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
const planningCandidate = {
  id: 'synthetic-api-integrity',
  slug: 'synthetic-api-integrity',
  category: 'learn',
  mode: 'new',
  tool: 'agent',
  zh: '检查接口结果的结构版本与导出完整性',
  en: 'Check the structural version of an exported API record',
  task: 'Detect a mismatched serialization version in an exported structured API record.',
  unique:
    'A field-by-field API integrity audit with a deliberately mismatched version, rather than checking whether a prose citation supports its interpretation.',
  sources: ['agents', 'methods'],
  comparisonSourceId: null,
  priority: 40,
};
const planningCandidates = [
  planningCandidate,
  { ...planningCandidate, id: 'synthetic-coin-sheet', slug: 'synthetic-coin-sheet', tool: 'iching' },
  {
    ...planningCandidate,
    id: 'synthetic-library-app',
    slug: 'synthetic-library-app',
    category: 'compare',
    sources: ['wenbu', 'iztro'],
  },
];
let failReview = false,
  malformedNext = false,
  indexnowCalls = 0,
  diagnosticHeads = 0,
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
        workflows: {
          EDITORIAL_WORKFLOW: { name: 'editorial-tests', className: 'EditorialWorkflow' },
          INDEXNOW_WORKFLOW: { name: 'indexnow-tests', className: 'IndexNowWorkflow' },
        },
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
          if (new URL(request.url).hostname === 'api.indexnow.org') {
            if (request.method === 'HEAD') {
              diagnosticHeads++;
              assert.equal(new URL(request.url).search, '');
              assert.equal(request.headers.has('Authorization'), false);
              assert.equal(request.headers.has('Cookie'), false);
              return new Response(null, { status: 405 });
            }
            indexnowCalls++;
            return Response.json(
              { error: 'Synthetic provider rejection for native runtime verification.' },
              {
                status: 429,
                headers: { 'Retry-After': '172800', 'x-request-id': 'synthetic-native-receipt' },
              },
            );
          }
          if (request.url === 'https://www.cloudflare.com/cdn-cgi/trace')
            return new Response('ip=2001:db8::1\ncolo=NRT\n');
          if (request.url === 'https://checkip.amazonaws.com/') return new Response('192.0.2.100\n');
          if (new URL(request.url).hostname !== 'api.deepseek.com') return new Response('', { status: 503 });
          calls++;
          if (calls === 1) return new Response('Synthetic transient provider failure', { status: 503 });
          const input = await request.json(),
            review = input.messages[0].content.startsWith('You are a strict');
          if (input.messages[0].content.includes('Wenbu managing editor')) {
            const packet = JSON.parse(input.messages[1].content);
            assert.ok(
              packet.canonicalOwners.some((o) => o.path === 'learn/bazi-basics' && o.coverage.length > 100),
            );
            assert.ok(
              packet.canonicalOwners.some(
                (o) =>
                  o.path === 'learn/daily-card-reflection' &&
                  o.coverage.includes('This revision distinguishes random draws'),
              ),
            );
            return Response.json({
              choices: [
                {
                  finish_reason: 'stop',
                  message: { content: JSON.stringify({ topics: planningCandidates }) },
                },
              ],
            });
          }
          if (input.messages[0].content.includes('critical canonical-ownership editor')) {
            return Response.json({
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      reviews: planningCandidates.map((t) => ({
                        id: t.id,
                        decision: t.id === 'synthetic-coin-sheet' ? 'merge' : 'new',
                        closestOwner: 'learn/iching-three-coins',
                        sameReaderOutcome: t.id === 'synthetic-coin-sheet',
                        formatOnlyDifference: t.id === 'synthetic-coin-sheet',
                        requiresNewCanonical: t.id !== 'synthetic-coin-sheet',
                        existingOutcome: 'Check line order and moving lines against a six-row worksheet.',
                        newOutcome: 'Check the serialized version contract of an exported structured record.',
                        reason:
                          'A separate serialization audit has a different input and output contract; the coin worksheet remains on its original canonical owner.',
                      })),
                    }),
                  },
                },
              ],
            });
          }
          assert.equal(
            input.thinking.type,
            review ? 'enabled' : 'disabled',
            'draft and editorial review use explicit reasoning budgets',
          );
          if (!review && malformedNext) {
            const syntax = malformedNext === 'syntax';
            malformedNext = false;
            return Response.json({
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: syntax ? '{"zh":[' : JSON.stringify({ zh: { title: 'Malformed sample' } }),
                  },
                },
              ],
            });
          }
          const draft = fixtureDraft();
          if (review)
            assert.ok(
              JSON.parse(input.messages[1].content).canonicalOwners.some(
                (o) => o.path === 'compare/fatetell',
              ),
            );
          if (!review) {
            const packet = JSON.parse(input.messages[1].content),
              source = packet.sources[0];
            if (packet.operatorCorrections) {
              draft.zh.sections[0].paragraphs[0] +=
                ' 本次修订进一步区分随机抽取与可复算的命盘，保留原始记录供复盘。';
              draft.en.sections[0].paragraphs[0] +=
                ' This revision distinguishes random draws from recalculated charts while preserving the original record for review.';
            }
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
  const original = JSON.parse(
    (
      await db
        .prepare("SELECT document_json FROM editorial_publications WHERE path='learn/daily-card-reflection'")
        .first()
    ).document_json,
  );
  const revisionBody = {
    path: 'learn/daily-card-reflection',
    expectedRevision: original.revision,
    instructions:
      'Clarify random draws versus deterministic calculation, preserving the original publication date.',
  };
  const revise = () =>
    mf
      .dispatchFetch('https://wenbu.app/api/admin/editorial/revise', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer local-editorial-test',
          Origin: 'https://wenbu.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revisionBody),
      })
      .then((r) => r.json());
  malformedNext = 'syntax';
  const revisionRun = await revise();
  check('authenticated revision queues an expected published edition', revisionRun.status === 'queued');
  for (let i = 0; i < 100; i++) {
    state = await admin();
    if (state.runs.some((r) => r.id === revisionRun.id && ['published', 'blocked'].includes(r.status))) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const revised = JSON.parse(
    (
      await db
        .prepare("SELECT document_json FROM editorial_publications WHERE path='learn/daily-card-reflection'")
        .first()
    ).document_json,
  );
  check(
    'published correction changes the revision and retains the original publication date',
    revised.revision !== original.revision && revised.publishedAt === original.publishedAt,
  );
  check(
    'syntax-invalid completed JSON uses bounded repair rather than a blind transport replay',
    state.runs.find((r) => r.id === revisionRun.id)?.model_calls === 3,
  );
  check(
    'the old immutable revision remains available after correction',
    Boolean(
      await db
        .prepare('SELECT revision FROM editorial_revisions WHERE revision=?')
        .bind(original.revision)
        .first(),
    ),
  );
  check(
    'repeating a stale correction cannot overwrite the newer edition',
    (await revise()).status === 'stale_revision',
  );
  const searchJobs = await db
    .prepare('SELECT url,revision,status FROM search_console_queue ORDER BY url,created_at')
    .all();
  check(
    'native publication atomically queues both languages and supersedes the old pending revision',
    searchJobs.results.filter((j) => j.revision === revised.revision && j.status === 'pending').length ===
      2 &&
      searchJobs.results.filter((j) => j.revision === original.revision && j.status === 'superseded')
        .length === 2,
  );
  const planning = await mf.dispatchFetch('https://wenbu.app/__test/planning').then((r) => r.json());
  check(
    'native commissioning admits a new outcome and blocks an overlap and library-as-app comparison',
    planning.status === 'planned' && planning.accepted === 1,
  );
  const inserted = await db.prepare("SELECT id FROM editorial_topics WHERE id LIKE 'synthetic-%'").all();
  check(
    'rejected commissioning proposals do not enter the publishing queue',
    inserted.results.length === 1 && inserted.results[0].id === 'synthetic-api-integrity',
  );
  const archive = await mf.getR2Bucket('ANALYTICS_ARCHIVE');
  check(
    'native commissioning retains proposals and full ownership review in private R2',
    !!(await archive.get('editorial/synthetic-native-planning/commissioning-proposals.json')) &&
      !!(await archive.get('editorial/synthetic-native-planning/commissioning-review.json')),
  );
  const planningAudit = JSON.parse(
    (
      await db
        .prepare(
          "SELECT evidence_json FROM editorial_observations WHERE kind='topic_planning' ORDER BY checked_at DESC LIMIT 1",
        )
        .first()
    ).evidence_json,
  );
  check(
    'commissioning records its policy, per-candidate review and actual accepted reserve',
    planningAudit.policyVersion === 2 &&
      planningAudit.reviews.length === 3 &&
      planningAudit.rejections.length === 2,
  );
  const callsBeforeRepeat = calls;
  const repeatedPlanning = await mf.dispatchFetch('https://wenbu.app/__test/planning').then((r) => r.json());
  check(
    'a completed admission replay returns its original receipt without calling the model',
    repeatedPlanning.status === 'planned' && repeatedPlanning.accepted === 1 && calls === callsBeforeRepeat,
  );
  const cooldownPlanning = await mf
    .dispatchFetch('https://wenbu.app/__test/planning', {
      method: 'POST',
      body: JSON.stringify({ id: 'synthetic-planning-second' }),
    })
    .then((r) => r.json());
  check(
    'a completed policy cannot bypass its commissioning cooldown',
    cooldownPlanning.status === 'already_planned' && calls === callsBeforeRepeat,
  );
  await db
    .prepare('UPDATE editorial_commissioning_runs SET started_at=started_at-?')
    .bind(2 * 86400_000)
    .run();
  await db.exec(
    "CREATE TRIGGER fail_commissioning_commit BEFORE INSERT ON editorial_observations WHEN NEW.kind='topic_planning' AND json_type(NEW.evidence_json,'$.accepted')='array' BEGIN SELECT RAISE(ABORT,'synthetic commit failure'); END;",
  );
  planningCandidates[0] = {
    ...planningCandidate,
    id: 'synthetic-fault-topic',
    slug: 'synthetic-fault-topic',
  };
  const faultRequest = () =>
    mf
      .dispatchFetch('https://wenbu.app/__test/planning', {
        method: 'POST',
        body: JSON.stringify({ id: 'synthetic-planning-fault' }),
      })
      .then((r) => r.json());
  const fault = await faultRequest();
  check(
    'failed commissioning audit rolls back the topic admission and retains a blocked run',
    fault.status === 'blocked' &&
      !(await db.prepare("SELECT id FROM editorial_topics WHERE id='synthetic-fault-topic'").first()),
  );
  await db.exec('DROP TRIGGER fail_commissioning_commit;');
  const afterFaultCalls = calls;
  check(
    'replaying a failed commissioning run cannot regenerate or admit another batch',
    (await faultRequest()).status === 'blocked' && calls === afterFaultCalls,
  );
  check(
    'a failed pass also arms the new-run cooldown',
    (
      await mf
        .dispatchFetch('https://wenbu.app/__test/planning', {
          method: 'POST',
          body: JSON.stringify({ id: 'synthetic-after-fault' }),
        })
        .then((r) => r.json())
    ).status === 'already_planned' && calls === afterFaultCalls,
  );
  const health = await mf.dispatchFetch('https://wenbu.app/__test/health').then((r) => r.json());
  check(
    'native public delivery health verifies bilingual HTML, Markdown, JSON, sitemap, directory and CTA',
    health.issues.length === 0,
  );
  await db
    .prepare('UPDATE indexnow_state SET last_scanned=?,retry_at=0,failures=20,throttle_streak=20')
    .bind(Date.now() - 86400_000 + 1200)
    .run();
  let notification;
  for (let i = 0; i < 100; i++) {
    notification = await mf.dispatchFetch('https://wenbu.app/__test/indexnow').then((r) => r.json());
    if (['complete', 'errored'].includes(notification.status)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check(
    'native daily Workflow waits out clock drift and completes one bounded notification',
    notification.status === 'complete' && indexnowCalls === 1,
  );
  const remoteReceipt = await db
    .prepare(
      'SELECT http_status,diagnostics_json FROM indexnow_submissions ORDER BY submitted_at DESC LIMIT 1',
    )
    .first();
  check(
    'native provider rejection preserves HTTP status and bounded response diagnostics',
    remoteReceipt.http_status === 429 &&
      JSON.parse(remoteReceipt.diagnostics_json).excerpt.includes('Synthetic provider rejection'),
  );
  const pause = await db.prepare('SELECT retry_at,failures FROM indexnow_state WHERE id=1').first();
  check(
    'native repeated rejection arms an adaptive pause without erasing failure history',
    pause.failures === 21 && pause.retry_at > Date.now() + 2.9 * 86400_000,
  );
  await mf.dispatchFetch('https://wenbu.app/__test/indexnow');
  check('native completed daily instance cannot replay the outbound request', indexnowCalls === 1);
  const diagnosticHeaders = {
    Authorization: 'Bearer local-editorial-test',
    Origin: 'https://wenbu.app',
  };
  const diagnosticUrl = 'https://wenbu.app/api/admin/indexnow/diagnostics';
  const dispatch = await mf
    .dispatchFetch(diagnosticUrl, { method: 'POST', headers: diagnosticHeaders })
    .then((r) => r.json());
  let diagnosticResult;
  for (let i = 0; i < 100; i++) {
    diagnosticResult = await mf
      .dispatchFetch(diagnosticUrl, { headers: diagnosticHeaders })
      .then((r) => r.json());
    if (diagnosticResult.runs.length) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  check(
    'native Workflow transport diagnostic persists one HEAD and never adds a notification',
    dispatch.id.startsWith('indexnow-diagnostic-') &&
      diagnosticHeads === 1 &&
      indexnowCalls === 1 &&
      diagnosticResult.runs.length === 1,
  );
  const probes = JSON.parse(diagnosticResult.runs[0].result_json).probes;
  check(
    'native public key is read through HTTP and its Worker metadata is persisted',
    probes.find((p) => p.kind === 'public_key').exactKey === true &&
      diagnosticResult.verification[0].requests >= 1,
  );
  const afterDiagnosticPause = await db
    .prepare('SELECT retry_at,failures FROM indexnow_state WHERE id=1')
    .first();
  check(
    'native diagnostic cannot reset notification pause or failure history',
    JSON.stringify(afterDiagnosticPause) === JSON.stringify(pause),
  );
  await mf.dispatchFetch(diagnosticUrl, { method: 'POST', headers: diagnosticHeaders });
  check('native diagnostic has a deduplicated daily instance', diagnosticHeads === 1 && indexnowCalls === 1);
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
