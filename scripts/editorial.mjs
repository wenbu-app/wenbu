import { readFile } from 'node:fs/promises';
const command = process.argv[2] ?? 'status';
const inputCommands = ['observe', 'revise', 'codex-prepare', 'codex-deliver'];
if (!['status', 'run', 'plan', 'check', 'recover', ...inputCommands].includes(command))
  throw new Error('Use status, run, plan, check, observe, recover, revise, codex-prepare or codex-deliver.');
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
if (inputCommands.includes(command) && !filename) throw new Error('Pass a JSON input file.');
if (command === 'recover' && !filename)
  throw new Error('Pass the failed run ID after fixing its underlying issue.');
const body = inputCommands.includes(command)
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
    signal: AbortSignal.timeout(command.startsWith('codex-') ? 90_000 : 30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: 'https://wenbu.app',
      'Content-Type': 'application/json',
    },
    body,
  },
);
if (!response.ok) {
  const detail = command.startsWith('codex-') ? (await response.json().catch(() => null))?.error?.code : null;
  throw new Error(`Editorial endpoint returned HTTP ${response.status}${detail ? ': ' + detail : ''}`);
}
console.log(JSON.stringify(await response.json(), null, 2));
