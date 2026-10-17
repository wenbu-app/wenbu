import { readFile } from 'node:fs/promises';
const command = process.argv[2] ?? 'status';
if (!['status', 'seed', 'claim', 'record'].includes(command))
  throw new Error('Use status, seed, claim <job-id>, or record <receipt.json>.');
const token =
  process.env.WENBU_ADMIN_TOKEN ||
  (
    await readFile(
      process.env.WENBU_ADMIN_TOKEN_FILE || new URL('../.analytics-admin-token', import.meta.url),
      'utf8',
    )
  ).trim();
const input =
  command === 'record'
    ? JSON.parse(await readFile(process.argv[3], 'utf8'))
    : command === 'claim'
      ? { id: process.argv[3] }
      : {};
const response = await fetch('https://wenbu.app/api/admin/search-console', {
  method: command === 'status' ? 'GET' : 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(30000),
  headers: {
    Authorization: `Bearer ${token}`,
    Origin: 'https://wenbu.app',
    'Content-Type': 'application/json',
  },
  ...(command === 'status' ? {} : { body: JSON.stringify({ ...input, action: command }) }),
});
if (!response.ok) throw new Error(`Search Console queue HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
