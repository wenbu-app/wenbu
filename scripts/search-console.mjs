import { readFile } from 'node:fs/promises';
const command = process.argv[2] ?? 'status';
if (!['status', 'next', 'seed', 'reconcile', 'claim', 'record', 'inspect'].includes(command))
  throw new Error(
    'Use status, next, seed, reconcile, claim <job-id>, record <receipt.json>, or inspect <observation.json>.',
  );
const statusOnly = ['status', 'next'].includes(command);
const token =
  process.env.WENBU_ADMIN_TOKEN ||
  (
    await readFile(
      process.env.WENBU_ADMIN_TOKEN_FILE || new URL('../.analytics-admin-token', import.meta.url),
      'utf8',
    )
  ).trim();
const input = ['record', 'inspect'].includes(command)
  ? JSON.parse(await readFile(process.argv[3], 'utf8'))
  : command === 'claim'
    ? { id: process.argv[3] }
    : {};
const response = await fetch('https://wenbu.app/api/admin/search-console', {
  method: statusOnly ? 'GET' : 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(30000),
  headers: {
    Authorization: `Bearer ${token}`,
    Origin: 'https://wenbu.app',
    'Content-Type': 'application/json',
  },
  ...(statusOnly ? {} : { body: JSON.stringify({ ...input, action: command }) }),
});
if (!response.ok) throw new Error(`Search Console queue HTTP ${response.status}`);
const result = await response.json();
console.log(
  JSON.stringify(
    command === 'next'
      ? {
          next: result.nextRequest,
          blockedByUnresolvedDispatch: result.blockedByUnresolvedDispatch,
          globalRetryAt: result.globalRetryAt,
          pauseReason: result.pauseReason,
        }
      : result,
    null,
    2,
  ),
);
