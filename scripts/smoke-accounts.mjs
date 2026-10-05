// Live, content-free checks. No email is sent and no account is created.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.WENBU_URL || 'https://wenbu.app';
const evidence = {
  base,
  checkedAt: new Date().toISOString(),
  mailSent: false,
  accountCreated: false,
  checks: [],
};
async function call(path, expected, options = {}) {
  const r = await fetch(base + path, {
    ...options,
    headers: { 'X-Wenbu-Test': 'true', DNT: '1', 'X-Wenbu-Analytics': 'off', ...options.headers },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(r.status, expected, path);
  assert.match(r.headers.get('cache-control') || '', /no-store/);
  assert.match(r.headers.get('x-robots-tag') || '', /noindex/);
  evidence.checks.push({ path: path.split('?')[0], status: r.status });
  return r;
}
const profile = await (await call('/api/account', 200)).json();
assert.equal(profile.enabled, true);
assert.equal(profile.user, null);
for (const path of ['/api/account/records', '/api/account/export', '/api/admin/accounts/analytics'])
  await call(path, 401);
await call('/api/auth/get-session', 404);
await call('/api/auth/email-otp/send-verification-otp', 403, {
  method: 'POST',
  headers: { Origin: 'https://invalid.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'never-send@example.invalid', type: 'sign-in' }),
});
await call('/api/auth/email-otp/send-verification-otp', 422, {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', type: 'sign-in' }),
});
const draw = await call('/api/v1/tarot', 200, {
  method: 'POST',
  headers: { Origin: base, 'Content-Type': 'application/json', 'X-Wenbu-Request-Id': crypto.randomUUID() },
  body: JSON.stringify({ count: 1, reversals: false, locale: 'en' }),
});
assert.ok(draw.headers.get('x-wenbu-receipt'));
assert.match(draw.headers.get('set-cookie') || '', /HttpOnly/);
assert.match(draw.headers.get('set-cookie') || '', /Secure/);
assert.equal((await draw.json()).cards.length, 1);
const token = (
  process.env.WENBU_ANALYTICS_ADMIN_TOKEN || (await readFile('.analytics-admin-token', 'utf8'))
).trim();
for (const days of [1, 3, 7, 14, 30]) {
  const r = await call(`/api/admin/accounts/analytics?days=${days}`, 200, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    data = await r.json();
  assert.equal(data.available, true);
  assert.equal(data.version, 'account-v2');
  assert.equal(data.days, days);
  assert.equal(data.timezone, 'Asia/Shanghai');
  assert.equal(data.includeTest, false);
  assert.ok(data.totals.activated <= data.totals.measured && data.totals.measured <= data.totals.registered);
  assert.ok(data.cohorts.every((c) => c.returned <= c.eligible));
  assert.ok(data.trial.saved <= data.trial.registered && data.trial.registered <= data.trial.completed);
}
await call('/api/admin/accounts/analytics?days=2', 422, { headers: { Authorization: `Bearer ${token}` } });
evidence.result = 'passed';
await writeFile(
  process.env.WENBU_EVIDENCE || 'docs/reviews/accounts-2026-10-05/live-accounts.json',
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    result: evidence.result,
    checks: evidence.checks.length,
    mailSent: false,
    accountCreated: false,
  }),
);
