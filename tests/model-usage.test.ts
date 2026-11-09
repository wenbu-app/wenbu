import { expect, test, vi } from 'vitest';
import { deepSeekCost, modelUsageSummary, readDeepSeekUsage, trackDeepSeekCall } from '../worker/model-usage';
import { database } from './helpers/analytics-db';

const received = {
  prompt_tokens: 1000,
  completion_tokens: 100,
  prompt_cache_hit_tokens: 100,
  prompt_cache_miss_tokens: 900,
  completion_tokens_details: { reasoning_tokens: 50 },
};

test('dated tariffs price cache hits, misses and all output without double-counting reasoning', () => {
  const usage = readDeepSeekUsage(received);
  expect(usage).toEqual({ prompt: 1000, completion: 100, hit: 100, miss: 900, reasoning: 50 });
  expect(deepSeekCost('deepseek-v4-flash', usage, Date.parse('2026-11-09T07:00:00Z'))).toMatchObject({
    nanos: 2_604_000,
    band: 'peak',
  });
  for (const date of ['2026-11-08T07:00:00Z', '2026-10-05T07:00:00Z', '2026-11-09T10:00:00Z'])
    expect(deepSeekCost('DeepSeek-V4.1-Flash-1017', usage, Date.parse(date))).toMatchObject({
      nanos: 1_302_000,
      band: 'off_peak',
    });
  expect(deepSeekCost('unknown', usage, Date.parse('2026-11-09T07:00:00Z'))).toBeNull();
  const unknownCache = readDeepSeekUsage({ ...received, prompt_cache_miss_tokens: 80 });
  expect(unknownCache).toMatchObject({ hit: null, miss: null });
  expect(deepSeekCost('deepseek-flash', unknownCache, Date.parse('2026-11-09T07:00:00Z'))).toBeNull();
});

test('keeps billable failed responses and missing usage separate by scenario', async () => {
  const { env, sql } = database();
  env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-09T07:00:00Z'));
    await expect(
      trackDeepSeekCall(
        env,
        { scene: 'editorial_review', runId: 'test-review', round: 1 },
        async (receipt) => {
          Object.assign(receipt, {
            model: 'deepseek-flash',
            usage: received,
            httpStatus: 200,
            requestBytes: 5000,
          });
          throw new Error('invalid model output');
        },
      ),
    ).rejects.toThrow('invalid model output');
    await expect(
      trackDeepSeekCall(env, { scene: 'agent' }, async () => {
        throw new Error('connection interrupted');
      }),
    ).rejects.toThrow('connection interrupted');
    const report = await modelUsageSummary(env);
    expect(report.rows).toEqual([
      expect.objectContaining({
        scene: 'agent',
        calls: 1,
        failed_calls: 1,
        measured_calls: 0,
        priced_calls: 0,
        cost_cny_nanos: null,
      }),
      expect.objectContaining({
        scene: 'editorial_review',
        calls: 1,
        failed_calls: 1,
        measured_calls: 1,
        priced_calls: 1,
        cost_cny_nanos: 2_604_000,
      }),
    ]);
    expect(
      sql.prepare('SELECT run_id,round,http_status FROM model_usage WHERE scene=?').get('editorial_review'),
    ).toEqual({
      run_id: 'test-review',
      round: 1,
      http_status: 200,
    });
  } finally {
    vi.useRealTimers();
  }
});
