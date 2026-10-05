import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { DeletionLedger } from '../worker/deletion-ledger';
import { eraseAccount, eraseRecord } from '../worker/account-records';
import type { Env } from '../worker/types';
vi.mock('../worker/account-records', () => ({ eraseAccount: vi.fn(), eraseRecord: vi.fn() }));
let db: DatabaseSync, ledger: DeletionLedger, alarm: number, metadata: Map<string, unknown>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T00:00:00Z'));
  vi.clearAllMocks();
  db = new DatabaseSync(':memory:');
  metadata = new Map();
  ledger = new DeletionLedger(
    {
      storage: {
        sql: { exec: (sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) },
        get: async (key: string) => metadata.get(key),
        put: async (key: string, value: unknown) => {
          metadata.set(key, value);
        },
        delete: async (key: string) => metadata.delete(key),
        setAlarm: async (value: number) => {
          alarm = value;
        },
      },
    } as unknown as DurableObjectState,
    {
      USERDATA: { prepare: () => ({ bind: () => ({ first: async () => ({ id: 'owner' }) }) }) },
    } as unknown as Env,
  );
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('a failed physical erasure stays blocked and is retried beyond nominal retention', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await ledger.block('account', 'owner');
  vi.mocked(eraseAccount).mockRejectedValueOnce(new Error('D1 unavailable'));
  await ledger.alarm();
  expect(ledger.state().blocked).toContain('account');
  expect(alarm).toBe(Date.now() + 60000);
  vi.setSystemTime(Date.now() + 46 * 86400000);
  expect(ledger.state().blocked).toContain('account');
  await ledger.alarm();
  expect(eraseAccount).toHaveBeenCalledTimes(2);
  expect(ledger.state().blocked).toEqual([]);
});
it('record erasure preserves a successful tombstone for the backup window', async () => {
  await ledger.block('journal:example', 'owner');
  await ledger.alarm();
  expect(eraseRecord).toHaveBeenCalledWith(expect.anything(), 'owner', 'journal', 'example');
  expect(ledger.state().blocked).toEqual(['journal:example']);
  expect(alarm).toBe(Date.now() + 45 * 86400000);
  vi.setSystemTime(Date.now() + 46 * 86400000);
  await ledger.alarm();
  expect(ledger.state().blocked).toEqual([]);
  expect(metadata.has('owner')).toBe(false);
});
it('one deletion ledger cannot accept a different owner', async () => {
  await ledger.block('account', 'owner');
  await expect(ledger.block('account', 'different')).rejects.toThrow('Deletion owner mismatch');
});
