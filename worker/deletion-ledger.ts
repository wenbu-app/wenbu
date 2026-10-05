import { DurableObject } from 'cloudflare:workers';
import type { Env } from './types';
import { DAY } from './account-security';
import { eraseAccount, eraseRecord } from './account-records';

// Each instance is named with an HMAC of the owner. It contains no email or content.
// This store is deliberately independent of USERDATA point-in-time restoration.
export class DeletionLedger extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS deletions (target TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, purged INTEGER NOT NULL DEFAULT 0)',
    );
  }
  async block(target: string, owner: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(owner)) throw new Error('Invalid deletion owner');
    const existing = await this.ctx.storage.get<string>('owner');
    if (existing && existing !== owner) throw new Error('Deletion owner mismatch');
    await this.ctx.storage.put('owner', owner);
    if (!/^(account|(?:journal|session):[a-zA-Z0-9_-]{1,80})$/.test(target))
      throw new Error('Invalid deletion target');
    const now = Date.now();
    this.ctx.storage.sql.exec(
      'INSERT INTO deletions(target,deleted_at,expires_at) VALUES(?,?,?) ON CONFLICT(target) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at),purged=0',
      target,
      now,
      now + 45 * DAY,
    );
    await this.ctx.storage.setAlarm(now + 60000);
    return { accepted: true };
  }
  state() {
    return {
      blocked: [
        ...this.ctx.storage.sql.exec<{ target: string }>(
          'SELECT target FROM deletions WHERE expires_at>? OR purged=0',
          Date.now(),
        ),
      ].map((r) => r.target),
    };
  }
  async alarm() {
    const owner = await this.ctx.storage.get<string>('owner');
    const pending = [
      ...this.ctx.storage.sql.exec<{ target: string }>('SELECT target FROM deletions WHERE purged=0'),
    ];
    let failed = false;
    for (const { target } of pending) {
      try {
        if (!owner || !this.env.USERDATA) throw new Error('Deletion storage unavailable');
        if (target === 'account') await eraseAccount(this.env, owner);
        else {
          const [kind, id] = target.split(':');
          // An account purge may already have cascaded all records.
          const user = await this.env.USERDATA.prepare('SELECT id FROM user WHERE id=?').bind(owner).first();
          if (user && (kind === 'journal' || kind === 'session'))
            await eraseRecord(this.env, owner, kind, id);
        }
        this.ctx.storage.sql.exec('UPDATE deletions SET purged=1 WHERE target=?', target);
      } catch {
        failed = true;
        console.error('WENBU_DELETION_RETRY_PENDING');
      }
    }
    this.ctx.storage.sql.exec('DELETE FROM deletions WHERE expires_at<=? AND purged=1', Date.now());
    const next = [
      ...this.ctx.storage.sql.exec<{ expiry: number | null }>('SELECT MIN(expires_at) expiry FROM deletions'),
    ][0].expiry;
    if (failed) await this.ctx.storage.setAlarm(Date.now() + 60000);
    else if (next) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
    else await this.ctx.storage.delete('owner');
  }
}
