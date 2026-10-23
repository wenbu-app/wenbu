import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../worker/index';
import { INDEXNOW_CRON } from '../worker/indexnow';
import { dispatchScheduledIndexNow } from '../worker/scheduled-observability';
import { database } from './helpers/analytics-db';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T14:30:00Z'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('distinguishes an accepted workflow enqueue from a URL notification receipt', async () => {
  const { env, sql } = database();
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const createBatch = vi.fn().mockResolvedValue([]);
  env.INDEXNOW_WORKFLOW = { createBatch } as never;
  const tasks: Promise<unknown>[] = [];
  try {
    await worker.scheduled({ cron: INDEXNOW_CRON, scheduledTime: Date.now() } as ScheduledController, env, {
      waitUntil: (p: Promise<unknown>) => tasks.push(p),
    } as never);
    await Promise.all(tasks);
    expect(createBatch).toHaveBeenCalledTimes(1);
    expect(createBatch).toHaveBeenCalledWith([{ id: 'indexnow-2026-10-17', params: {} }]);
    expect(info.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
      { event: 'wenbu_cron_received', cron: INDEXNOW_CRON, scheduledAt: Date.now() },
      { event: 'indexnow_cron_enqueued', instanceId: 'indexnow-2026-10-17', scheduledAt: Date.now() },
    ]);
  } finally {
    sql.close();
  }
});

it('records a failed asynchronous enqueue once and preserves the rejection without logging its private message', async () => {
  const { env, sql } = database();
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = Object.assign(new Error('Bearer private-value; personal@example.test; private payload'), {
    code: 10400,
  });
  const createBatch = vi.fn().mockRejectedValue(error);
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  env.INDEXNOW_WORKFLOW = { createBatch } as never;
  const tasks: Promise<unknown>[] = [];
  try {
    await worker.scheduled({ cron: INDEXNOW_CRON, scheduledTime: Date.now() } as ScheduledController, env, {
      waitUntil: (p: Promise<unknown>) => tasks.push(p),
    } as never);
    await expect(tasks[0]).rejects.toBe(error);
    expect(createBatch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(logError.mock.calls[0][0])).toEqual({
      event: 'indexnow_cron_dispatch_failed',
      instanceId: 'indexnow-2026-10-17',
      scheduledAt: Date.now(),
      errorName: 'Error',
      errorCode: 10400,
    });
    const logs = JSON.stringify([...info.mock.calls, ...logError.mock.calls]);
    expect(logs).not.toMatch(/private-value|personal@|private payload|Bearer/);
  } finally {
    sql.close();
  }
});

it('labels a guarded inline backoff as a result without sending a notification or clearing the pause', async () => {
  const { env, sql } = database();
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const retryAt = Date.now() + 72 * 3600_000;
  env.SITE_URL = 'https://wenbu.app';
  sql.prepare('UPDATE indexnow_state SET retry_at=?,failures=3').run(retryAt);
  try {
    await dispatchScheduledIndexNow({ cron: INDEXNOW_CRON, scheduledTime: Date.now() }, env);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(info.mock.calls[0][0])).toEqual({
      event: 'indexnow_cron_direct_result',
      scheduledAt: Date.now(),
      status: 'backoff',
      submitted: 0,
    });
    expect(sql.prepare('SELECT retry_at,failures FROM indexnow_state').get()).toEqual({
      retry_at: retryAt,
      failures: 3,
    });
  } finally {
    sql.close();
  }
});
