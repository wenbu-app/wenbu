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
        d1Databases: ['USERDATA'],
        durableObjects: {
          QUOTA: { className: 'UsageGate', useSQLite: true },
          PRIVACY_LEDGER: { className: 'DeletionLedger', useSQLite: true },
        },
        bindings: {
          SITE_URL: 'http://127.0.0.1:8788',
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
              `data: ${JSON.stringify({ model: 'local-fixture', choices: [{ delta, finish_reason: first ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
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
const db = await mf.getD1Database('USERDATA');
for (const file of (await readdir(path.join(root, 'migrations-userdata')))
  .filter((f) => f.endsWith('.sql'))
  .sort())
  for (const s of (await readFile(path.join(root, 'migrations-userdata', file), 'utf8'))
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(s).run();
console.log('Disposable account preview: http://127.0.0.1:8788 · synthetic mail and model only');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await mf.dispose();
    await rm(temp, { recursive: true, force: true });
    process.exit(0);
  });
