import { z } from 'zod';
import { ACCOUNT_BYTES, recordId, recordKind, saveRecord } from '../src/lib/account-protocol';
import {
  accountJson,
  accountsReady,
  AccountError,
  canonical,
  hmac,
  readAccountBody,
  requirePrivateOrigin,
  guestCookie,
} from './account-security';
import { requireAccount, privacyLedger } from './account-auth';
import { deleteRecord, eraseAccount, getRecord, listRecords, putRecord } from './account-records';
import { requestActor, savedOperation, verifiedReceipt } from './account-operations';
import { accountInstance, recordReadInInstance, trialRegistration } from './account-measurement';
import type { Env } from './types';

export async function handleAccounts(request: Request, env: Env) {
  const path = new URL(request.url).pathname;
  if (request.method !== 'GET') requirePrivateOrigin(request, env);
  if (path === '/api/account' && request.method === 'GET') {
    if (!accountsReady(env)) return accountJson({ enabled: false, user: null });
    try {
      const { session, account } = await requireAccount(request, env);
      await accountInstance(env, request, session.user.id, !!account.analytics_enabled);
      return accountJson({
        enabled: true,
        user: { id: session.user.id, email: session.user.email, createdAt: account.created_at },
        cloudHistory: !!account.cloud_history,
        storage: { used: account.storage_bytes, limit: ACCOUNT_BYTES },
      });
    } catch (error) {
      if (error instanceof AccountError && error.status === 401)
        return accountJson({ enabled: true, user: null });
      throw error;
    }
  }
  const { session, account, ledger } = await requireAccount(request, env),
    owner = session.user.id;
  if (path !== '/api/account/claim' && request.headers.get('X-Wenbu-Owner') !== owner)
    throw new AccountError(409, 'account_changed');
  if (path === '/api/account/claim' && request.method === 'POST') {
    const actor = await requestActor(request, env);
    if (actor?.guest && actor.measured) await trialRegistration(env, 'guest:' + actor.guest, owner);
    return accountJson({ claimed: true }, 200, actor?.cookie ? { 'Set-Cookie': actor.cookie } : undefined);
  }
  if (path === '/api/account/preferences' && request.method === 'PATCH') {
    const input = z
      .object({ cloudHistory: z.boolean().optional(), analyticsEnabled: z.boolean().optional() })
      .strict()
      .parse(await readAccountBody(request, 1024));
    await env
      .USERDATA!.prepare('UPDATE wb_accounts SET cloud_history=?,analytics_enabled=? WHERE user_id=?')
      .bind(
        input.cloudHistory === undefined ? account.cloud_history : Number(input.cloudHistory),
        input.analyticsEnabled === undefined ? account.analytics_enabled : Number(input.analyticsEnabled),
        owner,
      )
      .run();
    return accountJson({ ok: true });
  }
  if (path === '/api/account/records' && request.method === 'GET')
    return accountJson(await listRecords(env, owner, new URL(request.url).searchParams.get('cursor')));
  if (path === '/api/account/export' && request.method === 'GET') {
    const page = await listRecords(env, owner, new URL(request.url).searchParams.get('cursor'));
    return accountJson({
      schema: 'wenbu.account.export.v1',
      createdAt: new Date().toISOString(),
      ...page,
      complete: false,
      instructions:
        'Fetch every listed revision. If any revision changes, restart the export. The manifest alone is not a backup.',
    });
  }
  if (path === '/api/account/delete' && request.method === 'POST') {
    z.object({ confirmation: z.literal('DELETE') })
      .strict()
      .parse(await readAccountBody(request, 512));
    if (Date.now() - new Date(session.session.createdAt).getTime() > 10 * 60000)
      throw new AccountError(403, 'fresh_sign_in_required');
    await ledger.block('account', owner);
    await eraseAccount(env, owner);
    return accountJson({ deleted: true }, 200, {
      'Set-Cookie': `${guestCookie(env)}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${env.SITE_URL.startsWith('https:') ? '; Secure' : ''}`,
    });
  }
  const match = path.match(/^\/api\/account\/records\/(journal|session)\/([a-zA-Z0-9_-]{1,80})$/);
  if (match) {
    const kind = recordKind.parse(match[1]),
      id = recordId.parse(match[2]);
    if (request.method === 'GET') {
      const record = await getRecord(env, owner, kind, id);
      if (!record) throw new AccountError(404, 'record_not_found');
      const instance = await accountInstance(env, request, owner, !!account.analytics_enabled);
      if (instance) await recordReadInInstance(env, owner, instance, kind, id);
      return accountJson(record);
    }
    if (request.method === 'DELETE') {
      await deleteRecord(env, owner, kind, id);
      return accountJson({ deleted: true });
    }
    if (request.method === 'PUT') {
      const input = saveRecord.parse(await readAccountBody(request));
      const db = env.USERDATA!;
      if (input.source === 'legacy') {
        const hash = await hmac(env.ACCOUNT_DATA_KEY!, canonical(input.content));
        const old = await db
          .prepare(
            "SELECT hash,record_id FROM wb_imports WHERE owner=? AND source='browser-v1' AND kind=? AND original_id=?",
          )
          .bind(owner, kind, id)
          .first<{ hash: string; record_id: string }>();
        if (old) {
          if (old.hash !== hash) throw new AccountError(409, 'import_conflict');
          const record = await getRecord(env, owner, kind, old.record_id);
          if (!record) throw new AccountError(410, 'record_deleted');
          return accountJson({ id, kind, revision: record.revision, replayed: true });
        }
        if (input.revision !== 0) throw new AccountError(409, 'import_conflict');
        const saved = await putRecord(env, owner, kind, id, input, 'legacy_import');
        await db
          .prepare(
            "INSERT OR IGNORE INTO wb_imports(owner,source,original_id,kind,hash,record_id) VALUES(?,'browser-v1',?,?,?,?)",
          )
          .bind(owner, id, kind, hash, id)
          .run();
        return accountJson(saved);
      }
      const receipt = await verifiedReceipt(env, request, owner, kind, input.content);
      const saved = await putRecord(
        env,
        owner,
        kind,
        id,
        input,
        receipt ? 'verified_operation' : 'user_data',
      );
      if (receipt) await savedOperation(env, owner, receipt);
      return accountJson(saved);
    }
  }
  return accountJson({ error: { code: 'not_found' } }, 404);
}

// Operator-only recovery: run under the maintenance flag after D1 Time Travel,
// before reopening any account route. The ledger lives outside restored D1.
export async function reconcileDeletionLedger(env: Env) {
  if (env.ACCOUNTS_MAINTENANCE !== 'true') throw new AccountError(409, 'maintenance_required');
  const users = (await env.USERDATA!.prepare('SELECT id FROM user').all<{ id: string }>()).results;
  let accounts = 0,
    records = 0;
  for (const user of users) {
    const blocked = (await (await privacyLedger(env, user.id)).state()).blocked;
    if (blocked.includes('account')) {
      await eraseAccount(env, user.id);
      accounts++;
      continue;
    }
    for (const key of blocked) {
      const [kind, id] = key.split(':');
      if (kind === 'journal' || kind === 'session') {
        await deleteRecord(env, user.id, kind, id);
        records++;
      }
    }
  }
  await env.USERDATA!.batch([
    env.USERDATA!.prepare('DELETE FROM session'),
    env.USERDATA!.prepare('DELETE FROM verification'),
  ]);
  return { accounts, records, sessionsRevoked: true };
}

// Bounded maintenance keeps consumed tokens and retry ledgers from growing forever.
// Record deletion tombstones intentionally survive; they prevent stale uploads.
export async function pruneAccountMetadata(env: Env) {
  if (!accountsReady(env) || env.ACCOUNTS_MAINTENANCE === 'true') return;
  const now = Date.now(),
    db = env.USERDATA!;
  await db.batch([
    db
      .prepare(
        'DELETE FROM verification WHERE id IN (SELECT id FROM verification WHERE expiresAt<? LIMIT 2000)',
      )
      .bind(new Date(now).toISOString()),
    db
      .prepare('DELETE FROM session WHERE id IN (SELECT id FROM session WHERE expiresAt<? LIMIT 2000)')
      .bind(new Date(now).toISOString()),
    db
      .prepare(
        'DELETE FROM wb_mutations WHERE rowid IN (SELECT rowid FROM wb_mutations WHERE created_at<? LIMIT 2000)',
      )
      .bind(now - 90 * 86400000),
    db
      .prepare(
        'DELETE FROM wb_operations WHERE rowid IN (SELECT rowid FROM wb_operations WHERE completed_at<? LIMIT 2000)',
      )
      .bind(now - 90 * 86400000),
    db
      .prepare(
        'DELETE FROM wb_trial_cohorts WHERE guest_hash IN (SELECT guest_hash FROM wb_trial_cohorts WHERE first_completed_at<? LIMIT 2000)',
      )
      .bind(now - 90 * 86400000),
  ]);
}
