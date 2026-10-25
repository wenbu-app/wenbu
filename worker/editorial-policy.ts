import { shanghaiDay } from './editorial-schema';
import type { Env } from './types';

export const EDITORIAL_POLICY = {
  version: 3,
  dailyTopics: 3,
  hours: [9, 15, 21],
  reviewRounds: 3,
  attemptsPerSlot: 6,
  modelCallsPerRun: 12,
  modelCallsPerDay: 120,
  planningCallsPerDay: 8,
  planningRounds: 2,
  retryDelayMs: 15 * 60_000,
  ownerRefreshMs: 86400_000,
} as const;

// Reserve before the network request. A crash can conservatively consume a
// reservation, but a replay must never create unaccounted or unbounded requests.
export async function reserveEditorialModelCall(env: Env, runId: string, planning = false) {
  const db = env.ANALYTICS!,
    now = Date.now(),
    day = shanghaiDay(now);
  const start = Date.parse(day + 'T00:00:00+08:00');
  await db
    .prepare(
      `INSERT OR IGNORE INTO editorial_daily_budgets(day,model_calls,planning_calls)
    SELECT ?,COALESCE(SUM(model_calls),0),0 FROM editorial_runs WHERE created_at>=? AND created_at<?`,
    )
    .bind(day, start, start + 86400_000)
    .run();
  const result = await db
    .prepare(
      `UPDATE editorial_daily_budgets SET
    model_calls=model_calls+1,planning_calls=planning_calls+?
    WHERE day=? AND model_calls<? AND planning_calls+?<=?
    AND (?=1 OR EXISTS(SELECT 1 FROM editorial_runs WHERE id=? AND model_calls<?))`,
    )
    .bind(
      planning ? 1 : 0,
      day,
      EDITORIAL_POLICY.modelCallsPerDay,
      planning ? 1 : 0,
      EDITORIAL_POLICY.planningCallsPerDay,
      planning ? 1 : 0,
      runId,
      EDITORIAL_POLICY.modelCallsPerRun,
    )
    .run();
  if (!result.meta.changes) throw new Error('editorial_model_budget');
  if (!planning) {
    const run = await db
      .prepare(
        'UPDATE editorial_runs SET model_calls=model_calls+1,updated_at=? WHERE id=? AND model_calls<?',
      )
      .bind(now, runId, EDITORIAL_POLICY.modelCallsPerRun)
      .run();
    if (!run.meta.changes) throw new Error('editorial_model_budget');
  }
}

export function nextEditorialAttempt(
  slots: string[],
  runs: { id: string; slot: string; status: string; updated_at: number }[],
  now: number,
) {
  const unfilled = slots.filter((slot) => !runs.some((r) => r.slot === slot && r.status === 'published'));
  const eligible = unfilled.filter((slot) => {
    const attempts = runs.filter((r) => r.slot === slot);
    return (
      attempts.length < EDITORIAL_POLICY.attemptsPerSlot &&
      attempts.every((r) => r.status === 'blocked' && now - r.updated_at >= EDITORIAL_POLICY.retryDelayMs)
    );
  });
  const slot = eligible.find((s) => !runs.some((r) => r.slot === s)) ?? eligible[0];
  if (!slot) return null;
  const n = runs.filter((r) => r.slot === slot).length;
  return { slot, id: `editorial-${slot}${n ? '-retry-' + n : ''}`, attempt: n + 1 };
}
