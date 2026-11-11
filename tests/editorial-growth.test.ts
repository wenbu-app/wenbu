import { describe, expect, it, vi } from 'vitest';
import {
  EDITORIAL_POLICY,
  nextEditorialAttempt,
  reserveEditorialModelCall,
} from '../worker/editorial-policy';
import { editorialDemandLanes } from '../src/data/editorial-demand';
import { editorialGrowthStatus, recordEditorialGrowthReview } from '../worker/editorial-growth';
import { editorialTopics } from '../src/data/editorial-topics';
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
  it('counts current Codex slots across the cutover without including tomorrow', async () => {
    const { env, sql } = database();
    env.EDITORIAL_CODEX_FROM = '2026-11-11';
    const current = Date.parse('2026-11-11T01:05:00Z');
    const insert = sql.prepare(
      'INSERT INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES(?,?,?,?,?)',
    );
    insert.run('legacy-yesterday', '2026-11-10-09', 'published', current, current);
    insert.run('failed-first', '2026-11-11-codex-01', 'blocked', current, current);
    for (let i = 1; i <= 4; i++)
      insert.run('codex-' + i, '2026-11-11-codex-0' + i, 'published', current, current);
    insert.run('legacy-today', '2026-11-11-09', 'published', current, current);
    insert.run('tomorrow', '2026-11-12-codex-01', 'published', current, current);

    const report = await editorialGrowthStatus(env, current);
    expect(report.days.at(-1)).toEqual({
      day: '2026-11-11',
      target: 10,
      due: 4,
      published: 4,
      remaining: 6,
      missed: null,
      attempts: 5,
    });
    expect(report.days.at(-2)).toMatchObject({ day: '2026-11-10', target: 3, published: 1 });
    expect(report.reserveTarget).toBe(140);
  });
  it('uses the active reserve target in the recorded growth review', async () => {
    const { env, sql } = database();
    env.EDITORIAL_CODEX_FROM = '2026-11-11';
    const current = Date.parse('2026-11-11T01:05:00Z');
    const template = editorialTopics.find((topic) => topic.category === 'learn')!;
    for (const hour of ['09', '15', '21'])
      sql
        .prepare('INSERT INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES(?,?,?,?,?)')
        .run('previous-' + hour, '2026-11-10-' + hour, 'published', current, current);
    for (let i = 0; i < 43; i++) {
      const topic = { ...template, id: 'reserve-' + i, slug: 'reserve-' + i };
      sql
        .prepare(
          'INSERT INTO editorial_topics(id,slug,category,definition_json,created_at) VALUES(?,?,?,?,?)',
        )
        .run(topic.id, topic.slug, topic.category, JSON.stringify(topic), current);
    }
    const clock = vi.spyOn(Date, 'now').mockReturnValue(current);
    try {
      const review = await recordEditorialGrowthReview(env);
      expect(review).toMatchObject({ status: 'attention', previousDayMissed: 0, reserveGap: 97 });
      const row = sql.prepare('SELECT evidence_json FROM editorial_observations WHERE id=?').get(review.id);
      expect(JSON.parse(row!.evidence_json as string).operationalTasks.reserveGap).toBe(97);
    } finally {
      clock.mockRestore();
    }
  });
  it('reports provider failures separately from source and quality defects', async () => {
    const { env, sql } = database();
    for (const [i, code] of [
      'editorial_model_http_402',
      'editorial_provider_paused',
      'original_article_unavailable',
      'quality_gate:missing_artifact',
    ].entries())
      sql
        .prepare(
          "INSERT INTO editorial_runs(id,slot,status,error_code,created_at,updated_at) VALUES(?,?,'blocked',?,?,?)",
        )
        .run('class-' + i, '2026-10-25-' + i, code, now, now);
    expect((await editorialGrowthStatus(env, now)).failureCounts).toEqual({
      model_provider: 2,
      source_unavailable: 1,
      quality_or_structure: 1,
    });
  });
});
