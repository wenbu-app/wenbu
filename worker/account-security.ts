import type { Env } from './types';

export class AccountError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}
export const DAY = 86400000;
export const privateHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  Vary: 'Cookie, Origin',
};
export function accountJson(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: { ...privateHeaders, ...Object.fromEntries(new Headers(headers)) },
  });
}
export function accountsReady(env: Env) {
  return (
    env.ACCOUNTS_ENABLED === 'true' &&
    !!env.USERDATA &&
    !!env.AUTH_SECRET &&
    !!env.ACCOUNT_DATA_KEY &&
    !!env.PRIVACY_LEDGER
  );
}
export function requireAccounts(env: Env) {
  if (!accountsReady(env)) throw new AccountError(503, 'accounts_unavailable');
  if (env.ACCOUNTS_MAINTENANCE === 'true') throw new AccountError(503, 'accounts_maintenance');
}
export function requirePrivateOrigin(request: Request, env: Env) {
  const origin = new URL(env.SITE_URL).origin;
  if (new URL(request.url).origin !== origin || request.headers.get('Origin') !== origin)
    throw new AccountError(403, 'origin_denied');
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new AccountError(403, 'origin_denied');
}
export async function readAccountBody(request: Request, limit = 1024 * 1024): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
    throw new AccountError(415, 'content_type');
  if (Number(request.headers.get('Content-Length') || 0) > limit)
    throw new AccountError(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError(400, 'missing_body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new AccountError(413, 'body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AccountError(400, 'invalid_json');
  }
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
      .join(',') +
    '}'
  );
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function cookieValue(request: Request, name: string) {
  return (request.headers.get('Cookie') || '')
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))
    ?.slice(name.length + 1);
}
export async function signedToken(env: Env, purpose: string, value: object) {
  const json = canonical(value);
  const bytes = new TextEncoder().encode(json);
  const payload = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return payload + '.' + (await hmac(env.AUTH_SECRET!, purpose + ':' + payload));
}
export async function readToken<T>(env: Env, purpose: string, token: string | undefined): Promise<T | null> {
  if (!token || token.length > 3000 || !env.AUTH_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  const expected = await hmac(env.AUTH_SECRET, purpose + ':' + parts[0]);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (difference) return null;
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(parts[0].replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0)),
      ),
    ) as T;
  } catch {
    return null;
  }
}
export type Guest = { id: string; expires: number };
export const guestCookie = (env: Env) =>
  env.SITE_URL.startsWith('https:') ? '__Host-wenbu_guest' : 'wenbu_guest';
export async function readGuest(request: Request, env: Env) {
  const guest = await readToken<Guest>(env, 'guest-v1', cookieValue(request, guestCookie(env)));
  return guest &&
    /^[a-f0-9-]{36}$/.test(guest.id) &&
    guest.expires > Date.now() &&
    guest.expires <= Date.now() + 8 * DAY
    ? guest
    : null;
}
export async function issueGuest(env: Env) {
  const guest: Guest = { id: crypto.randomUUID(), expires: Date.now() + 7 * DAY };
  const cookie = `${guestCookie(env)}=${await signedToken(env, 'guest-v1', guest)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${env.SITE_URL.startsWith('https:') ? '; Secure' : ''}`;
  return { guest, cookie };
}
export function shanghaiDay(time = Date.now()) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10);
}
