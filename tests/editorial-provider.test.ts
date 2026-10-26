import { afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import {
  ensureEditorialProvider,
  editorialProviderStatus,
  recordEditorialProviderFailure,
  permanentEditorialModelError,
  editorialModelFailureCode,
} from '../worker/editorial-provider';
import { dispatchEditorial, dispatchTopicPlanning } from '../worker/editorial-workflow';
const now = Date.parse('2026-10-26T14:00:00Z');
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const db = database();
  db.env.DEEPSEEK_API_KEY = 'synthetic-private-key';
  db.env.EDITORIAL_ENABLED = 'true';
  db.env.EDITORIAL_WORKFLOW = { createBatch: vi.fn() } as unknown as typeof db.env.EDITORIAL_WORKFLOW;
  return db;
}
describe('editorial shared provider failures', () => {
  it('classifies permanent failures while preserving retryable transport errors', () => {
    expect(editorialModelFailureCode('NonRetryableError: editorial_model_http_402')).toBe(
      'editorial_model_http_402',
    );
    expect(editorialModelFailureCode('NonRetryableError: arbitrary upstream data')).toBe(
      'NonRetryableError: arbitrary upstream data',
    );
    for (const code of [400, 401, 402, 422])
      expect(permanentEditorialModelError('editorial_model_http_' + code)).toBe(true);
    for (const code of [429, 500, 503])
      expect(permanentEditorialModelError('editorial_model_http_' + code)).toBe(false);
  });
  it('does not spend more topic attempts or model reservations during a known billing failure', async () => {
    const { env, sql } = setup(),
      fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await recordEditorialProviderFailure(env, 402);
    expect((await ensureEditorialProvider(env)).reason).toBe('insufficient_balance');
    expect(await dispatchEditorial(env, now)).toMatchObject({ status: 'provider_unavailable' });
    expect(await dispatchTopicPlanning(env, now)).toMatchObject({ status: 'provider_unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_runs').get()?.n).toBe(0);
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_daily_budgets').get()?.n).toBe(0);
    expect(env.EDITORIAL_WORKFLOW!.createBatch).not.toHaveBeenCalled();
  });
  it('uses one leased balance GET when due and never stores credentials or money', async () => {
    const { env, sql } = setup();
    await recordEditorialProviderFailure(env, 402);
    sql.prepare('UPDATE editorial_model_provider SET next_check_at=0').run();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ is_available: false, balance_infos: [{ total_balance: 'private-amount' }] }),
      );
    vi.stubGlobal('fetch', fetcher);
    const states = await Promise.all([ensureEditorialProvider(env), ensureEditorialProvider(env)]);
    expect(states.every((s) => s.status === 'blocked')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.deepseek.com/user/balance');
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
    const audit = JSON.stringify(sql.prepare('SELECT * FROM editorial_observations').all());
    expect(audit).not.toContain('private-amount');
    expect(audit).not.toContain('synthetic-private-key');
    expect((await editorialProviderStatus(env)).next_check_at).toBe(now + 3600_000);
    await ensureEditorialProvider(env);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('resumes after an explicit available response without rewriting budgets, failures or search pauses', async () => {
    const { env, sql } = setup();
    await recordEditorialProviderFailure(env, 402);
    sql.prepare('UPDATE editorial_model_provider SET next_check_at=0').run();
    const before = sql.prepare('SELECT * FROM indexnow_state').get();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ is_available: true }));
    vi.stubGlobal('fetch', fetcher);
    expect((await ensureEditorialProvider(env)).status).toBe('available');
    await ensureEditorialProvider(env);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sql.prepare('SELECT * FROM indexnow_state').get()).toEqual(before);
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_daily_budgets').get()?.n).toBe(0);
  });
  it.each([new Response('bad json'), Response.json({}), new Response(null, { status: 401 })])(
    'keeps missing or unreadable balance unavailable',
    async (response) => {
      const { env, sql } = setup();
      await recordEditorialProviderFailure(env, 402);
      sql.prepare('UPDATE editorial_model_provider SET next_check_at=0').run();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      const state = await ensureEditorialProvider(env);
      expect(state.status).toBe('blocked');
      expect(state.next_check_at).toBe(now + 3600_000);
    },
  );
  it('bootstraps an unresolved historical 402 with a balance GET rather than another generation', async () => {
    const { env, sql } = setup();
    sql
      .prepare(
        "INSERT INTO editorial_runs(id,slot,status,error_code,created_at,updated_at) VALUES('old-402','2026-10-26-09','blocked','editorial_model_http_402',?,?)",
      )
      .run(now - 60000, now - 60000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ is_available: false })));
    expect((await ensureEditorialProvider(env)).status).toBe('blocked');
    expect(sql.prepare("SELECT error_code FROM editorial_runs WHERE id='old-402'").get()?.error_code).toBe(
      'editorial_model_http_402',
    );
  });
  it('cannot clear a newer billing failure with an earlier in-flight successful balance check', async () => {
    const { env, sql } = setup();
    await recordEditorialProviderFailure(env, 402);
    sql.prepare('UPDATE editorial_model_provider SET next_check_at=0').run();
    let finish!: (r: Response) => void, started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        started();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    const probe = ensureEditorialProvider(env);
    await ready;
    vi.mocked(Date.now).mockReturnValue(now + 1000);
    await recordEditorialProviderFailure(env, 402);
    finish(Response.json({ is_available: true }));
    const state = await probe;
    expect(state.status).toBe('blocked');
    expect(state.checked_at).toBe(now + 1000);
    expect(sql.prepare("SELECT COUNT(*) n FROM editorial_observations WHERE status='passed'").get()?.n).toBe(
      0,
    );
  });
});
