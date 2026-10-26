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
const { fixtureDraft, fixtureFocusedDraft } = await import(pathToFileURL(path.join(temp, 'draft.mjs')).href);
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
let planningFeedbackSeen = false,
  focusedDraftSeen = false,
  focusedReviewSeen = false,
  repairPlanning = false,
  remainingReviewFailures = 0,
  draftMarker = '',
  failReview = false,
  malformedNext = false,
  syntaxRepairSeen = false,
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
            if (
              packet.observedSignals.some(
                (signal) =>
                  signal.kind === 'topic_planning' &&
                  signal.summary.includes('deterministic admission check') &&
                  signal.summary.includes('named_vendor_source_required'),
              )
            )
              planningFeedbackSeen = true;
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
                  message: {
                    content: JSON.stringify({
                      topics: planningCandidates.map((t) =>
                        repairPlanning && packet.previousFeedback
                          ? {
                              ...t,
                              task: 'A corrected serialization audit with a reproducible version mismatch and resolution.',
                            }
                          : t,
                      ),
                    }),
                  },
                },
              ],
            });
          }
          if (input.messages[0].content.includes('adversarial demand and canonical-ownership editor')) {
            assert.ok(JSON.parse(input.messages[1].content).candidates.length <= 24);
            return Response.json({
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      reviews: JSON.parse(input.messages[1].content).candidates.map((t) => ({
                        id: t.id,
                        decision:
                          repairPlanning && !t.task.startsWith('A corrected')
                            ? 'reject'
                            : t.id === 'synthetic-coin-sheet'
                              ? 'merge'
                              : 'new',
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
          if (!review) {
            const packet = JSON.parse(input.messages[1].content);
            if (packet.previousDraft?.parseError === 'invalid_json_syntax') {
              assert.ok(
                packet.revisionInstructions.deterministic.some(
                  (issue) =>
                    issue.includes('Invalid JSON syntax') &&
                    issue.includes('closing each sections array before figure'),
                ),
              );
              syntaxRepairSeen = true;
            }
          }
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
          const contentPacket = JSON.parse(input.messages[1].content);
          const focused = contentPacket.contentContract?.kind === 'focused_addition';
          if (focused && !review) {
            assert.ok(contentPacket.sources.some((s) => s.id === 'current-zh'));
            assert.ok(contentPacket.sources.some((s) => s.id === 'current-en'));
            assert.equal(contentPacket.shape.zh.sections.length, 2);
            focusedDraftSeen = true;
          }
          if (focused && review) focusedReviewSeen = true;
          const draft = focused ? fixtureFocusedDraft() : fixtureDraft();
          if (!review && draftMarker) {
            draft.zh.sections[0].paragraphs[0] += ' 测试标记：' + draftMarker;
            draft.en.sections[0].paragraphs[0] += ' Synthetic revision marker: ' + draftMarker;
          }
          const rejectThisReview = review && (failReview || remainingReviewFailures > 0);
          if (review && remainingReviewFailures > 0) remainingReviewFailures--;
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
                          factual: !rejectThisReview,
                          bilingual: true,
                          useful: true,
                          original: true,
                          natural: true,
                          issues: rejectThisReview
                            ? ['Unverified example; repair its scope using the cited source.']
                            : [],
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
  const libraryHtml = await response.text();
  check('library links to new article', libraryHtml.includes('href="/learn/daily-card-reflection/"'));
  check(
    'published guide participates in the same searchable topic grid',
    /data-topic-guides="reflect"[\s\S]*?data-guide-slug="daily-card-reflection"[^>]*data-search=/.test(
      libraryHtml,
    ),
  );
  check(
    'published guide has one catalogue card and a full catalogue count',
    (libraryHtml.match(/data-guide-slug="daily-card-reflection"/g) ?? []).length === 1 &&
      libraryHtml.includes('22 篇双语图解指南'),
  );

  const collection = [
    ...libraryHtml.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ]
    .flatMap((match) => {
      const schema = JSON.parse(match[1]);
      return schema['@graph'] ?? [schema];
    })
    .find((node) => node['@type'] === 'CollectionPage');
  check(
    'library structured data includes each visible canonical guide once',
    collection?.mainEntity?.numberOfItems === 22 &&
      collection.mainEntity.itemListElement.filter(
        (item) => item.url === 'https://wenbu.app/learn/daily-card-reflection/',
      ).length === 1,
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
    'failed editorial review blocks publication after all bounded repairs',
    state.runs.some((r) => r.slot === '2026-10-15-15' && r.status === 'blocked'),
  );
  check(
    'failed edition never replaces the existing guide',
    (await db.prepare('SELECT COUNT(*) AS n FROM editorial_publications').first()).n === 1,
  );
  check(
    'quality failure uses all three writing and review rounds',
    state.runs.find((r) => r.slot === '2026-10-15-15').model_calls === 6,
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
    state.runs.find((r) => r.id === revisionRun.id)?.model_calls === 3 && syntaxRepairSeen,
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
  const beforePlanningRace = calls;
  await db
    .prepare("UPDATE editorial_state SET lease_owner='other-native-content',lease_until=? WHERE id=1")
    .bind(Date.now() + 60000)
    .run();
  const busyPlanning = await mf
    .dispatchFetch('https://wenbu.app/__test/planning', {
      method: 'POST',
      body: JSON.stringify({ id: 'synthetic-busy-planning' }),
    })
    .then((r) => r.json());
  check(
    'planning lease races retain a blocked receipt without spending model calls or stealing the lease',
    busyPlanning.status === 'blocked' &&
      busyPlanning.error === 'editorial_busy' &&
      calls === beforePlanningRace &&
      (await db.prepare('SELECT lease_owner FROM editorial_state').first()).lease_owner ===
        'other-native-content',
  );
  await db.prepare("UPDATE editorial_state SET lease_owner='',lease_until=0 WHERE id=1").run();
  await db
    .prepare(
      "UPDATE editorial_commissioning_runs SET started_at=started_at-? WHERE id='synthetic-busy-planning'",
    )
    .bind(16 * 60000)
    .run();
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
    planningAudit.policyVersion === 4 &&
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
  check(
    'a subsequent native planning pass receives prior adversarial rejection feedback',
    planningFeedbackSeen,
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
  const failedPool = await archive.get('editorial/commissioning-pending.json').then((r) => r.json());
  check(
    'a failed admission transaction preserves its candidates in the private checkpoint',
    failedPool.topics.some((t) => t.id === 'synthetic-fault-topic'),
  );
  await db
    .prepare('UPDATE editorial_commissioning_runs SET started_at=started_at-?')
    .bind(2 * 86400_000)
    .run();
  // Test-only fresh-day budget for the next two persisted-pool scenarios.
  await db.prepare('UPDATE editorial_daily_budgets SET planning_calls=0').run();
  // Simulate the two real over-limit responses with 54 valid, independent tasks.
  const largePool = Array.from({ length: 54 }, (_, i) => ({
    ...planningCandidate,
    id: `synthetic-batch-${i}`,
    slug: `synthetic-batch-${i}`,
  }));
  await archive.delete('editorial/commissioning-pending.json');
  await db
    .prepare(
      "INSERT INTO editorial_commissioning_runs(id,policy_version,status,started_at,finished_at,receipt_json) VALUES('synthetic-legacy-oversize',3,'completed',?,?,?)",
    )
    .bind(Date.now(), Date.now(), JSON.stringify({ status: 'planned', accepted: 0 }))
    .run();
  await archive.put(
    'editorial/synthetic-legacy-oversize/commissioning-proposals-1.json',
    JSON.stringify({ topics: largePool.slice(0, 28) }),
  );
  await archive.put(
    'editorial/synthetic-legacy-oversize/commissioning-proposals-2.json',
    JSON.stringify({ topics: largePool.slice(28) }),
  );
  const large = await mf
    .dispatchFetch('https://wenbu.app/__test/planning', {
      method: 'POST',
      body: JSON.stringify({ id: 'synthetic-large-batch' }),
    })
    .then((r) => r.json());
  const remainingPool = await archive.get('editorial/commissioning-pending.json').then((r) => r.json());
  check(
    'overflow candidates are reviewed in batches of 24 and reserve overflow remains durable',
    large.status === 'planned' &&
      large.recovered === 54 &&
      large.reviewed <= 48 &&
      large.deferred > 0 &&
      remainingPool.topics.length === large.deferred &&
      large.readyAfter === 42,
  );
  await db
    .prepare('UPDATE editorial_commissioning_runs SET started_at=started_at-?')
    .bind(7 * 86400_000)
    .run();
  await db.prepare("UPDATE editorial_topics SET status='published' WHERE id LIKE 'synthetic-batch-%'").run();
  const resumed = await mf
    .dispatchFetch('https://wenbu.app/__test/planning', {
      method: 'POST',
      body: JSON.stringify({ id: 'synthetic-resume-batch' }),
    })
    .then((r) => r.json());
  check(
    'a later pass re-reads the retained pool and admits candidates without another proposal call',
    resumed.status === 'planned' && resumed.recovered === large.deferred && resumed.accepted > 0,
  );
  await db
    .prepare('UPDATE editorial_commissioning_runs SET started_at=started_at-?')
    .bind(7 * 86400_000)
    .run();
  await db.prepare("UPDATE editorial_topics SET status='published' WHERE id LIKE 'synthetic-batch-%'").run();
  await db.prepare('UPDATE editorial_daily_budgets SET planning_calls=0').run();
  await archive.delete('editorial/commissioning-pending.json');
  planningCandidates.splice(0, planningCandidates.length, {
    ...planningCandidate,
    id: 'synthetic-repair-topic',
    slug: 'synthetic-repair-topic',
  });
  repairPlanning = true;
  const repairedPlan = await mf
    .dispatchFetch('https://wenbu.app/__test/planning', {
      method: 'POST',
      body: JSON.stringify({ id: 'synthetic-repaired-planning' }),
    })
    .then((r) => r.json());
  repairPlanning = false;
  check(
    'adversarial feedback can repair a rejected proposal under its same stable ID',
    repairedPlan.accepted === 1 &&
      repairedPlan.reviewed === 2 &&
      (
        await db
          .prepare("SELECT definition_json FROM editorial_topics WHERE id='synthetic-repair-topic'")
          .first()
      ).definition_json.includes('A corrected serialization audit'),
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
  // A second independently reviewed addition must preserve the first public
  // edition, stable citation identity, and exact old/new section anchors.
  const originalDoc = JSON.parse(
    (
      await db
        .prepare("SELECT document_json FROM editorial_publications WHERE path='learn/daily-card-reflection'")
        .first()
    ).document_json,
  );
  const followupTopic = {
    ...originalDoc.topic,
    id: 'synthetic-daily-followup',
    mode: 'extend',
    task: 'Add a distinct synthetic fixture example for cumulative publication verification.',
    unique:
      'A separate retained example used only in this native test; it must not replace any existing edition.',
  };
  await db
    .prepare(
      'INSERT INTO editorial_topics(id,slug,category,definition_json,priority,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(
      followupTopic.id,
      followupTopic.slug,
      followupTopic.category,
      JSON.stringify(followupTopic),
      85,
      Date.now(),
    )
    .run();
  const followupId = 'synthetic-native-followup';
  await db
    .prepare(
      "INSERT INTO editorial_runs(id,slot,topic_id,status,created_at,updated_at) VALUES(?,?,?,'queued',?,?)",
    )
    .bind(followupId, '2026-10-16-09', followupTopic.id, Date.now(), Date.now())
    .run();
  remainingReviewFailures = 2;
  draftMarker = 'CUMULATIVE-THIRD-ROUND';
  await mf.dispatchFetch('https://wenbu.app/__test/dispatch', {
    method: 'POST',
    body: JSON.stringify({ time: Date.parse('2026-10-16T01:00:00Z') }),
  });
  let followup;
  for (let n = 0; n < 160; n++) {
    followup = await db
      .prepare('SELECT status,model_calls FROM editorial_runs WHERE id=?')
      .bind(followupId)
      .first();
    if (['published', 'blocked'].includes(followup.status)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check(
    'third writing/review round can repair and publish instead of abandoning a valid task',
    followup.status === 'published' && followup.model_calls === 6,
  );
  const cumulative = await mf
    .dispatchFetch('https://wenbu.app/knowledge/en/daily-card-reflection.json')
    .then((r) => r.json());
  check(
    'cumulative update preserves the complete original edition and stable public identity',
    cumulative.id === 'editorial-' + originalDoc.topic.id &&
      cumulative.previousAdditions.length === 1 &&
      cumulative.content.includes('CUMULATIVE-THIRD-ROUND') &&
      cumulative.content.includes(originalDoc.en.answer),
  );
  check(
    'a focused addition has its own server-selected writer and independent reviewer contract',
    focusedDraftSeen && focusedReviewSeen && cumulative.edition.sections.length === 2,
  );
  check(
    'the complete original guide is retained beside the shorter addition',
    cumulative.previousAdditions[0].en.sections.length === 4 &&
      cumulative.content.includes(originalDoc.en.sections[3].paragraphs[1]),
  );
  const fullHtml = await mf
    .dispatchFetch('https://wenbu.app/learn/daily-card-reflection/')
    .then((r) => r.text());
  check(
    'retained and latest sections have separate exact anchors',
    fullHtml.includes('id="editorial-history-0-section-0"') && fullHtml.includes('id="editorial-section-0"'),
  );
  check(
    'the attempted update is consumed without rewriting the original task identity',
    (await db.prepare('SELECT status FROM editorial_topics WHERE id=?').bind(followupTopic.id).first())
      .status === 'published',
  );
  const retainedAnchor = `editorial-${originalDoc.revision.slice(0, 24)}-section-0`;
  const retainedSection = await mf
    .dispatchFetch('https://wenbu.app/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-Wenbu-Test': 'true',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 91,
        method: 'tools/call',
        params: {
          name: 'read_library',
          arguments: { id: cumulative.id, locale: 'en', section: retainedAnchor },
        },
      }),
    })
    .then((r) => r.json());
  assert.ok(retainedSection.result?.structuredContent, JSON.stringify(retainedSection));
  check(
    'an earlier revision section remains readable by its pinned MCP citation after an update',
    fullHtml.includes(`id="${retainedAnchor}"`) &&
      retainedSection.result.structuredContent.content.includes(originalDoc.en.sections[0].paragraphs[0]) &&
      !retainedSection.result.structuredContent.content.includes('CUMULATIVE-THIRD-ROUND'),
  );
  const currentPublications = (await db.prepare('SELECT COUNT(*) AS n FROM editorial_publications').first())
    .n;
  const replayDispatch = await mf
    .dispatchFetch('https://wenbu.app/__test/dispatch', {
      method: 'POST',
      body: JSON.stringify({ time: Date.parse('2026-10-16T01:00:00Z') }),
    })
    .then((r) => r.json());
  check(
    'completed slot is not republished by a subsequent reconciliation',
    replayDispatch.status === 'no_due_slot' &&
      (await db.prepare('SELECT COUNT(*) AS n FROM editorial_publications').first()).n ===
        currentPublications,
  );
  await db.prepare('UPDATE editorial_daily_budgets SET model_calls=119,planning_calls=0').run();
  const reservations = await Promise.all(
    [1, 2].map(() => mf.dispatchFetch('https://wenbu.app/__test/budget', { method: 'POST' })),
  );
  check(
    'native concurrent model reservations cannot exceed the daily cap',
    reservations
      .map((r) => r.status)
      .sort()
      .join(',') === '200,409' &&
      (await db.prepare('SELECT model_calls FROM editorial_daily_budgets ORDER BY day DESC LIMIT 1').first())
        .model_calls === 120,
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
