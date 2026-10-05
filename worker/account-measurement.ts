import type { Env } from './types';
import { measurement } from './account-auth';
import { hmac, DAY } from './account-security';
export async function accountInstance(env: Env, request: Request, owner: string, allowed: boolean) {
  const raw = request.headers.get('X-Wenbu-Instance');
  if (
    !allowed ||
    !measurement(request).allowed ||
    !raw ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(raw)
  )
    return undefined;
  const instance = await hmac(env.ACCOUNT_DATA_KEY!, 'instance:' + owner + ':' + raw);
  await env
    .USERDATA!.prepare('INSERT OR IGNORE INTO wb_instances(owner,instance,first_seen_at) VALUES(?,?,?)')
    .bind(owner, instance, Date.now())
    .run();
  return instance;
}
export async function trialCompletion(env: Env, subject: string, request: Request) {
  const m = measurement(request);
  if (!m.allowed) return;
  await env
    .USERDATA!.prepare(
      'INSERT OR IGNORE INTO wb_trial_cohorts(guest_hash,first_completed_at,locale,is_test) VALUES(?,?,?,?)',
    )
    .bind(await hmac(env.ACCOUNT_DATA_KEY!, 'trial:' + subject), Date.now(), m.locale, Number(m.test))
    .run();
}
export async function trialRegistration(env: Env, subject: string, owner: string) {
  await env
    .USERDATA!.prepare(
      'UPDATE wb_trial_cohorts SET owner=?,registered_at=(SELECT created_at FROM wb_accounts WHERE user_id=?) WHERE guest_hash=? AND registered_at IS NULL AND EXISTS(SELECT 1 FROM wb_accounts WHERE user_id=? AND analytics_enabled=1 AND created_at>=first_completed_at AND created_at<=first_completed_at+?)',
    )
    .bind(owner, owner, await hmac(env.ACCOUNT_DATA_KEY!, 'trial:' + subject), owner, 7 * DAY)
    .run();
}
export async function recordReadInInstance(
  env: Env,
  owner: string,
  instance: string,
  kind: string,
  id: string,
) {
  await env
    .USERDATA!.prepare(
      'UPDATE wb_instances SET last_record_read_at=? WHERE owner=? AND instance=? AND EXISTS(SELECT 1 FROM wb_records WHERE owner=? AND kind=? AND id=? AND created_at<wb_instances.first_seen_at AND deleted_at IS NULL) AND (SELECT COUNT(*) FROM wb_instances WHERE owner=?)>1',
    )
    .bind(Date.now(), owner, instance, owner, kind, id, owner)
    .run();
}
