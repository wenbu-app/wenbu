import { describe, expect, it } from 'vitest';
import {
  EDITORIAL_POLICY,
  nextEditorialAttempt,
  reserveEditorialModelCall,
} from '../worker/editorial-policy';
import { editorialDemandLanes } from '../src/data/editorial-demand';
import { editorialGrowthStatus } from '../worker/editorial-growth';
import { database } from './helpers/analytics-db';

describe('editorial production recovery', () => {
  const now = Date.parse('2026-10-25T08:00:00Z');
  const failed = (n: number) => ({
    id: `failure-${n}`,
    slot: '2026-10-25-09',
    status: 'blocked',
    updated_at: now - 16 * 60000,
  });
  it('prioritizes unattempted due slots, then keeps filling failed slots', () => {
    const slots = ['2026-10-25-09', '2026-10-25-15'];
    expect(nextEditorialAttempt(slots, [failed(0), failed(1)], now)?.slot).toBe(slots[1]);
    const runs = [failed(0), failed(1), { ...failed(2), slot: slots[1], status: 'published' }];
    expect(nextEditorialAttempt(slots, runs, now)?.id).toBe('editorial-2026-10-25-09-retry-2');
  });
  it('cannot race active work, repeat a publication, retry early or exceed six attempts', () => {
    const slots = ['2026-10-25-09'];
    for (const run of [
      { ...failed(0), status: 'researching' },
      { ...failed(0), status: 'published' },
      { ...failed(0), updated_at: now },
    ])
      expect(nextEditorialAttempt(slots, [run], now)).toBeNull();
    expect(
      nextEditorialAttempt(
        slots,
        Array.from({ length: 6 }, (_, i) => failed(i)),
        now,
      ),
    ).toBeNull();
  });
  it('reserves requests and refuses run, planning and daily budget overruns', async () => {
    const { env, sql } = database();
    sql
      .prepare(
        "INSERT INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES('budget-run','synthetic','drafting',?,?)",
      )
      .run(Date.now(), Date.now());
    await reserveEditorialModelCall(env, 'budget-run');
    expect(
      sql.prepare("SELECT model_calls FROM editorial_runs WHERE id='budget-run'").get()?.model_calls,
    ).toBe(1);
    sql
      .prepare("UPDATE editorial_runs SET model_calls=? WHERE id='budget-run'")
      .run(EDITORIAL_POLICY.modelCallsPerRun);
    await expect(reserveEditorialModelCall(env, 'budget-run')).rejects.toThrow('editorial_model_budget');
    for (let i = 0; i < EDITORIAL_POLICY.planningCallsPerDay; i++)
      await reserveEditorialModelCall(env, 'planning', true);
    await expect(reserveEditorialModelCall(env, 'planning', true)).rejects.toThrow('editorial_model_budget');
    sql.prepare('UPDATE editorial_daily_budgets SET model_calls=?').run(EDITORIAL_POLICY.modelCallsPerDay);
    sql.prepare("UPDATE editorial_runs SET model_calls=0 WHERE id='budget-run'").run();
    await expect(reserveEditorialModelCall(env, 'budget-run')).rejects.toThrow('editorial_model_budget');
  });
  it('counts slots rather than attempts and keeps tonight separate from due work', async () => {
    const { env, sql } = database();
    sql
      .prepare(
        "INSERT INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES('a','2026-10-25-09','blocked',?,?)",
      )
      .run(now, now);
    sql
      .prepare(
        "INSERT INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES('b','2026-10-25-09','published',?,?)",
      )
      .run(now, now);
    const report = await editorialGrowthStatus(env, now);
    expect(report.days.at(-1)).toEqual({
      day: '2026-10-25',
      target: 3,
      due: 2,
      published: 1,
      remaining: 2,
      missed: null,
      attempts: 2,
    });
    expect(report.keywordCoverage).toHaveLength(6);
    expect(editorialDemandLanes.every((lane) => lane.zh.length >= 4 && lane.en.length >= 4)).toBe(true);
  });
});
