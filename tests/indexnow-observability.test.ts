import { spawnSync } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import config from '../src/data/indexnow.json';
import worker from '../worker/index';
import { IndexNowWorkflow } from '../worker/indexnow-workflow';
import {
  recordIndexNowVerification,
  runIndexNowDiagnostic,
  indexNowDiagnosticStatus,
} from '../worker/indexnow-observability';
import { database } from './helpers/analytics-db';

afterEach(() => vi.unstubAllGlobals());

it('fails closed for misspelled, conflicting, or positional CLI arguments before reading credentials or fetching', () => {
  for (const args of [
    ['status'],
    ['--force'],
    ['--status', '--diagnose'],
    ['--url=https://other.example/'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/indexnow.mjs', ...args], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unsupported arguments');
    expect(result.stdout).toBe('');
  }
});

it('diagnoses with fixed credential-free reads and leaves all notification state and receipts untouched', async () => {
  const { env, sql } = database();
  env.SITE_URL = config.origin;
  sql.prepare('UPDATE indexnow_state SET retry_at=?,failures=21').run(Date.now() + 3 * 86400_000);
  const before = sql.prepare('SELECT * FROM indexnow_state').get();
  const send = vi.fn(async (url: string, init: RequestInit) => {
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(new Headers(init.headers).has('Cookie')).toBe(false);
    expect(init.body).toBeUndefined();
    expect(init.redirect).toBe('manual');
    if (url === config.endpoint) {
      expect(init.method).toBe('HEAD');
      return new Response(null, { status: 405, headers: { 'x-msedge-ref': 'synthetic-trace' } });
    }
    expect(init.method).toBe('GET');
    if (url === `${config.origin}/${config.key}.txt`) return new Response(config.key);
    if (url === 'https://checkip.amazonaws.com/') return new Response('192.0.2.100\n');
    expect(url).toBe('https://www.cloudflare.com/cdn-cgi/trace');
    return new Response('ip=2001:db8::1\ncolo=NRT\nother=not-retained');
  });
  vi.stubGlobal('fetch', send);
  const result = await runIndexNowDiagnostic(env, 'synthetic-diagnostic');
  expect(result).toMatchObject({
    notificationSent: false,
    probes: [
      { kind: 'endpoint_head', status: 405 },
      { kind: 'public_key', status: 200, exactKey: true },
      { kind: 'cloudflare_trace', ipSeenByTrace: '2001:db8::1' },
      { kind: 'aws_checkip', ipSeenByTrace: '192.0.2.100' },
    ],
  });
  expect(sql.prepare('SELECT * FROM indexnow_state').get()).toEqual(before);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM indexnow_submissions').get()?.n).toBe(0);
  expect(JSON.stringify(await indexNowDiagnosticStatus(env))).not.toContain(config.key);
  expect(JSON.stringify(await indexNowDiagnosticStatus(env))).not.toContain('not-retained');
  expect(send).toHaveBeenCalledTimes(4);
});

it('retains HTTP evidence even when a public ownership response body is oversized', async () => {
  const { env } = database();
  env.SITE_URL = config.origin;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('x'.repeat(4096), { status: 403 })),
  );
  expect(await runIndexNowDiagnostic(env, 'synthetic-large')).toMatchObject({
    probes: [
      expect.anything(),
      { kind: 'public_key', status: 403, exactKey: false, bodyRead: false },
      expect.anything(),
      expect.anything(),
    ],
  });
});

it('records only the exact canonical ownership route, without raw UA, IP, query, key, cookies or visitor identity', async () => {
  const { env, sql } = database();
  const request = new Request(`${config.origin}/${config.key}.txt?private=never-save`, {
    headers: {
      'User-Agent': 'bingbot with a private note',
      'CF-Connecting-IP': '192.0.2.1',
      Cookie: 'private=true',
    },
  });
  Object.defineProperty(request, 'cf', { value: { asn: 8075, colo: 'NRT' } });
  const response = new Response(config.key);
  for (let i = 0; i < 40; i++) await recordIndexNowVerification(request, response, env);
  for (const url of [`${config.origin}/other.txt`, `https://other.example/${config.key}.txt`])
    await recordIndexNowVerification(new Request(url), response, env);
  const rows = sql.prepare('SELECT * FROM indexnow_verification_hours').all();
  expect(rows).toHaveLength(1);
  expect(rows[0].requests).toBe(40);
  const samples = JSON.parse(rows[0].samples_json as string);
  expect(samples).toHaveLength(32);
  expect(samples[0]).toMatchObject({ claimedSource: 'bing_claim', verifiedBot: null, asn: 8075 });
  const saved = JSON.stringify(rows);
  for (const secret of [config.key, '192.0.2.1', 'private', 'Cookie']) expect(saved).not.toContain(secret);
  expect(await response.text()).toBe(config.key);
  sql.prepare('INSERT INTO indexnow_verification_hours(hour,first_seen,last_seen) VALUES(0,0,0)').run();
  await recordIndexNowVerification(request, new Response(null, { status: 503 }), env);
  expect(sql.prepare('SELECT COUNT(*) AS n FROM indexnow_verification_hours').get()?.n).toBe(1);
});

it('requires admin auth and the canonical Origin for diagnostic dispatch; read-only status never dispatches', async () => {
  const { env } = database();
  env.SITE_URL = config.origin;
  const createBatch = vi.fn();
  env.INDEXNOW_WORKFLOW = { createBatch } as never;
  const url = config.origin + '/api/admin/indexnow/diagnostics';
  expect((await worker.fetch(new Request(url, { method: 'POST' }), env)).status).toBe(401);
  expect(
    (
      await worker.fetch(
        new Request(url, { method: 'POST', headers: { Authorization: 'Bearer test-only-private-admin' } }),
        env,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await worker.fetch(
        new Request(url, { headers: { Authorization: 'Bearer test-only-private-admin' } }),
        env,
      )
    ).status,
  ).toBe(200);
  expect(createBatch).not.toHaveBeenCalled();
});

it.each([{ mode: 'misspelled' }, [], null, 'diagnostic'])(
  'rejects an unknown Workflow payload instead of accidentally notifying: %j',
  async (payload) => {
    const { env } = database();
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    await expect(
      new IndexNowWorkflow({} as never, env).run({ payload } as never, {} as never),
    ).rejects.toThrow('invalid_indexnow_workflow_mode');
    expect(send).not.toHaveBeenCalled();
  },
);
