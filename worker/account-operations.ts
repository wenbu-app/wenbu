import {
  accountsReady,
  AccountError,
  DAY,
  hmac,
  issueGuest,
  readGuest,
  readToken,
  signedToken,
  canonical,
} from './account-security';
import { requireAccount, measurement, type AccountRow } from './account-auth';
import { accountInstance, trialCompletion, trialRegistration } from './account-measurement';
import { identityHash } from './ai';
import type { Env } from './types';
import type { RecordKind } from '../src/lib/account-protocol';

export type Actor = {
  subject: string;
  owner?: string;
  account?: AccountRow;
  guest?: string;
  cookie?: string;
  requestId: string;
  network: string;
  measured: boolean;
  instance?: string;
  request: Request;
};
export async function requestActor(request: Request, env: Env): Promise<Actor | undefined> {
  if (!accountsReady(env)) return;
  // Public CLI/MCP remain anonymous. Private account access is only first party.
  if (request.headers.get('Origin') !== new URL(env.SITE_URL).origin) return;
  let guest = await readGuest(request, env),
    cookie: string | undefined;
  if (!guest) {
    const issued = await issueGuest(env);
    guest = issued.guest;
    cookie = issued.cookie;
  }
  const requestId = request.headers.get('X-Wenbu-Request-Id') || crypto.randomUUID();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))
    throw new AccountError(422, 'invalid_request_id');
  const network = await identityHash(
    request.headers.get('CF-Connecting-IP') || 'local',
    env.QUOTA_SALT || env.ACCOUNT_DATA_KEY!,
  );
  let auth: Awaited<ReturnType<typeof requireAccount>> | undefined;
  try {
    auth = await requireAccount(request, env);
  } catch (error) {
    if (!(error instanceof AccountError && error.code === 'sign_in_required')) throw error;
  }
  if (auth) {
    const expectedOwner = request.headers.get('X-Wenbu-Owner');
    if (expectedOwner && expectedOwner !== auth.session.user.id)
      throw new AccountError(409, 'account_changed');
    const subject = 'account:' + (await hmac(env.ACCOUNT_DATA_KEY!, 'quota:' + auth.session.user.id));
    const claim = await env.QUOTA.get(env.QUOTA.idFromName('global')).claimGuest(subject, guest.id);
    // A shared browser may sign in to a second account. Rotate its guest cookie;
    // never transfer a first account's trial usage or ownership a second time.
    if (!claim.claimed) {
      const issued = await issueGuest(env);
      guest = issued.guest;
      cookie = issued.cookie;
      await env.QUOTA.get(env.QUOTA.idFromName('global')).claimGuest(subject, guest.id);
    }
    return {
      subject,
      owner: auth.session.user.id,
      account: auth.account,
      guest: guest.id,
      cookie,
      requestId,
      network,
      instance: await accountInstance(env, request, auth.session.user.id, !!auth.account.analytics_enabled),
      request,
      measured: measurement(request).allowed && !!auth.account.analytics_enabled,
    };
  }
  if (request.headers.get('X-Wenbu-Owner')) throw new AccountError(401, 'sign_in_required');
  return {
    subject: 'guest:' + guest.id,
    guest: guest.id,
    cookie,
    requestId,
    network,
    request,
    measured: measurement(request).allowed,
  };
}
export async function reserveActor(env: Env, actor: Actor, kind: 'agent' | 'interpret') {
  const quota = await env.QUOTA.get(env.QUOTA.idFromName('global')).reserveAccount({
    subject: actor.subject,
    guest: actor.guest,
    network: actor.network,
    requestId: actor.requestId,
    kind,
  });
  if (!quota.allowed)
    throw new AccountError(
      quota.reason === 'request_already_reserved' ? 409 : 429,
      quota.reason || 'quota_exceeded',
    );
  return quota;
}
type Receipt = {
  subject: string;
  operation: string;
  kind: RecordKind;
  at: number;
  digest: string;
  measured: boolean;
  basis?: 'result' | 'answer';
};
export function receiptValue(kind: RecordKind, value: unknown, basis: 'result' | 'answer' = 'result') {
  const record = value as { result?: unknown; answer?: unknown; messages?: { role: string }[] };
  return kind === 'journal'
    ? record[basis]
    : [...(record.messages || [])].reverse().find((m) => m.role === 'assistant');
}
export async function resultReceipt(
  env: Env,
  actor: Actor,
  kind: RecordKind,
  value: unknown,
  basis: 'result' | 'answer' = 'result',
) {
  const at = Date.now();
  if (actor.owner && actor.measured)
    await env
      .USERDATA!.prepare(
        'INSERT OR IGNORE INTO wb_operations(owner,operation_id,kind,completed_at,cross_instance) VALUES(?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM wb_instances WHERE owner=? AND instance=? AND last_record_read_at>=?) THEN 1 ELSE 0 END)',
      )
      .bind(actor.owner, actor.requestId, kind, at, actor.owner, actor.instance || '', at - DAY)
      .run();
  if (!actor.owner && actor.measured) await trialCompletion(env, actor.subject, actor.request);
  return signedToken(env, 'result-v1', {
    subject: actor.subject,
    operation: actor.requestId,
    kind,
    at,
    measured: actor.measured,
    basis,
    digest: await hmac(env.ACCOUNT_DATA_KEY!, canonical(receiptValue(kind, value, basis))),
  } satisfies Receipt);
}
export async function verifiedReceipt(
  env: Env,
  request: Request,
  owner: string,
  kind: RecordKind,
  content: unknown,
) {
  const receipt = await readToken<Receipt>(env, 'result-v1', (content as { receipt?: string })?.receipt);
  if (
    !receipt ||
    receipt.kind !== kind ||
    !Number.isFinite(receipt.at) ||
    receipt.at > Date.now() + 60000 ||
    receipt.at < Date.now() - 7 * DAY
  )
    return null;
  const subject = 'account:' + (await hmac(env.ACCOUNT_DATA_KEY!, 'quota:' + owner));
  if (receipt.subject !== subject) {
    const guest = await readGuest(request, env);
    if (!guest || receipt.subject !== 'guest:' + guest.id) return null;
    const claim = await env.QUOTA.get(env.QUOTA.idFromName('global')).claimGuest(subject, guest.id);
    if (!claim.claimed) return null;
  }
  if (
    receipt.digest !==
    (await hmac(env.ACCOUNT_DATA_KEY!, canonical(receiptValue(kind, content, receipt.basis))))
  )
    return null;
  return { ...receipt, measured: receipt.measured && measurement(request).allowed };
}
export async function savedOperation(env: Env, owner: string, receipt: Receipt) {
  if (!receipt.measured) return;
  const now = Date.now(),
    db = env.USERDATA!;
  const allowed = await db
    .prepare('SELECT analytics_enabled FROM wb_accounts WHERE user_id=?')
    .bind(owner)
    .first<{ analytics_enabled: number }>();
  if (!allowed?.analytics_enabled) return;
  if (receipt.subject.startsWith('guest:')) {
    await trialRegistration(env, receipt.subject, owner);
    await db
      .prepare(
        'UPDATE wb_trial_cohorts SET saved_at=COALESCE(saved_at,?) WHERE guest_hash=? AND owner=? AND registered_at IS NOT NULL AND ?<=first_completed_at+?',
      )
      .bind(now, await hmac(env.ACCOUNT_DATA_KEY!, 'trial:' + receipt.subject), owner, now, 7 * DAY)
      .run();
  }
  await db.batch([
    db
      .prepare(
        'INSERT INTO wb_operations(owner,operation_id,kind,completed_at,saved_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,operation_id) DO UPDATE SET saved_at=COALESCE(saved_at,excluded.saved_at)',
      )
      .bind(owner, receipt.operation, receipt.kind, receipt.at, now),
    db
      .prepare(
        'UPDATE wb_accounts SET activated_at=? WHERE user_id=? AND analytics_enabled=1 AND activated_at IS NULL AND created_at>=? AND created_at<=? AND ? >=created_at-?',
      )
      .bind(now, owner, now - DAY, now, receipt.at, 7 * DAY),
  ]);
}
