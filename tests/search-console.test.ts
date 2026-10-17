import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { searchConsoleAction, searchConsoleStatus } from '../worker/search-console';
import { searchQueueStatements } from '../worker/search-console-queue';
import worker from '../worker/index';
const origin = 'https://wenbu.app';
const hash = 'a'.repeat(64);
function fixture() {
  const f = database();
  f.env.SITE_URL = origin;
  f.env.ASSETS = {
    fetch: vi.fn(async () =>
      Response.json({
        pages: [
          '/',
          '/en/',
          '/daily/',
          '/learn/',
          '/compare/',
          '/learn/test/',
          '/en/compare/test/',
          '/journal/',
          '/api/v1/bazi',
        ].map((p) => ({ url: origin + p, hash })),
      }),
    ),
  } as unknown as Fetcher;
  return f;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
});
afterEach(() => vi.useRealTimers());
describe('Search Console durable browser queue', () => {
  it('seeds only public non-article pages once and does not requeue the core bootstrap', async () => {
    const f = fixture();
    expect(await searchConsoleAction(f.env, { action: 'seed' })).toEqual({
      status: 'seeded',
      eligible: 5,
      added: 5,
    });
    expect(await searchConsoleAction(f.env, { action: 'seed' })).toMatchObject({ added: 0 });
    const state = await searchConsoleStatus(f.env);
    expect(state.jobs).toHaveLength(5);
    expect(state.jobs.every((j) => j.kind === 'core' && j.status === 'pending')).toBe(true);
  });
  it('requires the exact committed publication and rolls back queue work with its transaction', async () => {
    const f = fixture();
    const urls = [origin + '/learn/test/', origin + '/en/learn/test/'];
    await f.env.ANALYTICS!.batch(
      searchQueueStatements(f.env.ANALYTICS!, urls, hash, Date.now(), { path: 'learn/test' }),
    );
    expect((await searchConsoleStatus(f.env)).jobs).toHaveLength(0);
    f.sql
      .prepare(
        'INSERT INTO editorial_publications(path,topic_id,revision,document_json,published_at,updated_at,run_id) VALUES(?,?,?,?,?,?,?)',
      )
      .run('learn/test', 'test', hash, '{}', Date.now(), Date.now(), 'test');
    await expect(
      f.env.ANALYTICS!.batch([
        ...searchQueueStatements(f.env.ANALYTICS!, urls, hash, Date.now(), { path: 'learn/test' }),
        f.env.ANALYTICS!.prepare('INSERT INTO absent_table VALUES(1)'),
      ]),
    ).rejects.toThrow();
    expect((await searchConsoleStatus(f.env)).jobs).toHaveLength(0);
    await f.env.ANALYTICS!.batch(
      searchQueueStatements(f.env.ANALYTICS!, urls, hash, Date.now(), { path: 'learn/test' }),
    );
    await f.env.ANALYTICS!.batch(
      searchQueueStatements(f.env.ANALYTICS!, urls, hash, Date.now(), { path: 'learn/test' }),
    );
    expect((await searchConsoleStatus(f.env)).jobs).toHaveLength(2);
  });
  it('claims one browser operation at a time, preserves uncertain outcomes, and records acceptance idempotently', async () => {
    const f = fixture();
    await searchConsoleAction(f.env, { action: 'seed' });
    const [a, b] = (await searchConsoleStatus(f.env)).jobs as { id: string }[];
    expect(await searchConsoleAction(f.env, { action: 'claim', id: a.id })).toMatchObject({
      status: 'claimed',
    });
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'not_eligible',
    });
    await searchConsoleAction(f.env, {
      action: 'record',
      id: a.id,
      outcome: 'uncertain',
      reason: 'unknown_outcome',
      note: 'Browser stopped after dispatch; no visible receipt.',
    });
    vi.advanceTimersByTime(3 * 86400_000);
    expect(await searchConsoleAction(f.env, { action: 'claim', id: a.id })).toMatchObject({
      status: 'not_eligible',
    });
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'not_eligible',
    });
    const receipt = {
      action: 'record' as const,
      id: a.id,
      outcome: 'requested' as const,
      reason: 'accepted' as const,
      note: 'Accepted request independently confirmed in the visible Search Console receipt.',
    };
    expect(await searchConsoleAction(f.env, receipt)).toMatchObject({ status: 'recorded' });
    expect(await searchConsoleAction(f.env, receipt)).toMatchObject({ status: 'unchanged' });
    expect(
      f.sql.prepare("SELECT COUNT(*) n FROM search_console_events WHERE action='requested'").get()?.n,
    ).toBe(1);
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'claimed',
    });
  });
  it('pauses the whole browser queue after a provider quota and resumes after 24 hours', async () => {
    const f = fixture();
    await searchConsoleAction(f.env, { action: 'seed' });
    const [a, b] = (await searchConsoleStatus(f.env)).jobs as { id: string }[];
    await searchConsoleAction(f.env, { action: 'claim', id: a.id });
    await searchConsoleAction(f.env, {
      action: 'record',
      id: a.id,
      outcome: 'deferred',
      reason: 'quota',
      note: 'Search Console visibly reports the daily request quota was exceeded.',
    });
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'not_eligible',
    });
    vi.advanceTimersByTime(86400_001);
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'claimed',
    });
  });
  it('keeps mutation origin checks, authentication, and private response headers', async () => {
    const f = fixture();
    const url = origin + '/api/admin/search-console';
    expect((await worker.fetch(new Request(url), f.env)).status).toBe(401);
    const headers = { Authorization: 'Bearer test-only-private-admin', 'Content-Type': 'application/json' };
    expect(
      (await worker.fetch(new Request(url, { method: 'POST', headers, body: '{"action":"seed"}' }), f.env))
        .status,
    ).toBe(403);
    const response = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: { ...headers, Origin: origin },
        body: '{"action":"seed"}',
      }),
      f.env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
  });
  it('does not let a new publication clear the global provider pause', async () => {
    const f = fixture();
    const url = origin + '/learn/task/';
    const db = f.env.ANALYTICS!;
    f.sql
      .prepare(
        'INSERT INTO editorial_publications(path,topic_id,revision,document_json,published_at,updated_at,run_id) VALUES(?,?,?,?,?,?,?)',
      )
      .run('learn/task', 'task', hash, '{}', Date.now(), Date.now(), 'test');
    await db.batch(searchQueueStatements(db, [url], hash, Date.now(), { path: 'learn/task' }));
    const [a] = (await searchConsoleStatus(f.env)).jobs as { id: string }[];
    await searchConsoleAction(f.env, { action: 'claim', id: a.id });
    await searchConsoleAction(f.env, {
      action: 'record',
      id: a.id,
      outcome: 'deferred',
      reason: 'quota',
      note: 'Provider explicitly refused the request because of its daily quota.',
    });
    f.sql.prepare('UPDATE editorial_publications SET revision=?').run('b'.repeat(64));
    await db.batch(searchQueueStatements(db, [url], 'b'.repeat(64), Date.now(), { path: 'learn/task' }));
    const next = (await searchConsoleStatus(f.env)).jobs.find((j) => j.status === 'pending')!;
    expect(await searchConsoleAction(f.env, { action: 'claim', id: String(next.id) })).toMatchObject({
      status: 'not_eligible',
    });
    expect((await searchConsoleStatus(f.env)).globalRetryAt).toBe(Date.now() + 86400_000);
  });
});
