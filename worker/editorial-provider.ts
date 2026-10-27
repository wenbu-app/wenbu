import type { Env } from './types';
import { contentHash } from './editorial-schema';

const balanceInterval = 60 * 60_000;
type ProviderState = {
  status: 'available' | 'blocked';
  reason: string | null;
  http_status: number | null;
  checked_at: number;
  next_check_at: number;
};
export async function editorialProviderStatus(env: Env): Promise<ProviderState> {
  const row = await env
    .ANALYTICS!.prepare(
      'SELECT status,reason,http_status,checked_at,next_check_at FROM editorial_model_provider WHERE id=1',
    )
    .first<ProviderState>();
  if (!row) throw new Error('editorial_provider_state_unavailable');
  return row;
}

// Public conversations share this account with editorial generation. A known
// outage must be checked before a personal/network turn is reserved. This is a
// read of the existing circuit, never another balance or model request.
export async function sharedModelAvailable(env: Env): Promise<boolean> {
  if (env.EDITORIAL_ENABLED !== 'true') return true;
  if (!env.ANALYTICS) return false;
  try {
    return (await editorialProviderStatus(env)).status === 'available';
  } catch {
    return false;
  }
}
async function retainState(
  env: Env,
  status: ProviderState['status'],
  reason: string | null,
  httpStatus: number | null,
  method: 'model_response' | 'balance_get',
  leaseOwner?: string,
) {
  const now = Date.now(),
    next = status === 'blocked' ? now + balanceInterval : 0;
  const evidence = JSON.stringify({
    provider: 'primary',
    status,
    reason,
    httpStatus,
    method,
    checkedAt: new Date(now).toISOString(),
    nextCheckAt: next ? new Date(next).toISOString() : null,
    scope:
      'Shared model-account availability; no credential, account identifier or monetary balance retained.',
  });
  const id = 'model_provider-' + (await contentHash(evidence));
  await env.ANALYTICS!.batch([
    env
      .ANALYTICS!.prepare(
        `INSERT OR IGNORE INTO editorial_observations(id,kind,checked_at,status,evidence_json)
       SELECT ?,'model_provider',?,?,? FROM editorial_model_provider WHERE id=1${leaseOwner ? ' AND lease_owner=?' : ''}`,
      )
      .bind(
        id,
        now,
        status === 'available' ? 'passed' : 'attention',
        evidence,
        ...(leaseOwner ? [leaseOwner] : []),
      ),
    env
      .ANALYTICS!.prepare(
        `UPDATE editorial_model_provider SET status=?,reason=?,http_status=?,checked_at=?,next_check_at=?,lease_owner='',lease_until=0 WHERE id=1${leaseOwner ? ' AND lease_owner=?' : ''}`,
      )
      .bind(status, reason, httpStatus, now, next, ...(leaseOwner ? [leaseOwner] : [])),
  ]);
  return editorialProviderStatus(env);
}
export async function recordEditorialProviderFailure(env: Env, httpStatus: number) {
  if (httpStatus !== 401 && httpStatus !== 402) return;
  await retainState(
    env,
    'blocked',
    httpStatus === 402 ? 'insufficient_balance' : 'authentication',
    httpStatus,
    'model_response',
  );
}

// A shared billing/auth failure must not consume every topic and paid-call
// reservation. Existing cron checks perform one bounded, read-only balance GET
// when due; a positive provider response resumes normal eligible work.
export async function ensureEditorialProvider(env: Env): Promise<ProviderState> {
  const db = env.ANALYTICS!,
    now = Date.now();
  let state = await editorialProviderStatus(env);
  if (!state.checked_at) {
    const failure = await db
      .prepare(
        `SELECT error_code,updated_at FROM editorial_runs
       WHERE error_code IN ('editorial_model_http_401','editorial_model_http_402')
       AND updated_at>COALESCE((SELECT MAX(updated_at) FROM editorial_runs WHERE status='published'),0)
       ORDER BY updated_at DESC LIMIT 1`,
      )
      .first<{ error_code: string; updated_at: number }>();
    if (failure) {
      await db
        .prepare(
          "UPDATE editorial_model_provider SET status='blocked',reason=?,http_status=?,checked_at=?,next_check_at=0 WHERE id=1 AND checked_at=0",
        )
        .bind(
          failure.error_code.endsWith('402') ? 'insufficient_balance' : 'authentication',
          Number(failure.error_code.slice(-3)),
          failure.updated_at,
        )
        .run();
      state = await editorialProviderStatus(env);
    }
  }
  if (state.status === 'available' || state.next_check_at > now) return state;
  const owner = crypto.randomUUID();
  const lease = await db
    .prepare(
      "UPDATE editorial_model_provider SET lease_owner=?,lease_until=? WHERE id=1 AND status='blocked' AND next_check_at<=? AND lease_until<=?",
    )
    .bind(owner, now + 30_000, now, now)
    .run();
  if (!lease.meta.changes) return editorialProviderStatus(env);
  let available: boolean | null = null,
    httpStatus: number | null = null;
  try {
    if (!env.DEEPSEEK_API_KEY) throw new Error('unconfigured');
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, Accept: 'application/json' },
    });
    httpStatus = response.status;
    if (response.ok) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('empty_balance');
      const decoder = new TextDecoder();
      let text = '',
        bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 8192) {
            await reader.cancel();
            throw new Error('large_balance');
          }
          text += decoder.decode(part.value, { stream: true });
        }
        const body = JSON.parse(text + decoder.decode()) as { is_available?: unknown };
        if (typeof body.is_available === 'boolean') available = body.is_available;
      } finally {
        reader.releaseLock();
      }
    } else await response.body?.cancel();
  } catch {
    /* Unknown balance/access is never evidence of availability. */
  }
  return retainState(
    env,
    available === true ? 'available' : 'blocked',
    available === true
      ? null
      : available === false
        ? 'insufficient_balance'
        : httpStatus === 401
          ? 'authentication'
          : 'balance_unavailable',
    httpStatus,
    'balance_get',
    owner,
  );
}

export const permanentEditorialModelError = (code: string) =>
  /^(?:editorial_model_http_(?:400|401|402|422)|editorial_provider_paused|editorial_model_unconfigured)$/.test(
    code,
  );

export function editorialModelFailureCode(message: string) {
  const code = message.replace(/^NonRetryableError: /, '');
  return permanentEditorialModelError(code) ? code : message;
}
