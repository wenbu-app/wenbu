import { afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { agentResponse } from '../worker/agent';
import { interpret } from '../worker/ai';
import {
  ensureEditorialProvider,
  recordEditorialProviderFailure,
  sharedModelAvailable,
} from '../worker/editorial-provider';
import type { Actor } from '../worker/account-operations';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  const { env, sql } = database();
  env.EDITORIAL_ENABLED = 'true';
  env.SITE_URL = 'https://wenbu.app';
  env.DEEPSEEK_API_KEY = 'synthetic-test-only-key';
  env.QUOTA_SALT = 'synthetic-salt';
  const reserve = vi.fn(),
    reserveAgent = vi.fn(),
    reserveAccount = vi.fn();
  env.QUOTA = {
    idFromName: () => 'global',
    get: () => ({ reserve, reserveAgent, reserveAccount }),
  } as unknown as typeof env.QUOTA;
  return { env, sql, reserve, reserveAgent, reserveAccount };
}
const request = () => new Request('https://wenbu.app/api/v1/agent');
const actor: Actor = {
  subject: 'synthetic-actor',
  guest: 'synthetic-guest',
  network: 'synthetic-network',
  requestId: 'synthetic-request',
  measured: false,
  request: request(),
};
describe('public turn protection during a shared model outage', () => {
  for (const kind of ['agent', 'interpret'] as const)
    for (const account of [false, true])
      it.each([401, 402])(
        `${kind} keeps ${account ? 'account' : 'network'} allowance when the known upstream state is %i`,
        async (status) => {
          const { env, reserve, reserveAgent, reserveAccount } = setup();
          await recordEditorialProviderFailure(env, status);
          const fetcher = vi.fn();
          vi.stubGlobal('fetch', fetcher);
          const locale = status === 401 ? 'zh' : 'en';
          const call =
            kind === 'agent'
              ? agentResponse(
                  { message: 'A fictional reflection exercise', consent: true, locale },
                  request(),
                  env,
                  undefined,
                  undefined,
                  account ? actor : undefined,
                )
              : interpret(
                  {
                    kind: 'bazi',
                    input: { date: '2000-01-01', time: null, timezone: 'Asia/Shanghai' },
                    question: 'A fictional reflection exercise',
                    consent: true,
                    locale,
                  },
                  request(),
                  env,
                  account ? actor : undefined,
                );
          const error = await call.catch((error: unknown) => error);
          expect(error).toMatchObject({
            status: 503,
            code: kind === 'agent' ? 'agent_unavailable' : 'ai_unavailable',
          });
          expect((error as Error).message).toMatch(
            locale === 'zh' ? /本次未使用/ : /No (turn|reading allowance) was used/,
          );
          expect((error as Error).message).not.toContain('DeepSeek');
          expect(reserve).not.toHaveBeenCalled();
          expect(reserveAgent).not.toHaveBeenCalled();
          expect(reserveAccount).not.toHaveBeenCalled();
          expect(fetcher).not.toHaveBeenCalled();
        },
      );

  it('keeps allowance safe when the required circuit state cannot be read', async () => {
    const { env, sql, reserveAgent } = setup();
    sql.exec('DROP TABLE editorial_model_provider');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      agentResponse({ message: 'A fictional exercise', consent: true }, request(), env),
    ).rejects.toMatchObject({ status: 503, code: 'agent_unavailable' });
    expect(reserveAgent).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not issue public-request balance probes, and the existing positive check admits work again', async () => {
    const { env, sql } = setup();
    await recordEditorialProviderFailure(env, 402);
    sql.prepare('UPDATE editorial_model_provider SET next_check_at=0').run();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ is_available: true }));
    vi.stubGlobal('fetch', fetcher);
    expect(await sharedModelAvailable(env)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    await ensureEditorialProvider(env);
    expect(await sharedModelAvailable(env)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_daily_budgets').get()?.n).toBe(0);
  });

  it('preserves deployments that do not enable the editorial circuit', async () => {
    const { env } = setup();
    env.EDITORIAL_ENABLED = 'false';
    await recordEditorialProviderFailure(env, 402);
    expect(await sharedModelAvailable(env)).toBe(true);
  });
});
