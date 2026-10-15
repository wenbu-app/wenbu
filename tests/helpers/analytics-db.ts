import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { Env } from '../../worker/types';
export function database() {
  const sql = new DatabaseSync(':memory:');
  const root = new URL('../../migrations/', import.meta.url);
  for (const name of readdirSync(root)
    .filter((p) => p.endsWith('.sql'))
    .sort())
    sql.exec(readFileSync(new URL(name, root), 'utf8'));
  const prepare = (query: string, args: (string | number | null)[] = []) => ({
    bind: (...values: (string | number | null)[]) => prepare(query, values),
    all: async () => ({ results: sql.prepare(query).all(...args), success: true, meta: { changes: 0 } }),
    first: async () => sql.prepare(query).get(...args) ?? null,
    run: async () => ({
      results: [],
      success: true,
      meta: { changes: Number(sql.prepare(query).run(...args).changes) },
    }),
    query,
  });
  const binding = {
    prepare,
    batch: async (items: ReturnType<typeof prepare>[]) => {
      sql.exec('BEGIN');
      try {
        const result = [];
        for (const item of items)
          result.push(await (/^(SELECT|WITH)/i.test(item.query.trim()) ? item.all() : item.run()));
        sql.exec('COMMIT');
        return result;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return {
    sql,
    env: { ANALYTICS: binding, ANALYTICS_ADMIN_TOKEN: 'test-only-private-admin' } as unknown as Env,
  };
}
