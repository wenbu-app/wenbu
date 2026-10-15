import { readFile } from 'node:fs/promises';
const command = process.argv[2] ?? 'status';
if (!['status', 'run', 'check', 'observe'].includes(command))
  throw new Error('Use status, run, check or observe.');
const token =
  process.env.WENBU_ADMIN_TOKEN ||
  (
    await readFile(
      process.env.WENBU_ADMIN_TOKEN_FILE || new URL('../.analytics-admin-token', import.meta.url),
      'utf8',
    ).catch(() => '')
  ).trim();
if (!token) throw new Error('Admin credential unavailable; configure WENBU_ADMIN_TOKEN_FILE.');
const filename = process.argv[3];
if (command === 'observe' && !filename) throw new Error('Pass a JSON observation file.');
const body = command === 'observe' ? await readFile(filename, 'utf8') : undefined;
if (body) JSON.parse(body);
const response = await fetch(
  'https://wenbu.app/api/admin/editorial' + (command === 'status' ? '' : '/' + command),
  {
    method: command === 'status' ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: 'https://wenbu.app',
      'Content-Type': 'application/json',
    },
    body,
  },
);
if (!response.ok) throw new Error(`Editorial endpoint returned HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
