import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
const root = new URL('../', import.meta.url).pathname,
  temp = await mkdtemp(path.join(tmpdir(), 'wenbu-account-test-'));
const messages = new Map(),
  owners = new Map();
const instanceA = randomUUID();
let mailFailure = false,
  checks = 0;
function check(name, value) {
  assert.ok(value, name);
  checks++;
  console.log('PASS ' + name);
}
await build({
  entryPoints: [path.join(root, 'tests/account-worker.fixture.ts')],
  outfile: path.join(temp, 'worker.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  external: ['node:*', 'cloudflare:*'],
  logLevel: 'warning',
});
const mf = new Miniflare({
  ...convertV4MiniflareOptions({
    host: '127.0.0.1',
    log: new Log(LogLevel.ERROR),
    workers: [
      {
        name: 'account-tests',
        script: await readFile(path.join(temp, 'worker.mjs'), 'utf8'),
        modules: true,
        compatibilityDate: '2026-09-28',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['USERDATA'],
        durableObjects: {
          QUOTA: { className: 'UsageGate', useSQLite: true },
          PRIVACY_LEDGER: { className: 'DeletionLedger', useSQLite: true },
        },
        bindings: {
          SITE_URL: 'https://wenbu.test',
          ACCOUNTS_ENABLED: 'true',
          AUTH_SECRET: randomBytes(48).toString('hex'),
          ACCOUNT_DATA_KEY: randomBytes(48).toString('hex'),
          QUOTA_SALT: randomBytes(48).toString('hex'),
          AI_DAILY_LIMIT: '1000',
          AI_PER_USER_DAILY_LIMIT: '5',
          DEEPSEEK_MODEL: 'deepseek-v4-flash',
          DEEPSEEK_API_KEY: 'synthetic',
          ANALYTICS_ADMIN_TOKEN: 'local-test-only',
        },
        outboundService: async (request) => {
          if (new URL(request.url).hostname !== 'api.deepseek.com') return new Response('', { status: 503 });
          const input = await request.json();
          if (!input.stream)
            return Response.json({
              model: 'deepseek-v4-flash',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      title: 'Synthetic interpretation',
                      summary: 'Consider your next step with care.',
                      observations: [{ basis: 'Synthetic card', reflection: 'A local test only.' }],
                      nextSteps: ['Write one next step.'],
                      question: 'What can you influence?',
                    }),
                  },
                },
              ],
            });
          if (input.messages.some((m) => m.role === 'user' && m.content === 'fixture:clarification')) {
            const delta = {
              tool_calls: [
                {
                  index: 0,
                  id: 'clarify',
                  type: 'function',
                  function: {
                    name: 'ask_user',
                    arguments: JSON.stringify({
                      question:
                        'To make this useful, could you clarify which part of the situation you would most like to explore first?',
                      options: ['Context', 'Next step'],
                    }),
                  },
                },
              ],
            };
            return new Response(
              `data: ${JSON.stringify({ choices: [{ delta, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
              { headers: { 'Content-Type': 'text/event-stream' } },
            );
          }
          const content =
            'A synthetic result for account persistence testing. Take a moment to name the decision, identify what you can influence, and write down the next small step you can take.';
          return new Response(
            `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
            { headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
        serviceBindings: {
          MAILBOX: async (request) => {
            const message = await request.json();
            if (mailFailure) return new Response('', { status: 503 });
            messages.set(message.to, message.text.match(/\b\d{6}\b/)?.[0]);
            return Response.json({ accepted: true });
          },
          ASSETS: async () => new Response('fixture'),
        },
      },
    ],
  }),
  telemetry: { enabled: false },
  logRequests: false,
});
try {
  const db = await mf.getD1Database('USERDATA');
  for (const file of (await readdir(path.join(root, 'migrations-userdata')))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(path.join(root, 'migrations-userdata', file), 'utf8');
    for (const statement of sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  async function call(route, method = 'GET', body, cookie = '', options = {}) {
    const response = await mf.dispatchFetch('https://wenbu.test' + route, {
      method,
      headers: {
        Origin: options.origin ?? 'https://wenbu.test',
        'CF-Connecting-IP': options.ip ?? '192.0.2.1',
        'Content-Type': 'application/json',
        'X-Wenbu-Locale': 'en',
        'X-Wenbu-Instance': instanceA,
        'X-Wenbu-Analytics': JSON.stringify({
          session: randomUUID(),
          visitor: randomUUID(),
          page: '/en/agent/',
          entry: '/en/',
          locale: 'en',
          source: 'direct',
          medium: 'none',
          campaign: 'none',
          test: true,
        }),
        ...(cookie ? { 'X-Wenbu-Owner': [...owners].find(([key]) => cookie.includes(key))?.[1] || '' } : {}),
        ...options.headers,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.headers.get('content-type')?.includes('text/event-stream')
      ? await response.text()
      : await response.json().catch(() => null);
    return {
      status: response.status,
      data,
      headers: response.headers,
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .filter((c) => !c.endsWith('='))
        .join('; '),
    };
  }
  async function login(email, ip = '192.0.2.1') {
    const send = await call(
      '/api/auth/email-otp/send-verification-otp',
      'POST',
      { email, type: 'sign-in' },
      '',
      { ip },
    );
    check('send code ' + email, send.status === 200 && messages.has(email));
    const result = await call(
      '/api/auth/sign-in/email-otp',
      'POST',
      { email, otp: messages.get(email) },
      '',
      { ip },
    );
    if (result.status !== 200) console.log(result.data);
    check('verify ' + email, result.status === 200 && result.data.user.emailVerified);
    owners.set(result.cookie, result.data.user.id);
    return result;
  }
  check('private route rejects anonymous', (await call('/api/account/records')).status === 401);
  check(
    'cross-site code send denied',
    (
      await call(
        '/api/auth/email-otp/send-verification-otp',
        'POST',
        { email: 'no@wenbu.test', type: 'sign-in' },
        '',
        { origin: 'https://evil.test' },
      )
    ).status === 403,
  );
  const draw = await call('/api/v1/tarot', 'POST', { count: 1, reversals: false, locale: 'en' }, '', {
    headers: { 'X-Wenbu-Request-Id': randomUUID() },
  });
  check(
    'guest gets full result and signed receipt',
    draw.status === 200 &&
      draw.data.cards.length === 1 &&
      !!draw.headers.get('x-wenbu-receipt') &&
      !!draw.cookie,
  );
  const a = await login('alpha@wenbu.test'),
    b = await login('beta@wenbu.test');
  check(
    'session cookies private and secure',
    /HttpOnly/i.test(a.headers.get('set-cookie')) &&
      /Secure/i.test(a.headers.get('set-cookie')) &&
      /SameSite=Lax/i.test(a.headers.get('set-cookie')),
  );
  check(
    'no plaintext session IP/UA',
    (await db.prepare("SELECT COUNT(*) AS n FROM session WHERE ipAddress<>'' OR userAgent<>''").first()).n ===
      0,
  );
  check(
    'no email in business identity table',
    !(await db.prepare('SELECT * FROM wb_accounts LIMIT 1').first()).email,
  );
  check(
    'code replay rejected',
    (
      await call('/api/auth/sign-in/email-otp', 'POST', {
        email: 'alpha@wenbu.test',
        otp: messages.get('alpha@wenbu.test'),
      })
    ).status >= 400,
  );
  check(
    'send cooldown enforced',
    (
      await call('/api/auth/email-otp/send-verification-otp', 'POST', {
        email: 'alpha@wenbu.test',
        type: 'sign-in',
      })
    ).status === 429,
  );
  check(
    'private route cache disabled',
    /no-store/.test((await call('/api/account', 'GET', undefined, a.cookie)).headers.get('cache-control')),
  );
  const cookie = a.cookie + '; ' + draw.cookie;
  check('guest quota claim', (await call('/api/account/claim', 'POST', {}, cookie)).status === 200);
  const id = randomUUID(),
    record = {
      id,
      createdAt: new Date().toISOString(),
      kind: 'tarot',
      result: draw.data,
      question: 'A useful question',
      note: '',
      receipt: draw.headers.get('x-wenbu-receipt'),
    };
  const input = { requestId: randomUUID(), revision: 0, content: record, source: 'current' };
  const saved = await call('/api/account/records/journal/' + id, 'PUT', input, cookie);
  if (saved.status !== 200) console.log(saved.data);
  check('save current guest result', saved.status === 200 && saved.data.revision === 1);
  check(
    'activation from verified guest result',
    (await db.prepare('SELECT activated_at FROM wb_accounts WHERE user_id=?').bind(a.data.user.id).first())
      .activated_at > 0,
  );
  check(
    'stale outbox cannot cross accounts',
    (
      await call('/api/account/records/journal/' + id, 'PUT', input, b.cookie, {
        headers: { 'X-Wenbu-Owner': a.data.user.id },
      })
    ).data.error.code === 'account_changed',
  );
  check(
    'owner isolation reads',
    (await call('/api/account/records/journal/' + id, 'GET', undefined, b.cookie)).status === 404,
  );
  check(
    'repeat same mutation idempotent',
    (await call('/api/account/records/journal/' + id, 'PUT', input, cookie)).data.revision === 1,
  );
  check(
    'mutation ID payload mismatch rejected',
    (
      await call(
        '/api/account/records/journal/' + id,
        'PUT',
        { ...input, content: { ...record, note: 'tamper' } },
        cookie,
      )
    ).status === 409,
  );
  const simultaneous = await Promise.all(
    ['first', 'second'].map((note) =>
      call(
        '/api/account/records/journal/' + id,
        'PUT',
        { requestId: randomUUID(), revision: 1, content: { ...record, note }, source: 'current' },
        cookie,
      ),
    ),
  );
  check(
    'optimistic concurrency exactly one winner',
    simultaneous.filter((x) => x.status === 200).length === 1 &&
      simultaneous.filter((x) => x.status === 409).length === 1,
  );
  check(
    'cross-site record write rejected',
    (await call('/api/account/records/journal/' + id, 'PUT', input, cookie, { origin: 'https://evil.test' }))
      .status === 403,
  );
  check(
    'forged activation receipt rejected',
    (
      await call(
        '/api/account/records/journal/' + id,
        'PUT',
        { requestId: randomUUID(), revision: 0, content: { ...record, receipt: 'fake' }, source: 'current' },
        b.cookie,
      )
    ).status === 200 &&
      (await db.prepare('SELECT activated_at FROM wb_accounts WHERE user_id=?').bind(b.data.user.id).first())
        .activated_at === null,
  );
  const legacyId = randomUUID(),
    legacy = { ...record, id: legacyId, receipt: undefined },
    legacyInput = { requestId: randomUUID(), revision: 0, content: legacy, source: 'legacy' };
  check(
    'legacy import saves without activation',
    (await call('/api/account/records/journal/' + legacyId, 'PUT', legacyInput, b.cookie)).status === 200 &&
      (await db.prepare('SELECT activated_at FROM wb_accounts WHERE user_id=?').bind(b.data.user.id).first())
        .activated_at === null,
  );
  check(
    'legacy retry deduplicated',
    (
      await call(
        '/api/account/records/journal/' + legacyId,
        'PUT',
        { ...legacyInput, requestId: randomUUID() },
        b.cookie,
      )
    ).data.replayed === true,
  );
  check(
    'legacy mismatch does not overwrite',
    (
      await call(
        '/api/account/records/journal/' + legacyId,
        'PUT',
        { ...legacyInput, requestId: randomUUID(), content: { ...legacy, note: 'different' } },
        b.cookie,
      )
    ).status === 409,
  );
  const sid = randomUUID(),
    chat = {
      id: sid,
      title: 'A private chat',
      locale: 'en',
      updatedAt: new Date().toISOString(),
      mode: 'explore',
      context: { note: 'private context', useBirth: false, journalIds: [] },
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          text: 'hello',
          status: 'complete',
          tools: [],
          artifacts: [],
          sources: [],
        },
      ],
    };
  check(
    'chat stores with bounded message parts',
    (
      await call(
        '/api/account/records/session/' + sid,
        'PUT',
        { requestId: randomUUID(), revision: 0, content: chat, source: 'current' },
        a.cookie,
      )
    ).status === 200 &&
      (await db.prepare('SELECT COUNT(*) AS n FROM wb_record_parts WHERE id=?').bind(sid).first()).n === 1,
  );
  check(
    'chat round trip',
    (await call('/api/account/records/session/' + sid, 'GET', undefined, a.cookie)).data.content.messages[0]
      .text === 'hello',
  );
  const operation = randomUUID();
  const running = {
    ...chat,
    messages: [
      ...chat.messages,
      {
        id: operation,
        role: 'assistant',
        text: '',
        status: 'running',
        tools: [],
        artifacts: [],
        sources: [],
      },
    ],
  };
  const prepared = await call(
    '/api/account/records/session/' + sid,
    'PUT',
    { requestId: randomUUID(), revision: 1, content: running, source: 'current' },
    a.cookie,
  );
  const generated = await call(
    '/api/v1/agent',
    'POST',
    {
      message: 'hello',
      history: [],
      consent: true,
      locale: 'en',
      mode: 'explore',
      context: {
        note: '',
        readings: [
          { kind: 'tarot', input: { cards: draw.data.cards.map(({ id, reversed }) => ({ id, reversed })) } },
        ],
        sourceIds: [],
      },
    },
    a.cookie,
    {
      headers: {
        'X-Wenbu-Request-Id': operation,
        'X-Wenbu-Conversation': sid,
        'X-Wenbu-Revision': String(prepared.data.revision),
      },
    },
  );
  if (generated.status !== 200) console.log(generated.data);
  check(
    'cloud Agent completes with acknowledged final checkpoint',
    generated.status === 200 &&
      generated.data.includes('"type":"cloud"') &&
      generated.data.includes('"type":"done"'),
  );
  const serverChat = (await call('/api/account/records/session/' + sid, 'GET', undefined, a.cookie)).data;
  check(
    'server persists generated text and receipt before browser reload',
    serverChat.content.messages.at(-1).status === 'complete' &&
      serverChat.content.messages.at(-1).text.includes('synthetic result') &&
      !!serverChat.content.receipt,
  );
  check(
    'cloud conversation retains its original selected card without a journal lookup',
    serverChat.content.messages.at(-1).artifacts[0]?.reading.cards[0].id === draw.data.cards[0].id &&
      serverChat.content.messages.at(-1).artifacts[0]?.input.input.cards[0].reversed === false,
  );
  check(
    'cloud Agent refuses unpersisted user messages',
    (
      await call(
        '/api/v1/agent',
        'POST',
        {
          message: 'hello',
          history: [],
          consent: true,
          locale: 'en',
          mode: 'explore',
          context: { note: '', readings: [], sourceIds: [] },
        },
        a.cookie,
      )
    ).data.error.code === 'conversation_not_saved',
  );
  const beforeOps = (
    await db.prepare('SELECT COUNT(*) n FROM wb_operations WHERE owner=?').bind(b.data.user.id).first()
  ).n;
  const privateDraw = await call(
    '/api/v1/tarot',
    'POST',
    { count: 1, reversals: false, locale: 'en' },
    b.cookie,
    { headers: { DNT: '1' } },
  );
  check(
    'request-level opt out records no account operation',
    (await db.prepare('SELECT COUNT(*) n FROM wb_operations WHERE owner=?').bind(b.data.user.id).first())
      .n === beforeOps,
  );
  const noConsentId = randomUUID();
  await call(
    '/api/account/records/journal/' + noConsentId,
    'PUT',
    {
      requestId: randomUUID(),
      revision: 0,
      source: 'current',
      content: {
        ...record,
        id: noConsentId,
        result: privateDraw.data,
        receipt: privateDraw.headers.get('x-wenbu-receipt'),
      },
    },
    b.cookie,
  );
  check(
    'later consent cannot retroactively activate an opted-out result',
    (await db.prepare('SELECT activated_at FROM wb_accounts WHERE user_id=?').bind(b.data.user.id).first())
      .activated_at === null,
  );
  const instanceB = randomUUID();
  await call('/api/account/records/session/' + sid, 'GET', undefined, a.cookie, {
    headers: { 'X-Wenbu-Instance': instanceB },
  });
  await call('/api/v1/tarot', 'POST', { count: 1, reversals: false, locale: 'en' }, a.cookie, {
    headers: { 'X-Wenbu-Instance': instanceB },
  });
  const included = await call('/api/admin/accounts/analytics?days=30&test=include', 'GET', undefined, '', {
    headers: { Authorization: 'Bearer local-test-only' },
  });
  check(
    'account insights queries reconcile with native D1',
    included.status === 200 &&
      included.data.totals.registered === 2 &&
      included.data.totals.measured === 2 &&
      included.data.totals.activated === 1 &&
      included.data.legacyImportAccounts === 1,
  );
  check(
    'fixed guest cohort includes trial then signup then save',
    included.data.trial.completed === 1 &&
      included.data.trial.registered === 1 &&
      included.data.trial.saved === 1,
  );
  check(
    'cross instance continuation requires read plus a new operation',
    included.data.continued.cross_instance === 1 && included.data.continued.repeat_value === 1,
  );
  check(
    'immature retention cohort has no denominator',
    included.data.cohorts.every((c) => c.eligible === 0),
  );
  const excluded = await call('/api/admin/accounts/analytics?days=30', 'GET', undefined, '', {
    headers: { Authorization: 'Bearer local-test-only' },
  });
  check('test registrations excluded by default', excluded.data.totals.registered === 0);
  const day = 86400000,
    cohort = Date.now() - 9 * day;
  await db
    .prepare('UPDATE wb_accounts SET created_at=?,activated_at=? WHERE user_id=?')
    .bind(cohort, cohort, b.data.user.id)
    .run();
  await db
    .prepare('INSERT INTO wb_operations(owner,operation_id,kind,completed_at) VALUES(?,?,?,?)')
    .bind(
      b.data.user.id,
      randomUUID(),
      'journal',
      Math.floor((cohort + 28800000) / day) * day - 28800000 + day + 1000,
    )
    .run();
  const retained = await call('/api/admin/accounts/analytics?days=30&test=include', 'GET', undefined, '', {
    headers: { Authorization: 'Bearer local-test-only' },
  });
  // A selected 7-day report must still contain a fully observed trial cohort.
  const matureAt = Date.now() - 10 * day;
  for (const [key, registered, savedAt, testFlag] of [
    ['mature-in-window', matureAt + day, matureAt + 2 * day, 0],
    ['mature-too-late', matureAt + 8 * day, matureAt + 8 * day, 0],
    ['mature-marked-test', matureAt + day, matureAt + day, 1],
  ]) {
    await db
      .prepare(
        'INSERT INTO wb_trial_cohorts(guest_hash,first_completed_at,locale,is_test,registered_at,saved_at) VALUES(?,?,?,?,?,?)',
      )
      .bind(key, matureAt, 'en', testFlag, registered, savedAt)
      .run();
  }
  const mature = await call('/api/admin/accounts/analytics?days=7&locale=en', 'GET', undefined, '', {
    headers: { Authorization: 'Bearer local-test-only' },
  });
  check(
    'mature conversion uses an older complete window with matched denominators',
    mature.data.version === 'account-v3' &&
      mature.data.trial.completed === 0 &&
      mature.data.matureTrial.completed === 2 &&
      mature.data.matureTrial.registered === 1 &&
      mature.data.matureTrial.saved === 1 &&
      mature.data.matureTrial.to - mature.data.matureTrial.from === 7 * day,
  );
  const matureIncluded = await call(
    '/api/admin/accounts/analytics?days=7&locale=en&test=include',
    'GET',
    undefined,
    '',
    {
      headers: { Authorization: 'Bearer local-test-only' },
    },
  );
  check(
    'mature trial and retention respect test inclusion and independent complete windows',
    matureIncluded.data.matureTrial.completed === 3 &&
      matureIncluded.data.matureTrial.registered === 2 &&
      matureIncluded.data.cohorts[1].eligible === 1 &&
      matureIncluded.data.cohorts[0].eligible === 0 &&
      matureIncluded.data.cohorts[0].to - matureIncluded.data.cohorts[1].to === 6 * day,
  );
  check(
    'day 1 and day 7 windows are independent',
    retained.data.cohorts[0].eligible === 1 &&
      retained.data.cohorts[0].returned === 1 &&
      retained.data.cohorts[1].eligible === 1 &&
      retained.data.cohorts[1].returned === 0,
  );
  const interpretation = await call(
    '/api/v1/interpret',
    'POST',
    {
      kind: 'tarot',
      input: { cards: draw.data.cards.map((c) => ({ id: c.id, reversed: c.reversed })) },
      question: 'What should I consider?',
      context: '',
      locale: 'en',
      consent: true,
    },
    a.cookie,
  );
  check(
    'completed standalone AI interpretation gets its own signed result',
    interpretation.status === 200 && !!interpretation.headers.get('x-wenbu-receipt'),
  );
  const interpretedId = randomUUID();
  const interpreted = await call(
    '/api/account/records/journal/' + interpretedId,
    'PUT',
    {
      requestId: randomUUID(),
      revision: 0,
      source: 'current',
      content: {
        ...record,
        id: interpretedId,
        answer: interpretation.data.answer,
        receipt: interpretation.headers.get('x-wenbu-receipt'),
      },
    },
    a.cookie,
  );
  check(
    'saved interpretation receipt validates against its exact answer',
    interpreted.status === 200 &&
      (await call('/api/account/records/journal/' + interpretedId, 'GET', undefined, a.cookie)).data
        .provenance === 'verified_operation',
  );
  const beforeSize = await db
    .prepare('SELECT storage_bytes FROM wb_accounts WHERE user_id=?')
    .bind(b.data.user.id)
    .first();
  const overId = randomUUID();
  const over = await call(
    '/api/account/records/journal/' + overId,
    'PUT',
    {
      requestId: randomUUID(),
      revision: 0,
      content: { ...record, id: overId, note: '界'.repeat(90000) },
      source: 'current',
    },
    b.cookie,
  );
  check(
    'UTF-8 byte limit rejects oversized records without truncation',
    over.status === 413 &&
      (await db.prepare('SELECT storage_bytes FROM wb_accounts WHERE user_id=?').bind(b.data.user.id).first())
        .storage_bytes === beforeSize.storage_bytes,
  );
  await db
    .prepare('UPDATE wb_accounts SET storage_bytes=? WHERE user_id=?')
    .bind(10 * 1024 * 1024, b.data.user.id)
    .run();
  const full = await call(
    '/api/account/records/journal/' + overId,
    'PUT',
    { requestId: randomUUID(), revision: 0, content: { ...record, id: overId }, source: 'current' },
    b.cookie,
  );
  check(
    'account byte allowance fails without partial record writes',
    full.status === 413 &&
      (await call('/api/account/records/journal/' + overId, 'GET', undefined, b.cookie)).status === 404,
  );
  await db
    .prepare('UPDATE wb_accounts SET storage_bytes=? WHERE user_id=?')
    .bind(beforeSize.storage_bytes, b.data.user.id)
    .run();
  await db.batch(
    Array.from({ length: 51 }, (_, i) =>
      db
        .prepare(
          "INSERT INTO wb_records(owner,kind,id,content,hash,bytes,revision,created_at,updated_at) VALUES(?,'journal',?,'{}','fixture',2,1,?,?)",
        )
        .bind(b.data.user.id, 'page_' + i, Date.now(), Date.now() + i),
    ),
  );
  const page1 = (await call('/api/account/records', 'GET', undefined, b.cookie)).data;
  const page2 = (
    await call(
      '/api/account/records?cursor=' + encodeURIComponent(page1.nextCursor),
      'GET',
      undefined,
      b.cookie,
    )
  ).data;
  check(
    'record manifest paginates without duplicate IDs',
    page1.records.length === 50 &&
      page2.records.length === 4 &&
      new Set([...page1.records, ...page2.records].map((r) => r.id)).size === 54 &&
      !page2.nextCursor,
  );
  await db.prepare("DELETE FROM wb_records WHERE owner=? AND id LIKE 'page_%'").bind(b.data.user.id).run();
  const snap = await db
    .prepare('SELECT * FROM wb_records WHERE owner=? AND id=?')
    .bind(a.data.user.id, id)
    .first();
  check(
    'delete current record',
    (await call('/api/account/records/journal/' + id, 'DELETE', undefined, a.cookie)).status === 200,
  );
  check(
    'stale upload cannot revive deleted',
    (
      await call(
        '/api/account/records/journal/' + id,
        'PUT',
        { ...input, requestId: randomUUID(), revision: 3 },
        cookie,
      )
    ).status === 410,
  );
  await db
    .prepare('UPDATE wb_records SET content=?,bytes=?,deleted_at=NULL,revision=? WHERE owner=? AND id=?')
    .bind(snap.content, snap.bytes, snap.revision, a.data.user.id, id)
    .run();
  check(
    'external tombstone masks restored D1 content',
    (await call('/api/account/records/journal/' + id, 'GET', undefined, a.cookie)).status === 404,
  );
  check(
    'external tombstone blocks restored write',
    (
      await call(
        '/api/account/records/journal/' + id,
        'PUT',
        { ...input, requestId: randomUUID(), revision: snap.revision },
        cookie,
      )
    ).status === 410,
  );
  check(
    'history pause accepted',
    (await call('/api/account/preferences', 'PATCH', { cloudHistory: false }, b.cookie)).status === 200,
  );
  check(
    'pause rejects new server save',
    (
      await call(
        '/api/account/records/journal/' + randomUUID(),
        'PUT',
        { requestId: randomUUID(), revision: 0, content: { ...record, id: 'x' }, source: 'current' },
        b.cookie,
      )
    ).status === 422,
  );
  const pauseId = randomUUID();
  check(
    'pause enforced for valid record',
    (
      await call(
        '/api/account/records/journal/' + pauseId,
        'PUT',
        { requestId: randomUUID(), revision: 0, content: { ...record, id: pauseId }, source: 'current' },
        b.cookie,
      )
    ).data.error.code === 'cloud_history_paused',
  );
  check(
    'unauthorized auth endpoints blocked',
    (await call('/api/auth/change-email', 'POST', { newEmail: 'other@wenbu.test' }, a.cookie)).status === 404,
  );
  const countBeforeClarification = (await db.prepare('SELECT COUNT(*) n FROM wb_trial_cohorts').first()).n;
  const clarification = await call('/api/v1/agent', 'POST', {
    message: 'fixture:clarification',
    history: [],
    consent: true,
    locale: 'en',
    mode: 'explore',
  });
  check(
    'clarification-only turns are not completed trial results',
    clarification.status === 200 &&
      clarification.data.includes('"status":"waiting"') &&
      !clarification.data.includes('"receipt":') &&
      (await db.prepare('SELECT COUNT(*) n FROM wb_trial_cohorts').first()).n === countBeforeClarification,
  );
  const identitySnapshot = await db.prepare('SELECT * FROM user WHERE id=?').bind(a.data.user.id).first();
  const sessionSnapshot = await db
    .prepare('SELECT * FROM session WHERE userId=?')
    .bind(a.data.user.id)
    .first();
  check(
    'stale owner cannot revoke the new account session',
    (
      await call('/api/auth/revoke-other-sessions', 'POST', {}, b.cookie, {
        headers: { 'X-Wenbu-Owner': a.data.user.id },
      })
    ).status === 409,
  );
  check(
    'whole account deletion',
    (await call('/api/account/delete', 'POST', { confirmation: 'DELETE' }, a.cookie)).status === 200,
  );
  check(
    'deleted session revoked',
    (await call('/api/account/records', 'GET', undefined, a.cookie)).status === 401,
  );
  check(
    'deleted content erased',
    (await db.prepare('SELECT COUNT(*) AS n FROM wb_records WHERE owner=?').bind(a.data.user.id).first())
      .n === 0,
  );
  check(
    'other account unaffected',
    (await call('/api/account/records', 'GET', undefined, b.cookie)).data.records.length === 3,
  );
  await call('/api/auth/email-otp/send-verification-otp', 'POST', {
    email: 'race@wenbu.test',
    type: 'sign-in',
  });
  const raced = await Promise.all(
    Array.from({ length: 8 }, () =>
      call('/api/auth/sign-in/email-otp', 'POST', {
        email: 'race@wenbu.test',
        otp: messages.get('race@wenbu.test'),
      }),
    ),
  );
  if (raced.filter((r) => r.status === 200).length !== 1)
    console.log(raced.map((r) => ({ status: r.status, code: r.data?.code || r.data?.error?.code })));
  check(
    'simultaneous OTP consumption has exactly one winner',
    raced.filter((r) => r.status === 200).length === 1,
  );
  await call('/api/auth/email-otp/send-verification-otp', 'POST', {
    email: 'attempts@wenbu.test',
    type: 'sign-in',
  });
  const correct = messages.get('attempts@wenbu.test'),
    wrong = correct === '000000' ? '000001' : '000000';
  for (let n = 0; n < 3; n++)
    await call('/api/auth/sign-in/email-otp', 'POST', { email: 'attempts@wenbu.test', otp: wrong });
  check(
    'three incorrect codes invalidate the challenge',
    (await call('/api/auth/sign-in/email-otp', 'POST', { email: 'attempts@wenbu.test', otp: correct }))
      .status >= 400,
  );
  await call('/api/auth/email-otp/send-verification-otp', 'POST', {
    email: 'expired@wenbu.test',
    type: 'sign-in',
  });
  await db
    .prepare("UPDATE verification SET expiresAt=? WHERE identifier LIKE '%expired@wenbu.test%'")
    .bind(new Date(Date.now() - 60000).toISOString())
    .run();
  check(
    'expired OTP is rejected',
    (
      await call('/api/auth/sign-in/email-otp', 'POST', {
        email: 'expired@wenbu.test',
        otp: messages.get('expired@wenbu.test'),
      })
    ).status >= 400,
  );
  for (const [table, row] of [
    ['user', identitySnapshot],
    ['session', sessionSnapshot],
  ]) {
    const keys = Object.keys(row);
    await db
      .prepare(
        `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      )
      .bind(...keys.map((k) => row[k]))
      .run();
  }
  check(
    'restored identity and session stay blocked by independent deletion intent',
    (await call('/api/account/records', 'GET', undefined, a.cookie)).status === 401,
  );
  const reconciled = await call('/__fixture/reconcile', 'POST');
  check(
    'maintenance replay erases restored identity and revokes every stale session',
    reconciled.status === 200 &&
      reconciled.data.accounts === 1 &&
      (await db.prepare('SELECT COUNT(*) n FROM session').first()).n === 0 &&
      (await db.prepare('SELECT id FROM user WHERE id=?').bind(a.data.user.id).first()) === null,
  );
  mailFailure = true;
  const fail = await call('/api/auth/email-otp/send-verification-otp', 'POST', {
    email: 'failure@wenbu.test',
    type: 'sign-in',
  });
  check('provider failure not acknowledged as sent', fail.status === 503);
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      scope:
        'local workerd + native D1 + production auth limits + mock email; no live delivery or model calls',
    }),
  );
} finally {
  await mf.dispose();
  await rm(temp, { recursive: true, force: true });
}
