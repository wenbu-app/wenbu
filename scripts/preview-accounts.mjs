// Disposable local UI harness. Never reads production credentials or sends email.
import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = require('miniflare');
const { build } = require('esbuild');
const root = new URL('../', import.meta.url).pathname,
  temp = await mkdtemp(path.join(tmpdir(), 'wenbu-account-preview-'));
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
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const mf = new Miniflare({
  ...convertV4MiniflareOptions({
    host: '127.0.0.1',
    port: 8788,
    log: new Log(LogLevel.ERROR),
    workers: [
      {
        name: 'account-preview',
        script: await readFile(path.join(temp, 'worker.mjs'), 'utf8'),
        modules: true,
        compatibilityDate: '2026-09-28',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['USERDATA', 'ANALYTICS'],
        durableObjects: {
          QUOTA: { className: 'UsageGate', useSQLite: true },
          PRIVACY_LEDGER: { className: 'DeletionLedger', useSQLite: true },
        },
        bindings: {
          SITE_URL: 'http://127.0.0.1:8788',
          ANALYTICS_ADMIN_TOKEN: 'local-preview-only',
          ACCOUNTS_ENABLED: 'true',
          AUTH_SECRET: randomBytes(48).toString('hex'),
          ACCOUNT_DATA_KEY: randomBytes(48).toString('hex'),
          QUOTA_SALT: randomBytes(48).toString('hex'),
          AI_DAILY_LIMIT: '1000',
          AI_PER_USER_DAILY_LIMIT: '5',
          DEEPSEEK_MODEL: 'deepseek-v4-flash',
          DEEPSEEK_API_KEY: 'local-fixture',
        },
        outboundService: async (request) => {
          if (new URL(request.url).hostname !== 'api.deepseek.com')
            return new Response('Local preview has no external access', { status: 503 });
          if (process.env.WENBU_PREVIEW_GUIDANCE === '1') {
            const input = await request.json();
            const users = input.messages.filter((m) => m.role === 'user');
            const last = users.at(-1)?.content || '';
            const zh = /[\u4e00-\u9fff]/.test(last);
            const first = users.length === 1;
            const birth = /命盘|birth chart/.test(last);
            const reporting = !first && input.messages.at(-1)?.role !== 'tool';
            const delta = first
              ? {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'preview-clarification',
                      type: 'function',
                      function: {
                        name: 'ask_user',
                        arguments: JSON.stringify({
                          question: birth
                            ? zh
                              ? '先从八字开始。请补充出生日期；不知道时刻也可以继续。'
                              : 'Let’s start with BaZi. Add your birth date; it’s OK if you don’t know the time.'
                            : zh
                              ? '你更想从哪件事聊起？'
                              : 'What would you like to explore first?',
                          options: birth
                            ? []
                            : zh
                              ? ['比较两个选择', '说清自己的顾虑', '找一个可以尝试的下一步']
                              : [
                                  'Compare two options',
                                  'Understand what is holding me back',
                                  'Find a practical next step',
                                ],
                          ...(birth ? { form: 'birth' } : {}),
                        }),
                      },
                    },
                  ],
                }
              : reporting
                ? {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'preview-report',
                        type: 'function',
                        function: {
                          name: 'write_report',
                          arguments: JSON.stringify({
                            title: zh ? '把选择想清楚' : 'Thinking through a choice',
                            summary: zh
                              ? '本地演示报告，用来检查界面与保存流程。'
                              : 'A synthetic local report for checking the interface and save flow.',
                            sections: [
                              {
                                heading: zh ? '下一步' : 'Next step',
                                body: zh
                                  ? '写下两个选择各自吸引你的地方，再标记一项需要核实的条件。这不是对结果的预测。'
                                  : 'Write down what appeals to you about each option, then identify one condition to check. This is not a prediction.',
                                sourceIds: [],
                              },
                            ],
                            questions: [],
                          }),
                        },
                      },
                    ],
                  }
                : {
                    content: zh
                      ? '这是本地交互测试，未调用真实模型。可以先写下两个选择各自最吸引你的地方，再看看哪一点最符合你现在的需要。'
                      : 'This is a local interaction test; no real model was called. Start by naming what appeals to you about each option, then consider which matters most right now.',
                  };
            console.log(
              'LOCAL GUIDANCE TURN',
              JSON.stringify({
                turn: users.length,
                mode: input.messages[0].content.includes('Mode: RESEARCH.') ? 'research-capable' : 'explore',
                clarification: first,
              }),
            );
            return new Response(
              `data: ${JSON.stringify({ model: 'local-fixture', choices: [{ delta, finish_reason: first || reporting ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
              { headers: { 'Content-Type': 'text/event-stream' } },
            );
          }
          const text =
            'This is a synthetic local preview response. The cards provide a prompt for reflection, not a prediction. Notice what you can influence, write down one small next step, and return to your notes after you have tried it. No real model request was made.';
          return new Response(
            `data: ${JSON.stringify({ model: 'local-fixture', choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ model: 'local-fixture', choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
            { headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
        serviceBindings: {
          MAILBOX: async (request) => {
            const message = await request.json();
            console.log('LOCAL MOCK EMAIL', message.to, message.text.match(/\b\d{6}\b/)?.[0]);
            return Response.json({ accepted: true });
          },
          ASSETS: async (request) => {
            const name = decodeURIComponent(new URL(request.url).pathname),
              relative = name.endsWith('/') ? name + 'index.html' : name;
            const file = path.resolve(root, 'dist', '.' + relative);
            if (!file.startsWith(path.join(root, 'dist') + path.sep))
              return new Response('', { status: 403 });
            try {
              return new Response(await readFile(file), {
                headers: { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' },
              });
            } catch {
              return new Response('Not found', { status: 404 });
            }
          },
        },
      },
    ],
  }),
  telemetry: { enabled: false },
  logRequests: false,
});
for (const [binding, directory] of [
  ['USERDATA', 'migrations-userdata'],
  ['ANALYTICS', 'migrations'],
]) {
  const db = await mf.getD1Database(binding);
  for (const file of (await readdir(path.join(root, directory))).filter((f) => f.endsWith('.sql')).sort()) {
    for (const sql of (await readFile(path.join(root, directory, file), 'utf8'))
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
}
// Synthetic, explicitly marked test traffic in this disposable database only.
const analytics = await mf.getD1Database('ANALYTICS');
for (let i = 0; i < 120; i++) {
  const row = {
    id: 'preview-event-' + i,
    occurred_at: Date.now() - i * 3600000,
    received_at: Date.now() - i * 3600000,
    event: i % 3 ? 'page_view' : 'calculation_succeeded',
    origin: i % 3 ? 'client' : 'server',
    session_id: 'preview-session-' + Math.floor(i / 3),
    visitor_id: 'preview-visitor-' + (i % 8),
    page: '/tarot/',
    entry_page: '/',
    locale: i % 2 ? 'en' : 'zh',
    source: 'direct',
    medium: 'none',
    campaign: 'none',
    device: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'CN',
    channel: 'web',
    tool: i % 3 ? 'none' : 'tarot',
    mode: 'none',
    action: 'none',
    status: i % 3 ? 'none' : 'complete',
    is_test: 1,
    actor_type: 'browser',
    actor_name: 'safari',
    actor_purpose: 'browse',
    classification_evidence: 'browser_hint',
    classification_version: 1,
  };
  await analytics
    .prepare(
      'INSERT INTO events (' +
        Object.keys(row).join(',') +
        ') VALUES (' +
        Object.keys(row)
          .map(() => '?')
          .join(',') +
        ')',
    )
    .bind(...Object.values(row))
    .run();
}
console.log('Disposable account preview: http://127.0.0.1:8788 · synthetic mail and model only');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await mf.dispose();
    await rm(temp, { recursive: true, force: true });
    process.exit(0);
  });
