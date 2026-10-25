import { afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { seedEditorial } from '../worker/editorial-store';
import { recordEditorialGrowthReview } from '../worker/editorial-growth';
import { dispatchTopicPlanning, replenishTopics } from '../worker/editorial-workflow';
import { commissioningCoolingDown, COMMISSIONING_POLICY } from '../worker/editorial-commissioning';
const now = Date.parse('2026-10-25T08:00:00Z');
afterEach(() => vi.restoreAllMocks());

describe('strategy review recovery regressions', () => {
  it.each([true, false])(
    'does not overwrite the same live planning instance when a duplicate caller races (row exists: %s)',
    async (rowExists) => {
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const { env, sql } = database();
      if (rowExists)
        sql
          .prepare(
            "INSERT INTO editorial_commissioning_runs(id,policy_version,status,started_at) VALUES('same-planning',4,'started',?)",
          )
          .run(now);
      sql
        .prepare(
          "UPDATE editorial_state SET lease_owner='commissioning:same-planning:original',lease_until=?",
        )
        .run(now + 60000);
      expect(await replenishTopics(env, 'same-planning')).toMatchObject({
        status: 'busy',
        id: 'same-planning',
      });
      const row = sql
        .prepare("SELECT status,receipt_json FROM editorial_commissioning_runs WHERE id='same-planning'")
        .get();
      expect(row?.status).toBe(rowExists ? 'started' : undefined);
      expect(row?.receipt_json).toBe(rowExists ? null : undefined);
      expect(sql.prepare('SELECT lease_owner FROM editorial_state').get()?.lease_owner).toBe(
        'commissioning:same-planning:original',
      );
    },
  );
  it('records a lease race without consuming model budget or releasing the other writer, then retries in a fresh instance', async () => {
    let time = now;
    vi.spyOn(Date, 'now').mockImplementation(() => time);
    const { env, sql } = database();
    env.EDITORIAL_ENABLED = 'true';
    const createBatch = vi
      .fn()
      .mockImplementation(async (batch: { id: string }[]) => batch.map(({ id }) => ({ id })));
    env.EDITORIAL_WORKFLOW = { createBatch } as unknown as typeof env.EDITORIAL_WORKFLOW;
    await seedEditorial(env);
    const first = await dispatchTopicPlanning(env, time);
    expect(first.status).toBe('queued');
    sql
      .prepare("UPDATE editorial_state SET lease_owner='active-content',lease_until=? WHERE id=1")
      .run(time + 5 * 60000);
    const busy = await replenishTopics(env, first.id!);
    expect(busy).toMatchObject({ status: 'blocked', error: 'editorial_busy' });
    expect(sql.prepare('SELECT lease_owner FROM editorial_state').get()?.lease_owner).toBe('active-content');
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_daily_budgets').get()?.n).toBe(0);
    sql.prepare("UPDATE editorial_state SET lease_owner='',lease_until=0").run();
    time += 5 * 60000;
    expect((await dispatchTopicPlanning(env, time)).status).toBe('cooldown');
    time += 11 * 60000;
    const resumed = await dispatchTopicPlanning(env, time);
    expect(resumed.status).toBe('queued');
    expect(resumed.id).not.toBe(first.id);
    expect(resumed.id).toContain('-16-15-v4');
    expect(createBatch).toHaveBeenCalledTimes(2);
    expect(commissioningCoolingDown(now, COMMISSIONING_POLICY, 10, time)).toBe(true);
  });
  it('does not call a skipped existing Workflow a newly queued run', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { env } = database();
    env.EDITORIAL_ENABLED = 'true';
    env.EDITORIAL_WORKFLOW = {
      createBatch: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ status: async () => ({ status: 'errored' }) }),
    } as unknown as typeof env.EDITORIAL_WORKFLOW;
    expect(await dispatchTopicPlanning(env, now)).toMatchObject({
      status: 'existing_instance',
      workflowStatus: 'errored',
    });
  });
  it('keeps immutable growth snapshots for changed failures while deduplicating the same evidence', async () => {
    let time = now;
    vi.spyOn(Date, 'now').mockImplementation(() => time);
    const { env, sql } = database();
    await seedEditorial(env);
    const first = await recordEditorialGrowthReview(env);
    time += 60000;
    expect((await recordEditorialGrowthReview(env)).status).toBe('already_recorded');
    sql
      .prepare(
        "INSERT INTO editorial_runs(id,slot,status,error_code,created_at,updated_at) VALUES('fresh-failure','2026-10-25-09','blocked','quality_gate:new defect',?,?)",
      )
      .run(time, time);
    const second = await recordEditorialGrowthReview(env);
    expect(second.id).not.toBe(first.id);
    const snapshots = sql
      .prepare(
        "SELECT evidence_json FROM editorial_observations WHERE kind='growth_review' ORDER BY checked_at",
      )
      .all();
    expect(snapshots).toHaveLength(2);
    expect(JSON.parse(snapshots[0].evidence_json as string).operationalTasks.repairFeedback).toHaveLength(0);
    expect(
      JSON.parse(snapshots[1].evidence_json as string).operationalTasks.repairFeedback[0].error,
    ).toContain('new defect');
    expect((await recordEditorialGrowthReview(env)).status).toBe('already_recorded');
  });
});
