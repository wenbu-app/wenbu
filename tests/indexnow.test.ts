import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { indexNowManifest } from '../scripts/lib/indexnow.mjs';
import config from '../src/data/indexnow.json';
import { database } from './helpers/analytics-db';
import { INDEXNOW_CRON, INDEXNOW_INTERVAL_MS, indexNowStatus, submitIndexNow } from '../worker/indexnow';
import worker from '../worker/index';
import { indexNowDelay } from '../worker/indexnow-diagnostics';

const origin = config.origin;
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
function fixture() {
  const { env, sql } = database();
  env.SITE_URL = origin;
  let entries = [
    { url: origin + '/', hash: digest('home') },
    { url: origin + '/en/', hash: digest('en') },
  ];
  let key = config.key;
  env.ASSETS = {
    fetch: vi.fn(
      async (request: Request) =>
        new Response(
          request.url.endsWith('.txt')
            ? key
            : JSON.stringify({
                version: 1,
                origin,
                revision: digest(JSON.stringify(entries)),
                pages: entries,
              }),
        ),
    ),
  } as unknown as Fetcher;
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', send);
  return {
    env,
    sql,
    send,
    entries,
    setEntries: (value: typeof entries) => {
      entries = value;
    },
    setKey: (value: string) => {
      key = value;
    },
  };
}
const nextDay = () => vi.advanceTimersByTime(INDEXNOW_INTERVAL_MS + 1);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('IndexNow build manifest', () => {
  it('is stable and detects content changes independently of page enumeration order', () => {
    const pages = [
      { url: origin + '/', html: '<main>首页</main>' },
      { url: origin + '/en/', html: '<main>Home</main>' },
    ];
    expect(indexNowManifest(pages, origin)).toEqual(indexNowManifest([...pages].reverse(), origin));
    const changed = indexNowManifest([{ ...pages[0], html: '<main>新内容</main>' }, pages[1]], origin);
    expect(changed.revision).not.toBe(indexNowManifest(pages, origin).revision);
  });
  it.each([
    ['https://other.example/', 'public'],
    [origin + '/?question=private', 'public'],
    [origin + '/insights/', 'public'],
    [origin + '/en/journal/', 'public'],
    [origin + '/move/', 'public'],
    [origin + '/', '<meta name="robots" content="noindex,follow">'],
    [origin + '/', '<meta content="NOINDEX" name="robots">'],
    [origin + '/', '<meta content="none" name="bingbot">'],
  ])('rejects unfit URLs or noindex content: %s', (url, html) => {
    expect(() => indexNowManifest([{ url, html }], origin)).toThrow();
  });
});

describe('deployed IndexNow submissions', () => {
  it('sends the live set once, persists a receipt, and avoids submitting unchanged pages', async () => {
    const f = fixture();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'submitted', httpStatus: 200, submitted: 2 });
    expect(JSON.parse(f.send.mock.calls[0][1].body)).toEqual({
      host: 'wenbu.app',
      key: config.key,
      keyLocation: `${origin}/${config.key}.txt`,
      urlList: f.entries.map((p) => p.url),
    });
    expect(f.send.mock.calls[0][1].redirect).toBe('manual');
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'unchanged', submitted: 0 });
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(await indexNowStatus(f.env)).toMatchObject({
      trackedPages: 2,
      receipts: [{ http_status: 200, url_count: 2 }],
    });
  });
  it('submits only additions, changes and deletions, then removes deleted URLs from the baseline', async () => {
    const f = fixture();
    await submitIndexNow(f.env);
    f.setEntries([
      { url: origin + '/', hash: digest('edited') },
      { url: origin + '/learn/', hash: digest('new') },
    ]);
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ submitted: 3 });
    expect(JSON.parse(f.send.mock.calls[1][1].body).urlList).toEqual([
      origin + '/learn/',
      origin + '/',
      origin + '/en/',
    ]);
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'unchanged' });
    expect(f.sql.prepare('SELECT COUNT(*) AS n FROM indexnow_pages').get()?.n).toBe(2);
  });
  it('records 202 as pending key validation and does not repeatedly submit the received URLs', async () => {
    const f = fixture();
    f.send.mockResolvedValue(new Response(null, { status: 202 }));
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'pending_validation', httpStatus: 202 });
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'unchanged' });
    expect((await indexNowStatus(f.env)).receipts).toMatchObject([{ outcome: 'pending_validation' }]);
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('honors Retry-After, retains failed URLs, and retries after the backoff window', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.send.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '172800' } }));
    expect(await submitIndexNow(f.env)).toMatchObject({
      status: 'retrying',
      submitted: 0,
      retryAt: Date.now() + 172800_000,
    });
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'backoff' });
    expect((await indexNowStatus(f.env)).state).toMatchObject({
      last_status: 'retrying',
      last_error: 'http_429',
    });
    expect(f.sql.prepare('SELECT COUNT(*) AS n FROM indexnow_pages').get()?.n).toBe(0);
    vi.advanceTimersByTime(172800_001);
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'submitted', submitted: 2 });
    expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('persists a transport failure without advancing the baseline', async () => {
    const f = fixture();
    f.send.mockRejectedValue(new Error('network failure'));
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'retrying', httpStatus: null });
    expect((await indexNowStatus(f.env)).trackedPages).toBe(0);
  });
  it.each([301, 302, 307, 400, 403, 422, 500])(
    'does not lose changes after an HTTP %i failure',
    async (status) => {
      const f = fixture();
      f.send.mockResolvedValueOnce(new Response(null, { status }));
      expect(await submitIndexNow(f.env)).toMatchObject({
        status: 'retrying',
        submitted: 0,
        httpStatus: status,
      });
      expect((await indexNowStatus(f.env)).trackedPages).toBe(0);
      f.sql.prepare('UPDATE indexnow_state SET retry_at = 0').run();
      nextDay();
      expect(await submitIndexNow(f.env)).toMatchObject({ status: 'submitted', submitted: 2 });
    },
  );
  it('does not claim a persisted receipt after losing its lease during the outbound request', async () => {
    const f = fixture();
    f.send.mockImplementationOnce(async () => {
      f.sql.prepare('UPDATE indexnow_state SET lease_owner = ?').run('replacement-owner');
      return new Response(null, { status: 200 });
    });
    expect(await submitIndexNow(f.env)).toMatchObject({
      status: 'lease_lost',
      submitted: 0,
      httpStatus: 200,
    });
    expect((await indexNowStatus(f.env)).trackedPages).toBe(0);
    expect((await indexNowStatus(f.env)).receipts).toHaveLength(0);
    expect(f.sql.prepare('SELECT lease_owner FROM indexnow_state').get()?.lease_owner).toBe(
      'replacement-owner',
    );
  });
  it('does not advance fingerprints if receipt persistence fails after delivery', async () => {
    const f = fixture();
    vi.spyOn(f.env.ANALYTICS!, 'batch').mockRejectedValueOnce(new Error('D1 unavailable'));
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'retrying', submitted: 0 });
    expect((await indexNowStatus(f.env)).trackedPages).toBe(0);
    f.sql.prepare('UPDATE indexnow_state SET retry_at = 0').run();
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'submitted', submitted: 2 });
    expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('prevents overlapping runs and recovers an expired lease', async () => {
    const f = fixture();
    f.sql
      .prepare('UPDATE indexnow_state SET lease_owner = ?, lease_until = ?')
      .run('other', Date.now() + 10000);
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'busy' });
    expect(f.send).not.toHaveBeenCalled();
    f.sql.prepare('UPDATE indexnow_state SET lease_until = 0').run();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'submitted' });
  });
  it('refuses broken key assets, invalid origins, and empty manifests', async () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => f.setKey('wrong'),
      (f: ReturnType<typeof fixture>) => f.setEntries([{ url: 'https://evil.example/', hash: digest('x') }]),
      (f: ReturnType<typeof fixture>) => f.setEntries([]),
    ]) {
      const f = fixture();
      change(f);
      expect(await submitIndexNow(f.env)).toMatchObject({ status: 'retrying', submitted: 0 });
      expect(f.send).not.toHaveBeenCalled();
      f.sql.close();
    }
  });
  it('bounds each submission and resumes the remaining changes', async () => {
    const f = fixture();
    f.setEntries(
      Array.from({ length: 11 }, (_, i) => ({
        url: `${origin}/learn/test-${i}/`,
        hash: digest(String(i)),
      })),
    );
    expect(await submitIndexNow(f.env)).toMatchObject({ submitted: 10, remaining: 1 });
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ submitted: 1, remaining: 0 });
  });
  it('runs IndexNow only on its own cron, leaving the archive schedule independent', async () => {
    const f = fixture(),
      tasks: Promise<unknown>[] = [];
    f.env.ANALYTICS_ARCHIVE = { put: vi.fn() } as unknown as R2Bucket;
    const context = {
      waitUntil: (task: Promise<unknown>) => tasks.push(task),
    } as unknown as ExecutionContext;
    await worker.scheduled({ cron: INDEXNOW_CRON } as ScheduledController, f.env, context);
    await Promise.all(tasks);
    expect(f.send).toHaveBeenCalledTimes(1);
    tasks.length = 0;
    await worker.scheduled({ cron: '15 * * * *' } as ScheduledController, f.env, context);
    await Promise.all(tasks);
    expect(f.send).toHaveBeenCalledTimes(1);
    tasks.length = 0;
    await worker.scheduled(
      { cron: '*/15 * * * *', scheduledTime: Date.now() } as ScheduledController,
      f.env,
      context,
    );
    await Promise.all(tasks);
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('does not scan assets again within 24 hours, even with no changes or a short remote retry delay', async () => {
    const f = fixture();
    f.send.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '60' } }));
    expect(await submitIndexNow(f.env)).toMatchObject({ retryAt: Date.now() + INDEXNOW_INTERVAL_MS });
    const calls = vi.mocked(f.env.ASSETS.fetch).mock.calls.length;
    vi.advanceTimersByTime(INDEXNOW_INTERVAL_MS - 1);
    await submitIndexNow(f.env);
    expect(vi.mocked(f.env.ASSETS.fetch).mock.calls).toHaveLength(calls);
    vi.advanceTimersByTime(2);
    await submitIndexNow(f.env);
    nextDay();
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'unchanged' });
    const afterUnchanged = vi.mocked(f.env.ASSETS.fetch).mock.calls.length;
    expect(await submitIndexNow(f.env)).toMatchObject({ status: 'daily_wait' });
    expect(vi.mocked(f.env.ASSETS.fetch).mock.calls).toHaveLength(afterUnchanged);
  });
  it('keeps manual submission and status behind admin authentication and same-origin checks', async () => {
    const f = fixture();
    expect((await worker.fetch(new Request(origin + '/api/admin/indexnow'), f.env)).status).toBe(401);
    const headers = { Authorization: 'Bearer test-only-private-admin' };
    expect(
      (
        await worker.fetch(
          new Request(origin + '/api/admin/indexnow/run', { method: 'POST', headers }),
          f.env,
        )
      ).status,
    ).toBe(403);
    const response = await worker.fetch(
      new Request(origin + '/api/admin/indexnow/run', {
        method: 'POST',
        headers: { ...headers, Origin: origin },
      }),
      f.env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(await response.json()).toMatchObject({ status: 'submitted' });
  });
  it('retains bounded provider diagnostics without ownership keys, cookies or auth values', async () => {
    const f = fixture();
    f.send.mockResolvedValueOnce(
      new Response(
        '<p>Throttled ' +
          config.key +
          ' Bearer private-test-value somebody@example.com ' +
          'x'.repeat(9000) +
          '</p>',
        {
          status: 429,
          headers: {
            'content-type': 'text/html',
            server: 'provider-edge',
            'Set-Cookie': 'private-test-cookie',
          },
        },
      ),
    );
    await submitIndexNow(f.env);
    const receipt = (await indexNowStatus(f.env)).receipts[0];
    const diagnostic = JSON.parse(receipt.diagnostics_json as string);
    expect(diagnostic.headers.server).toBe('provider-edge');
    expect(diagnostic.excerpt).toContain('Throttled [ownership-key] Bearer [redacted] [email]');
    expect(diagnostic.bodyTruncated).toBe(true);
    expect(diagnostic.excerpt.length).toBeLessThanOrEqual(800);
    expect(JSON.stringify(diagnostic)).not.toMatch(/private-test-value|private-test-cookie|somebody@example/);
    expect((await indexNowStatus(f.env)).delivery).toMatchObject({ pendingChanges: 2 });
  });
  it('gives repeated throttling more recovery time without shortening a provider wait', () => {
    expect(indexNowDelay(429, 1, 0)).toBe(INDEXNOW_INTERVAL_MS);
    expect(indexNowDelay(429, 2, 0)).toBe(2 * INDEXNOW_INTERVAL_MS);
    expect(indexNowDelay(429, 20, 0)).toBe(3 * INDEXNOW_INTERVAL_MS);
    expect(indexNowDelay(429, 20, 9 * INDEXNOW_INTERVAL_MS)).toBe(9 * INDEXNOW_INTERVAL_MS);
    expect(indexNowDelay(500, 20, 0)).toBe(INDEXNOW_INTERVAL_MS);
  });
  it('does not let an old failed URL monopolize fresh publication probes', async () => {
    const f = fixture();
    const old = origin + '/blog/old/',
      recent = origin + '/learn/recent/';
    f.setEntries([
      { url: old, hash: digest('old') },
      { url: recent, hash: digest('new') },
    ]);
    f.sql.prepare('UPDATE indexnow_state SET failures=20').run();
    f.sql
      .prepare(
        "INSERT INTO indexnow_submissions(id,submitted_at,revision,http_status,outcome,url_count,urls_json) VALUES(?,?,?,429,'retrying',1,?)",
      )
      .run(crypto.randomUUID(), Date.now() - INDEXNOW_INTERVAL_MS, digest('prior'), JSON.stringify([old]));
    f.sql
      .prepare(
        'INSERT INTO editorial_publications(path,topic_id,revision,document_json,published_at,updated_at,run_id) VALUES(?,?,?,?,?,?,?)',
      )
      .run('learn/recent', 'recent', digest('doc'), '{}', Date.now(), Date.now(), 'recent-run');
    f.send.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect(await submitIndexNow(f.env)).toMatchObject({
      attempted: 1,
      submitted: 0,
      retryAt: Date.now() + 3 * INDEXNOW_INTERVAL_MS,
    });
    expect(JSON.parse(f.send.mock.calls[0][1].body).urlList).toEqual([recent]);
    vi.advanceTimersByTime(3 * INDEXNOW_INTERVAL_MS + 1);
    await submitIndexNow(f.env);
    expect(JSON.parse(f.send.mock.calls[1][1].body).urlList).toEqual([old]);
  });
  it('dispatches the durable workflow on the daily cron without sending inline or on editorial ticks', async () => {
    const f = fixture(),
      tasks: Promise<unknown>[] = [];
    const createBatch = vi.fn(async () => []);
    f.env.INDEXNOW_WORKFLOW = { createBatch } as unknown as NonNullable<typeof f.env.INDEXNOW_WORKFLOW>;
    const ctx = { waitUntil: (p: Promise<unknown>) => tasks.push(p) } as unknown as ExecutionContext;
    await worker.scheduled(
      { cron: INDEXNOW_CRON, scheduledTime: Date.now() } as ScheduledController,
      f.env,
      ctx,
    );
    await Promise.all(tasks);
    expect(createBatch).toHaveBeenCalledWith([{ id: 'indexnow-2026-10-17', params: {} }]);
    expect(f.send).not.toHaveBeenCalled();
  });
});
