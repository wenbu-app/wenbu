import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { Env } from './types';
import { contextSchema } from './analytics';
import {
  AccountError,
  accountJson,
  hmac,
  readAccountBody,
  requireAccounts,
  requirePrivateOrigin,
  shanghaiDay,
} from './account-security';

export function measurement(request?: Request) {
  const disabled =
    !request ||
    request.headers.get('DNT') === '1' ||
    request.headers.get('Sec-GPC') === '1' ||
    /(?:^|;\s*)wenbu_analytics=off(?:;|$)/.test(request.headers.get('Cookie') || '');
  let input: unknown;
  try {
    input = JSON.parse(request?.headers.get('X-Wenbu-Analytics') || 'null');
  } catch {
    input = null;
  }
  const parsed = contextSchema.safeParse(input);
  return {
    allowed: !disabled && parsed.success,
    test:
      (parsed.success && parsed.data.test) ||
      /(?:^|;\s*)wenbu_analytics_test=1(?:;|$)/.test(request?.headers.get('Cookie') || ''),
    locale: request?.headers.get('X-Wenbu-Locale') === 'en' ? 'en' : 'zh',
    source: parsed.success ? parsed.data.source : 'unknown',
  };
}
export async function authCount(env: Env, event: string, locale: string, test = false) {
  if (!env.USERDATA) return;
  await env.USERDATA.prepare(
    'INSERT INTO wb_auth_daily(day,event,locale,is_test,count) VALUES(?,?,?,?,1) ON CONFLICT(day,event,locale,is_test) DO UPDATE SET count=count+1',
  )
    .bind(shanghaiDay(), event, locale, Number(test))
    .run()
    .catch(() => console.error('WENBU_AUTH_METRIC_WRITE_FAILED'));
}
const mailOutcome = new AsyncLocalStorage<{ status: 'pending' | 'accepted' | 'failed' | 'unknown' }>();
export const privacyLedger = async (env: Env, userId: string) =>
  env.PRIVACY_LEDGER!.get(
    env.PRIVACY_LEDGER!.idFromName(await hmac(env.ACCOUNT_DATA_KEY!, 'deletion-owner:' + userId)),
  );
const authCache = new WeakMap<Env, ReturnType<typeof createAccountAuth>>();
export function accountAuth(env: Env) {
  const cached = authCache.get(env);
  if (cached) return cached;
  const auth = createAccountAuth(env);
  authCache.set(env, auth);
  return auth;
}
function createAccountAuth(env: Env) {
  if (!env.USERDATA || !env.AUTH_SECRET) throw new AccountError(503, 'accounts_unavailable');
  const auth = betterAuth({
    appName: 'Wenbu · 问卜',
    database: env.USERDATA,
    baseURL: env.SITE_URL,
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.SITE_URL],
    telemetry: { enabled: false },
    logger: { disabled: true },
    session: { expiresIn: 30 * 86400, updateAge: 86400, freshAge: 600, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: env.SITE_URL.startsWith('https:'),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      cookiePrefix: 'wenbu',
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 50,
      customStorage: {
        async consume(key, rule) {
          const result = await env.QUOTA.get(env.QUOTA.idFromName('global')).consumeAuth([
            { key: await hmac(env.AUTH_SECRET!, 'auth-rate:' + key), window: rule.window, max: rule.max },
          ]);
          return { allowed: result.allowed, retryAfter: result.retryAfter };
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (data) => {
            const blocked = (await (await privacyLedger(env, data.userId)).state()).blocked;
            if (blocked.includes('account')) return false;
            return { data: { ...data, ipAddress: '', userAgent: '' } };
          },
        },
        update: { before: async (data) => ({ data: { ...data, ipAddress: '', userAgent: '' } }) },
      },
      user: {
        create: {
          after: async (user, ctx) => {
            const m = measurement(ctx?.request);
            await env
              .USERDATA!.prepare(
                'INSERT OR IGNORE INTO wb_accounts(user_id,created_at,locale,analytics_enabled,is_test,source) VALUES(?,?,?,?,?,?)',
              )
              .bind(
                user.id,
                new Date(user.createdAt).getTime(),
                m.locale,
                Number(m.allowed),
                Number(m.test),
                m.source,
              )
              .run();
            await authCount(env, 'account_created', m.locale, m.test);
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        rateLimit: { window: 60, max: 20 },
        storeOTP: 'encrypted',
        resendStrategy: 'rotate',
        async sendVerificationOTP({ email, otp }, ctx) {
          const m = measurement(ctx?.request);
          if (!env.AUTH_EMAIL)
            throw new APIError('SERVICE_UNAVAILABLE', {
              code: 'EMAIL_UNAVAILABLE',
              message: 'Email is temporarily unavailable.',
            });
          const zh = m.locale === 'zh';
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              env.AUTH_EMAIL.send({
                from: { email: env.AUTH_EMAIL_FROM || 'login@wenbu.app', name: 'Wenbu · 问卜' },
                to: email,
                subject: zh ? '你的问卜登录验证码' : 'Your Wenbu sign-in code',
                text: zh
                  ? `你的问卜验证码：${otp}\n\n5 分钟内有效。请在 wenbu.app 原页面输入。请勿分享给他人。\n如果不是你发起的请求，忽略这封邮件即可。\nWenbu · 问卜`
                  : `Your Wenbu code: ${otp}\n\nValid for 5 minutes. Enter it on wenbu.app. Do not share this code.\nIf you didn't request it, you can ignore this email.\nWenbu`,
                html: `<div style="font-family:Georgia,serif;background:#f6f3ec;padding:36px;color:#283d34;max-width:480px"><p style="letter-spacing:2px">WENBU · 问卜</p><h1 style="font-size:24px;font-weight:400">${zh ? '从这里继续你的探索' : 'Pick up your exploration'}</h1><p>${zh ? '请在原页面输入以下验证码' : 'Enter this code on your Wenbu page'}</p><p style="font-size:34px;letter-spacing:8px">${otp}</p><p>${zh ? '5 分钟内有效。请勿将验证码分享给他人。' : 'Valid for 5 minutes. Never share this code.'}</p><p style="font-size:13px">${zh ? '如非本人操作，请忽略此邮件。' : 'If you didn’t request this, you can ignore this email.'}</p></div>`,
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('send_unknown')), 12000);
              }),
            ]);
            const outcome = mailOutcome.getStore();
            if (outcome) outcome.status = 'accepted';
            await authCount(env, 'provider_accepted', m.locale, m.test);
          } catch (error) {
            const unknown = error instanceof Error && error.message === 'send_unknown';
            const outcome = mailOutcome.getStore();
            if (outcome) outcome.status = unknown ? 'unknown' : 'failed';
            await authCount(env, unknown ? 'send_unknown' : 'send_failed', m.locale, m.test);
            throw new APIError('SERVICE_UNAVAILABLE', {
              code: unknown ? 'EMAIL_SEND_UNKNOWN' : 'EMAIL_SEND_FAILED',
              message: unknown
                ? 'Sending status is not confirmed.'
                : 'Email could not be sent. Please retry later.',
            });
          } finally {
            if (timer) clearTimeout(timer);
          }
        },
      }),
    ],
  });
  return auth;
}
export async function requireAccount(request: Request, env: Env) {
  requireAccounts(env);
  const session = await accountAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) throw new AccountError(401, 'sign_in_required');
  const ledger = await privacyLedger(env, session.user.id);
  const { blocked } = await ledger.state();
  if (blocked.includes('account')) throw new AccountError(401, 'account_deleted');
  // Recover a successfully verified identity if its first business-row write failed.
  const m = measurement(request);
  await env
    .USERDATA!.prepare(
      'INSERT OR IGNORE INTO wb_accounts(user_id,created_at,locale,analytics_enabled,is_test,source) VALUES(?,?,?,?,?,?)',
    )
    .bind(
      session.user.id,
      new Date(session.user.createdAt).getTime(),
      m.locale,
      Number(m.allowed),
      Number(m.test),
      m.source,
    )
    .run();
  const account = await env
    .USERDATA!.prepare('SELECT * FROM wb_accounts WHERE user_id=? AND status=?')
    .bind(session.user.id, 'active')
    .first<AccountRow>();
  if (!account) throw new AccountError(401, 'account_unavailable');
  return { session, account, ledger, blocked };
}
export type AccountRow = {
  user_id: string;
  created_at: number;
  locale: string;
  analytics_enabled: number;
  is_test: number;
  source: string;
  cloud_history: number;
  storage_bytes: number;
  activated_at: number | null;
  status: string;
};
const methods: Record<string, string> = {
  '/api/auth/email-otp/send-verification-otp': 'POST',
  '/api/auth/sign-in/email-otp': 'POST',
  '/api/auth/sign-out': 'POST',
  '/api/auth/revoke-other-sessions': 'POST',
};
export async function handleAuth(request: Request, env: Env) {
  requireAccounts(env);
  const path = new URL(request.url).pathname;
  if (!methods[path]) return accountJson({ error: { code: 'not_found' } }, 404);
  if (request.method !== methods[path]) return accountJson({ error: { code: 'method_not_allowed' } }, 405);
  if (request.method !== 'GET') requirePrivateOrigin(request, env);
  if (
    request.method === 'POST' &&
    env.SITE_URL.startsWith('https:') &&
    !request.headers.get('CF-Connecting-IP')
  )
    throw new AccountError(503, 'auth_network_unavailable');
  if (request.method === 'POST') {
    const raw = await readAccountBody(request, 4096);
    if (path.endsWith('/send-verification-otp')) {
      const input = z
        .object({ email: z.email().max(254), type: z.literal('sign-in') })
        .strict()
        .parse(raw);
      const email = input.email.trim().toLowerCase();
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip && env.SITE_URL.startsWith('https:')) throw new AccountError(503, 'auth_network_unavailable');
      const key = await hmac(env.AUTH_SECRET!, 'mail:' + email);
      const network = await hmac(env.AUTH_SECRET!, 'mail-network:' + ip);
      const rate = await env.QUOTA.get(env.QUOTA.idFromName('global')).consumeAuth([
        { key: key + ':cooldown', window: 60, max: 1 },
        { key: key + ':hour', window: 3600, max: 6 },
        { key: network, window: 3600, max: 30 },
        { key: 'mail:global', window: 86400, max: Number(env.AUTH_EMAIL_DAILY_LIMIT || '1000') },
      ]);
      if (!rate.allowed)
        return accountJson({ error: { code: 'auth_rate_limited' }, retryAfter: rate.retryAfter }, 429, {
          'Retry-After': String(rate.retryAfter),
        });
      const m = measurement(request);
      await authCount(env, 'code_requested', m.locale, m.test);
    }
    request = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(raw),
    });
  }
  if (path === '/api/auth/sign-out' || path === '/api/auth/revoke-other-sessions') {
    const { session } = await requireAccount(request, env);
    if (request.headers.get('X-Wenbu-Owner') !== session.user.id)
      throw new AccountError(409, 'account_changed');
  }
  const outcome: { status: 'pending' | 'accepted' | 'failed' | 'unknown' } = { status: 'pending' };
  const response = await mailOutcome.run(outcome, () => accountAuth(env).handler(request));
  // Better Auth awaits but intentionally catches email callback errors. Its 200
  // alone is not a delivery-provider acknowledgement; expose the actual outcome.
  if (path.endsWith('/send-verification-otp') && response.ok && outcome.status !== 'accepted')
    return accountJson(
      { error: { code: outcome.status === 'unknown' ? 'EMAIL_SEND_UNKNOWN' : 'EMAIL_SEND_FAILED' } },
      503,
    );
  if (path.endsWith('/sign-in/email-otp') && response.ok) {
    const m = measurement(request);
    await authCount(env, 'email_verified', m.locale, m.test);
  }
  if (response.status === 429)
    return accountJson({ error: { code: 'auth_rate_limited' } }, 429, {
      'Retry-After': response.headers.get('Retry-After') || '60',
    });
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(privateHeadersForAuth())) headers.set(k, v);
  if (path.endsWith('/sign-in/email-otp') && response.ok) {
    const data = (await response.json()) as { user: { id: string; email: string; emailVerified: boolean } };
    // The session secret belongs in the HttpOnly cookie, never in JS-visible JSON.
    return new Response(
      JSON.stringify({
        user: { id: data.user.id, email: data.user.email, emailVerified: data.user.emailVerified },
      }),
      { status: response.status, headers },
    );
  }
  return new Response(response.body, { status: response.status, headers });
}
function privateHeadersForAuth() {
  return {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Cookie, Origin',
  };
}
