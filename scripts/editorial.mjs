import { readFile } from 'node:fs/promises';
const command = process.argv[2] ?? 'status';
if (!['status', 'run', 'plan', 'check', 'observe', 'recover', 'revise'].includes(command))
  throw new Error('Use status, run, plan, check, observe, recover or revise.');
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
if (['observe', 'revise'].includes(command) && !filename) throw new Error('Pass a JSON input file.');
if (command === 'recover' && !filename)
  throw new Error('Pass the failed run ID after fixing its underlying issue.');
const body = ['observe', 'revise'].includes(command)
  ? await readFile(filename, 'utf8')
  : command === 'recover'
    ? JSON.stringify({ runId: filename })
    : undefined;
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
