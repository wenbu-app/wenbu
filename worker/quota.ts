import { DurableObject } from 'cloudflare:workers';
import type { Env } from './types';
import { DAY, shanghaiDay } from './account-security';

export function positiveLimit(raw: string): number {
  if (!/^[1-9]\d{0,5}$/.test(raw)) throw new Error('Invalid limit configuration');
  return Number(raw);
}
export class UsageGate extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS quota (day TEXT NOT NULL, identity TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day,identity))',
    );
    for (const query of [
      'CREATE TABLE IF NOT EXISTS guest_alias (guest TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS reservations (subject TEXT NOT NULL, request_id TEXT NOT NULL, kind TEXT NOT NULL, remaining INTEGER NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(subject,request_id))',
      'CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)',
    ])
      ctx.storage.sql.exec(query);
  }
  async consumeAuth(rules: { key: string; window: number; max: number }[]) {
    if (
      !rules.length ||
      rules.length > 8 ||
      rules.some(
        (r) =>
          r.key.length > 200 ||
          !Number.isInteger(r.max) ||
          r.max < 1 ||
          r.max > 100000 ||
          !Number.isInteger(r.window) ||
          r.window < 1 ||
          r.window > 86400,
      )
    )
      throw new Error('Invalid auth limit');
    const now = Date.now(),
      sql = this.ctx.storage.sql;
    const result = this.ctx.storage.transactionSync(() => {
      let retryAfter = 0;
      for (const rule of rules) {
        const row = [
          ...sql.exec<{ count: number; expires: number }>(
            'SELECT count,expires FROM auth_limits WHERE key=?',
            rule.key,
          ),
        ][0];
        if (row && row.expires > now && row.count >= rule.max)
          retryAfter = Math.max(retryAfter, Math.ceil((row.expires - now) / 1000));
      }
      if (retryAfter) return { allowed: false, retryAfter };
      for (const rule of rules)
        sql.exec(
          'INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END',
          rule.key,
          now + rule.window * 1000,
          now,
          now,
        );
      return { allowed: true, retryAfter: null };
    });
    await this.scheduleCleanup();
    return result;
  }
  private claimInTransaction(account: string, guest: string) {
    const sql = this.ctx.storage.sql,
      day = shanghaiDay();
    const existing = [
      ...sql.exec<{ account: string }>('SELECT account FROM guest_alias WHERE guest=?', guest),
    ][0];
    if (existing) return existing.account === account;
    sql.exec('INSERT INTO guest_alias VALUES(?,?,?)', guest, account, Date.now() + 8 * DAY);
    sql.exec(
      'INSERT OR IGNORE INTO reservations SELECT ?,request_id,kind,remaining,expires FROM reservations WHERE subject=?',
      account,
      'guest:' + guest,
    );
    for (const prefix of ['', 'agent:']) {
      const old = prefix + 'guest:' + guest,
        target = prefix + account;
      const used =
        [...sql.exec<{ count: number }>('SELECT count FROM quota WHERE day=? AND identity=?', day, old)][0]
          ?.count ?? 0;
      if (used) {
        sql.exec(
          'INSERT INTO quota VALUES(?,?,?) ON CONFLICT(day,identity) DO UPDATE SET count=count+excluded.count',
          day,
          target,
          used,
        );
        sql.exec('DELETE FROM quota WHERE day=? AND identity=?', day, old);
      }
    }
    return true;
  }
  async claimGuest(account: string, guest: string) {
    if (!/^account:[a-f0-9]{64}$/.test(account) || !/^[-a-f0-9]{36}$/.test(guest))
      throw new Error('Invalid quota identity');
    const claimed = this.ctx.storage.transactionSync(() => this.claimInTransaction(account, guest));
    await this.scheduleCleanup();
    return { claimed };
  }
  async reserveAccount(input: {
    subject: string;
    guest?: string;
    network: string;
    requestId: string;
    kind: 'agent' | 'interpret';
  }) {
    if (
      !/^(account:[a-f0-9]{64}|guest:[a-f0-9-]{36})$/.test(input.subject) ||
      !/^[-a-f0-9]{36}$/.test(input.requestId) ||
      !/^[a-f0-9]{64}$/.test(input.network)
    )
      throw new Error('Invalid reservation');
    const now = Date.now(),
      day = shanghaiDay(),
      sql = this.ctx.storage.sql;
    const result = this.ctx.storage.transactionSync(() => {
      sql.exec('DELETE FROM quota WHERE day<>?', day);
      let subject = input.subject;
      if (subject.startsWith('account:') && input.guest && !this.claimInTransaction(subject, input.guest))
        return { allowed: false, remaining: 0, reason: 'guest_already_linked' };
      if (subject.startsWith('guest:'))
        subject =
          [
            ...sql.exec<{ account: string }>(
              'SELECT account FROM guest_alias WHERE guest=?',
              subject.slice(6),
            ),
          ][0]?.account ?? subject;
      // Check the original subject as well: a retry may arrive after its guest was linked.
      const prior = [
        ...sql.exec<{ remaining: number; kind: string }>(
          'SELECT remaining,kind FROM reservations WHERE subject=? AND request_id=?',
          input.subject,
          input.requestId,
        ),
      ][0];
      if (prior) return { allowed: false, remaining: prior.remaining, reason: 'request_already_reserved' };
      const agent = input.kind === 'agent',
        prefix = agent ? 'agent:' : '',
        identity = prefix + subject;
      const count = (key: string) =>
        [...sql.exec<{ count: number }>('SELECT count FROM quota WHERE day=? AND identity=?', day, key)][0]
          ?.count ?? 0;
      const limit = positiveLimit(
        agent ? (this.env.AGENT_PER_USER_DAILY_LIMIT ?? '12') : this.env.AI_PER_USER_DAILY_LIMIT,
      );
      const networkKey = prefix + 'network:' + input.network;
      const networkLimit = positiveLimit(
        agent ? (this.env.AGENT_NETWORK_DAILY_LIMIT ?? '120') : (this.env.AI_NETWORK_DAILY_LIMIT ?? '50'),
      );
      if (count('global') >= positiveLimit(this.env.AI_DAILY_LIMIT))
        return { allowed: false, remaining: 0, reason: 'daily_budget' };
      if (agent && count('agent-global') >= positiveLimit(this.env.AGENT_GLOBAL_DAILY_LIMIT ?? '600'))
        return { allowed: false, remaining: 0, reason: 'agent_budget' };
      if (count(identity) >= limit) return { allowed: false, remaining: 0, reason: 'daily_allowance' };
      if (count(networkKey) >= networkLimit)
        return { allowed: false, remaining: 0, reason: 'network_allowance' };
      const remaining = limit - count(identity) - 1;
      for (const key of ['global', identity, networkKey, ...(agent ? ['agent-global'] : [])])
        sql.exec(
          'INSERT INTO quota VALUES(?,?,1) ON CONFLICT(day,identity) DO UPDATE SET count=count+1',
          day,
          key,
        );
      sql.exec(
        'INSERT INTO reservations VALUES(?,?,?,?,?)',
        input.subject,
        input.requestId,
        input.kind,
        remaining,
        now + 8 * DAY,
      );
      // Preserve idempotency across a guest -> account transition.
      if (subject !== input.subject)
        sql.exec(
          'INSERT OR IGNORE INTO reservations VALUES(?,?,?,?,?)',
          subject,
          input.requestId,
          input.kind,
          remaining,
          now + 8 * DAY,
        );
      return { allowed: true, remaining };
    });
    await this.scheduleCleanup();
    return result;
  }
  private async scheduleCleanup() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + DAY);
  }
  async reserve(identity: string): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    return this.reserveAllowance(identity, 1, positiveLimit(this.env.AI_PER_USER_DAILY_LIMIT));
  }
  async reserveAgent(identity: string): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    return this.reserveAllowance(
      'agent:' + identity,
      1,
      positiveLimit(this.env.AGENT_PER_USER_DAILY_LIMIT ?? '12'),
      true,
    );
  }
  async reserveAgentStep() {
    return this.reserveAllowance(
      'agent-global',
      1,
      positiveLimit(this.env.AGENT_GLOBAL_DAILY_LIMIT ?? '600'),
    );
  }
  private async reserveAllowance(identity: string, units: number, userLimit: number, agentStart = false) {
    const globalLimit = positiveLimit(this.env.AI_DAILY_LIMIT);
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const sql = this.ctx.storage.sql;
    // A synchronous SQLite transaction reserves global AND user allowance. No await inside.
    const result = this.ctx.storage.transactionSync(() => {
      sql.exec('DELETE FROM quota WHERE day <> ?', day);
      const count = (key: string) =>
        Number(
          [...sql.exec<{ count: number }>('SELECT count FROM quota WHERE day=? AND identity=?', day, key)][0]
            ?.count ?? 0,
        );
      const global = count('global');
      const user = count(identity);
      if (agentStart && count('agent-global') >= positiveLimit(this.env.AGENT_GLOBAL_DAILY_LIMIT ?? '600'))
        return { allowed: false, remaining: 0, reason: 'agent_budget' };
      if (global + units > globalLimit) return { allowed: false, remaining: 0, reason: 'daily_budget' };
      if (user >= userLimit) return { allowed: false, remaining: 0, reason: 'daily_allowance' };
      for (const [key, amount] of [
        ['global', units],
        [identity, 1],
      ] as const)
        sql.exec(
          'INSERT INTO quota(day,identity,count) VALUES(?,?,?) ON CONFLICT(day,identity) DO UPDATE SET count=count+excluded.count',
          day,
          key,
          amount,
        );
      if (agentStart)
        sql.exec(
          'INSERT INTO quota(day,identity,count) VALUES(?,?,1) ON CONFLICT(day,identity) DO UPDATE SET count=count+1',
          day,
          'agent-global',
        );
      return { allowed: true, remaining: userLimit - user - 1 };
    });
    // Storage is automatically expired even if traffic never returns. Attempts include failures,
    // because a timed-out upstream request may still incur cost. No unsafe automatic refund.
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 25 * 60 * 60 * 1000);
    return result;
  }
  async alarm() {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    this.ctx.storage.sql.exec('DELETE FROM quota WHERE day <> ?', day);
    this.ctx.storage.sql.exec('DELETE FROM guest_alias WHERE expires<=?', Date.now());
    this.ctx.storage.sql.exec('DELETE FROM reservations WHERE expires<=?', Date.now());
    this.ctx.storage.sql.exec('DELETE FROM auth_limits WHERE expires<=?', Date.now());
    const rows = [...this.ctx.storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM quota')][0]
      .count;
    const extra = [
      ...this.ctx.storage.sql.exec<{ n: number }>(
        'SELECT (SELECT COUNT(*) FROM guest_alias)+(SELECT COUNT(*) FROM reservations)+(SELECT COUNT(*) FROM auth_limits) n',
      ),
    ][0].n;
    if (rows > 0 || extra > 0) await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }
}
