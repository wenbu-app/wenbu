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
  it('reconciles only committed bilingual revisions and preserves quota pauses and older receipts', async () => {
    const f = fixture();
    f.sql
      .prepare(
        'INSERT INTO editorial_publications(path,topic_id,revision,document_json,published_at,updated_at,run_id) VALUES(?,?,?,?,?,?,?)',
      )
      .run('compare/current', 'current', hash, '{}', Date.now(), Date.now(), 'current');
    f.sql.prepare("UPDATE search_console_state SET retry_at=?,reason='quota'").run(Date.now() + 86400_000);
    expect(await searchConsoleAction(f.env, { action: 'reconcile' })).toMatchObject({
      publications: 1,
      added: 2,
    });
    expect(await searchConsoleAction(f.env, { action: 'reconcile' })).toMatchObject({ added: 0 });
    const state = await searchConsoleStatus(f.env);
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs.every((j) => j.kind === 'article')).toBe(true);
    expect(state.globalRetryAt).toBe(Date.now() + 86400_000);
    expect(state.inspections.counts).toEqual(
      expect.arrayContaining([
        { provider: 'google', status: 'unknown', total: 2 },
        { provider: 'bing', status: 'unknown', total: 2 },
      ]),
    );
  });
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
    expect((await searchConsoleStatus(f.env)).nextRequest).toMatchObject({
      id: a.id,
      eligible_at: Date.now() + 86400_000,
    });
    vi.advanceTimersByTime(86400_001);
    expect((await searchConsoleStatus(f.env)).nextRequest).toMatchObject({ id: a.id });
    expect(await searchConsoleAction(f.env, { action: 'claim', id: b.id })).toMatchObject({
      status: 'claimed',
    });
  });
  it('keeps actual provider inspections independent of request acceptance and provider pauses', async () => {
    const f = fixture();
    await searchConsoleAction(f.env, { action: 'seed' });
    const a = (await searchConsoleStatus(f.env)).jobs[0] as { id: string; url: string };
    await searchConsoleAction(f.env, { action: 'claim', id: a.id });
    await searchConsoleAction(f.env, {
      action: 'record',
      id: a.id,
      outcome: 'requested',
      reason: 'accepted',
      note: 'Visible accepted submission, no indexing observation.',
    });
    let state = await searchConsoleStatus(f.env);
    expect(state.inspections.counts).toEqual(
      expect.arrayContaining([
        { provider: 'google', status: 'unknown', total: 5 },
        { provider: 'bing', status: 'unknown', total: 5 },
      ]),
    );
    vi.advanceTimersByTime(86400_001);
    expect((await searchConsoleStatus(f.env)).inspections.dueTotal).toBe(10);
    const observation = {
      action: 'inspect' as const,
      id: a.id,
      provider: 'google' as const,
      status: 'indexed' as const,
      checkedAt: new Date().toISOString(),
      lastCrawlAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
      declaredCanonical: a.url,
      indexedCanonical: a.url,
      note: 'Visible Google URL inspection says URL is on Google; crawl predates this job.',
    };
    expect(await searchConsoleAction(f.env, observation)).toMatchObject({ status: 'recorded' });
    expect(await searchConsoleAction(f.env, observation)).toMatchObject({ status: 'unchanged' });
    state = await searchConsoleStatus(f.env);
    expect(state.inspections.latest[0]).toMatchObject({ status: 'indexed', provider: 'google' });
    expect(JSON.parse(state.inspections.latest[0].evidence_json as string).revisionCrawl).toBe(
      'before_update',
    );
    expect(state.inspections.dueTotal).toBe(9);
    expect(state.jobs.find((j) => j.id === a.id)?.status).toBe('requested');
    expect(f.sql.prepare('SELECT COUNT(*) n FROM search_console_inspection_events').get()?.n).toBe(1);
  });
  it('does not turn missing permission into zero indexing or automatically resend an uncertain request', async () => {
    const f = fixture();
    await searchConsoleAction(f.env, { action: 'seed' });
    const a = (await searchConsoleStatus(f.env)).jobs[0] as { id: string };
    await searchConsoleAction(f.env, { action: 'claim', id: a.id });
    await searchConsoleAction(f.env, {
      action: 'record',
      id: a.id,
      outcome: 'uncertain',
      reason: 'unknown_outcome',
      note: 'Dispatch happened but final confirmation was unavailable.',
    });
    const input = {
      action: 'inspect' as const,
      id: a.id,
      provider: 'bing' as const,
      status: 'unavailable' as const,
      checkedAt: new Date().toISOString(),
      lastCrawlAt: null,
      declaredCanonical: null,
      indexedCanonical: null,
      note: 'Bing site inspection unavailable due to expired login.',
    };
    await searchConsoleAction(f.env, input);
    const state = await searchConsoleStatus(f.env);
    expect(state.nextRequest).toBeNull();
    expect(state.blockedByUnresolvedDispatch).toBe(true);
    expect(state.inspections.latest[0].status).toBe('unavailable');
    expect(state.jobs.find((j) => j.id === a.id)?.status).toBe('uncertain');
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
