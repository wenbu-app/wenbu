import {
  ACCOUNT_BYTES,
  RECORD_BYTES,
  TRANSFER_BYTES,
  journalRecord,
  sessionRecord,
  type CloudRecord,
  type RecordKind,
} from '../src/lib/account-protocol';
import { AccountError, canonical, hmac } from './account-security';
import { privacyLedger } from './account-auth';
import type { Env } from './types';

type Row = {
  owner: string;
  kind: RecordKind;
  id: string;
  content: string;
  hash: string;
  bytes: number;
  revision: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  provenance: string;
};
export function recordPayload(kind: RecordKind, value: unknown) {
  const parsed = kind === 'journal' ? journalRecord.parse(value) : sessionRecord.parse(value);
  const full = canonical(parsed),
    bytes = new TextEncoder().encode(full).length;
  if (bytes > TRANSFER_BYTES - 8192) throw new AccountError(413, 'record_too_large');
  const { messages, ...metadata } =
    kind === 'session'
      ? (parsed as ReturnType<typeof sessionRecord.parse>)
      : { ...parsed, messages: undefined };
  const content = canonical(metadata),
    parts = (messages || []).map(canonical);
  if ([content, ...parts].some((v) => new TextEncoder().encode(v).length > RECORD_BYTES))
    throw new AccountError(413, 'record_too_large');
  return { parsed, full, bytes, content, parts };
}
export async function getRecord(
  env: Env,
  owner: string,
  kind: RecordKind,
  id: string,
): Promise<CloudRecord | null> {
  const snapshot = await env.USERDATA!.batch([
    env
      .USERDATA!.prepare('SELECT * FROM wb_records WHERE owner=? AND kind=? AND id=? AND deleted_at IS NULL')
      .bind(owner, kind, id),
    env
      .USERDATA!.prepare(
        'SELECT content FROM wb_record_parts WHERE owner=? AND kind=? AND id=? ORDER BY position',
      )
      .bind(owner, kind, id),
  ]);
  const row = snapshot[0].results[0] as Row | undefined;
  if (!row) return null;
  const blocked = (await (await privacyLedger(env, owner)).state()).blocked;
  if (blocked.includes('account') || blocked.includes(kind + ':' + id)) return null;
  const content = JSON.parse(row.content);
  if (kind === 'session')
    content.messages = snapshot[1].results.map((p) => JSON.parse((p as { content: string }).content));
  return { kind, id, content, revision: row.revision, updatedAt: row.updated_at, provenance: row.provenance };
}
export async function listRecords(env: Env, owner: string, cursor?: string | null) {
  const { blocked } = await (await privacyLedger(env, owner)).state();
  if (blocked.includes('account')) throw new AccountError(401, 'account_deleted');
  let after: { at: number; kind: RecordKind; id: string } | undefined;
  if (cursor) {
    try {
      after = JSON.parse(atob(cursor));
    } catch {
      throw new AccountError(422, 'invalid_cursor');
    }
    if (
      !after ||
      !Number.isSafeInteger(after.at) ||
      !['journal', 'session'].includes(after.kind) ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(after.id)
    )
      throw new AccountError(422, 'invalid_cursor');
  }
  const where = after ? ' AND (updated_at<? OR (updated_at=? AND (kind>? OR (kind=? AND id>?))))' : '';
  const args: (string | number)[] = [owner];
  if (after) args.push(after.at, after.at, after.kind, after.kind, after.id);
  const rows = (
    await env
      .USERDATA!.prepare(
        'SELECT kind,id,revision,updated_at,bytes,provenance FROM wb_records WHERE owner=? AND deleted_at IS NULL' +
          where +
          ' ORDER BY updated_at DESC,kind,id LIMIT 51',
      )
      .bind(...args)
      .all<{
        kind: RecordKind;
        id: string;
        revision: number;
        updated_at: number;
        bytes: number;
        provenance: string;
      }>()
  ).results;
  const page = rows.slice(0, 50),
    last = page.at(-1);
  return {
    records: page
      .filter((r) => !blocked.includes(r.kind + ':' + r.id))
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        revision: r.revision,
        updatedAt: r.updated_at,
        bytes: r.bytes,
        provenance: r.provenance,
      })),
    nextCursor:
      rows.length > 50 && last
        ? btoa(JSON.stringify({ at: last.updated_at, kind: last.kind, id: last.id }))
        : null,
  };
}
export async function putRecord(
  env: Env,
  owner: string,
  kind: RecordKind,
  id: string,
  input: { requestId: string; revision: number; content: unknown; source: 'current' | 'legacy' },
  provenance = 'user_data',
) {
  const payload = recordPayload(kind, input.content);
  if (payload.parsed.id !== id) throw new AccountError(422, 'record_id_mismatch');
  const blocked = (await (await privacyLedger(env, owner)).state()).blocked;
  if (blocked.includes('account')) throw new AccountError(401, 'account_deleted');
  if (blocked.includes(kind + ':' + id)) throw new AccountError(410, 'record_deleted');
  const db = env.USERDATA!,
    hash = await hmac(env.ACCOUNT_DATA_KEY!, payload.full),
    now = Date.now();
  const prior = await db
    .prepare('SELECT kind,record_id,hash,revision FROM wb_mutations WHERE owner=? AND request_id=?')
    .bind(owner, input.requestId)
    .first<{ kind: string; record_id: string; hash: string; revision: number }>();
  if (prior) {
    if (prior.hash !== hash || prior.kind !== kind || prior.record_id !== id)
      throw new AccountError(409, 'idempotency_conflict');
    return { id, kind, revision: prior.revision, replayed: true };
  }
  const current = await db
    .prepare('SELECT revision,hash,deleted_at FROM wb_records WHERE owner=? AND kind=? AND id=?')
    .bind(owner, kind, id)
    .first<{ revision: number; hash: string; deleted_at: number | null }>();
  if (current?.deleted_at) throw new AccountError(410, 'record_deleted');
  if (current?.hash === hash) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO wb_mutations(owner,request_id,kind,record_id,hash,revision,delta,applied,created_at) SELECT ?,?,?,?,?,?,0,1,? WHERE EXISTS(SELECT 1 FROM wb_records WHERE owner=? AND kind=? AND id=? AND hash=? AND revision=? AND deleted_at IS NULL)',
      )
      .bind(
        owner,
        input.requestId,
        kind,
        id,
        hash,
        current.revision,
        now,
        owner,
        kind,
        id,
        hash,
        current.revision,
      )
      .run();
    const replay = await db
      .prepare('SELECT hash,kind,record_id,revision FROM wb_mutations WHERE owner=? AND request_id=?')
      .bind(owner, input.requestId)
      .first<{ hash: string; kind: string; record_id: string; revision: number }>();
    if (!replay) throw new AccountError(409, 'revision_conflict');
    if (replay.hash !== hash || replay.kind !== kind || replay.record_id !== id)
      throw new AccountError(409, 'idempotency_conflict');
    return { id, kind, revision: replay.revision, replayed: true };
  }
  if ((current?.revision || 0) !== input.revision)
    throw new AccountError(409, 'revision_conflict', { revision: current?.revision || 0 });
  // The first conditional insert is a transaction guard. Every later statement is
  // conditional on this mutation, so a competing revision cannot partially write.
  const guard = 'EXISTS (SELECT 1 FROM wb_mutations WHERE owner=? AND request_id=? AND applied=0)';
  const statements = [
    db
      .prepare(
        `INSERT OR IGNORE INTO wb_mutations(owner,request_id,kind,record_id,hash,revision,delta,created_at)
    SELECT ?,?,?,?,?,?,?-COALESCE((SELECT bytes FROM wb_records WHERE owner=? AND kind=? AND id=?),0),?
    WHERE EXISTS(SELECT 1 FROM wb_accounts WHERE user_id=? AND status='active' AND cloud_history=1 AND storage_bytes+?-COALESCE((SELECT bytes FROM wb_records WHERE owner=? AND kind=? AND id=?),0)<=?)
    AND COALESCE((SELECT revision FROM wb_records WHERE owner=? AND kind=? AND id=?),0)=?
    AND NOT EXISTS(SELECT 1 FROM wb_records WHERE owner=? AND kind=? AND id=? AND deleted_at IS NOT NULL)`,
      )
      .bind(
        owner,
        input.requestId,
        kind,
        id,
        hash,
        input.revision + 1,
        payload.bytes,
        owner,
        kind,
        id,
        now,
        owner,
        payload.bytes,
        owner,
        kind,
        id,
        ACCOUNT_BYTES,
        owner,
        kind,
        id,
        input.revision,
        owner,
        kind,
        id,
      ),
    db
      .prepare(
        `INSERT INTO wb_records(owner,kind,id,content,hash,bytes,revision,created_at,updated_at,provenance) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}
      ON CONFLICT(owner,kind,id) DO UPDATE SET content=excluded.content,hash=excluded.hash,bytes=excluded.bytes,revision=excluded.revision,updated_at=excluded.updated_at,provenance=CASE WHEN wb_records.provenance='verified_operation' THEN wb_records.provenance ELSE excluded.provenance END`,
      )
      .bind(
        owner,
        kind,
        id,
        payload.content,
        hash,
        payload.bytes,
        input.revision + 1,
        now,
        now,
        provenance,
        owner,
        input.requestId,
      ),
    db
      .prepare(`DELETE FROM wb_record_parts WHERE owner=? AND kind=? AND id=? AND ${guard}`)
      .bind(owner, kind, id, owner, input.requestId),
    ...payload.parts.map((part, position) =>
      db
        .prepare(
          `INSERT INTO wb_record_parts(owner,kind,id,position,content) SELECT ?,?,?,?,? WHERE ${guard}`,
        )
        .bind(owner, kind, id, position, part, owner, input.requestId),
    ),
    db
      .prepare(
        `UPDATE wb_accounts SET storage_bytes=storage_bytes+(SELECT delta FROM wb_mutations WHERE owner=? AND request_id=?) WHERE user_id=? AND ${guard}`,
      )
      .bind(owner, input.requestId, owner, owner, input.requestId),
    db
      .prepare('UPDATE wb_mutations SET applied=1 WHERE owner=? AND request_id=? AND applied=0')
      .bind(owner, input.requestId),
  ];
  const result = await db.batch(statements);
  if (!result[0].meta.changes) {
    const replay = await db
      .prepare(
        'SELECT hash,kind,record_id,revision FROM wb_mutations WHERE owner=? AND request_id=? AND applied=1',
      )
      .bind(owner, input.requestId)
      .first<{ hash: string; kind: string; record_id: string; revision: number }>();
    if (replay) {
      if (replay.hash !== hash || replay.kind !== kind || replay.record_id !== id)
        throw new AccountError(409, 'idempotency_conflict');
      return { id, kind, revision: replay.revision, replayed: true };
    }
    const row = await db
      .prepare('SELECT storage_bytes,cloud_history,status FROM wb_accounts WHERE user_id=?')
      .bind(owner)
      .first<{ storage_bytes: number; cloud_history: number; status: string }>();
    if (!row || row.status !== 'active') throw new AccountError(401, 'account_deleted');
    if (!row.cloud_history) throw new AccountError(409, 'cloud_history_paused');
    const latest = await db
      .prepare('SELECT revision,deleted_at FROM wb_records WHERE owner=? AND kind=? AND id=?')
      .bind(owner, kind, id)
      .first<{ revision: number; deleted_at: number | null }>();
    if (latest?.deleted_at) throw new AccountError(410, 'record_deleted');
    if ((latest?.revision || 0) !== input.revision)
      throw new AccountError(409, 'revision_conflict', { revision: latest?.revision || 0 });
    throw new AccountError(413, 'account_storage_full');
  }
  // A deletion intent can arrive during the D1 transaction. Never acknowledge
  // the racing upload as saved; the durable tombstone also masks all reads.
  const after = (await (await privacyLedger(env, owner)).state()).blocked;
  if (after.includes('account') || after.includes(kind + ':' + id)) {
    await eraseRecord(env, owner, kind, id);
    throw new AccountError(410, 'record_deleted');
  }
  return { id, kind, revision: input.revision + 1, replayed: false };
}
export async function eraseRecord(env: Env, owner: string, kind: RecordKind, id: string) {
  const db = env.USERDATA!;
  await db.batch([
    db
      .prepare(
        'UPDATE wb_accounts SET storage_bytes=MAX(0,storage_bytes-COALESCE((SELECT bytes FROM wb_records WHERE owner=? AND kind=? AND id=?),0)) WHERE user_id=?',
      )
      .bind(owner, kind, id, owner),
    db.prepare('DELETE FROM wb_record_parts WHERE owner=? AND kind=? AND id=?').bind(owner, kind, id),
    db
      .prepare(
        `INSERT INTO wb_records(owner,kind,id,content,hash,bytes,revision,created_at,updated_at,deleted_at,provenance) VALUES(?,?,?,'{}','',0,1,?,?,?,'deleted') ON CONFLICT(owner,kind,id) DO UPDATE SET content='{}',hash='',bytes=0,revision=revision+1,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`,
      )
      .bind(owner, kind, id, Date.now(), Date.now(), Date.now()),
    db.prepare('DELETE FROM wb_mutations WHERE owner=? AND kind=? AND record_id=?').bind(owner, kind, id),
  ]);
}
export async function deleteRecord(env: Env, owner: string, kind: RecordKind, id: string) {
  await (await privacyLedger(env, owner)).block(kind + ':' + id, owner);
  await eraseRecord(env, owner, kind, id);
}
export async function eraseAccount(env: Env, owner: string) {
  const db = env.USERDATA!;
  const user = await db.prepare('SELECT email FROM user WHERE id=?').bind(owner).first<{ email: string }>();
  await db.batch([
    db.prepare("UPDATE wb_accounts SET status='deleted',cloud_history=0 WHERE user_id=?").bind(owner),
    // Remove outstanding codes for this exact mailbox before deleting identity.
    db
      .prepare('DELETE FROM verification WHERE identifier IN (?,?)')
      .bind('sign-in-otp-' + (user?.email || ''), 'email-verification-otp-' + (user?.email || '')),
    db.prepare('DELETE FROM user WHERE id=?').bind(owner),
  ]);
}
