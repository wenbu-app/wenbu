import { it, expect } from 'vitest';
import { readFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const execute = promisify(execFile);
it('ships the same Skill to website users and repository installers', async () => {
  expect(await readFile('skills/wenbu/SKILL.md', 'utf8')).toBe(await readFile('public/SKILL.md', 'utf8'));
  const manifest = JSON.parse(await readFile('integrations/mcp/server.json', 'utf8'));
  expect(manifest.remotes).toEqual([{ type: 'streamable-http', url: 'https://wenbu.app/mcp' }]);
  expect(manifest.version).toBe(JSON.parse(await readFile('package.json', 'utf8')).version);
});
it('honors native opt-out and test classification for both guide GET and calculation POST', async () => {
  const headers: Record<string, unknown>[] = [];
  const bodies: unknown[] = [];
  const server = createServer(async (req, res) => {
    headers.push({ ...req.headers, method: req.method });
    let body = '';
    for await (const chunk of req) body += String(chunk);
    if (body) bodies.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ kind: 'iching', guides: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const env = {
      ...process.env,
      WENBU_URL: `http://127.0.0.1:${port}`,
      WENBU_ANALYTICS: 'off',
      WENBU_TEST: 'true',
    };
    await execute(process.execPath, ['public/wenbu.mjs', 'library'], { env });
    await execute(process.execPath, ['public/wenbu.mjs', 'iching', '{}'], { env });
    await execute(process.execPath, ['public/wenbu.mjs', 'daily', '{}'], { env });
    expect(headers.map((r) => r.method)).toEqual(['GET', 'POST', 'POST']);
    expect(bodies.at(-1)).toEqual({ action: 'reveal', timezone: 'UTC' });
    for (const header of headers)
      expect(header).toMatchObject({
        'x-wenbu-client': 'cli',
        'x-wenbu-analytics': 'off',
        'x-wenbu-test': 'true',
      });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('builds usable integration archives with verified checksums and no credential files', async () => {
  const base = await mkdtemp(join(tmpdir(), 'wenbu-release-test-'));
  const out = join(base, 'artifacts');
  const result = await execute(process.execPath, ['scripts/build-integrations.mjs', '--out', out]);
  const receipt = JSON.parse(result.stdout);
  expect(receipt.artifacts).toHaveLength(4);
  const sums = (await readFile(join(out, 'SHA256SUMS'), 'utf8')).trim().split('\n');
  expect(sums).toHaveLength(3);
  const { createHash } = await import('node:crypto');
  for (const line of sums) {
    const [hash, name] = line.split('  ');
    expect(
      createHash('sha256')
        .update(await readFile(join(out, name)))
        .digest('hex'),
    ).toBe(hash);
    const listing = await execute('tar', ['-tzf', join(out, name)]);
    expect(listing.stdout).not.toMatch(/\.env|\.dev\.vars|token|private|\.pem/);
  }
  await execute('tar', ['-xzf', join(out, receipt.artifacts[0]), '-C', base]);
  const cli = await execute(process.execPath, [join(base, 'package/wenbu.mjs'), '--help']);
  expect(cli.stdout).toContain('Wenbu CLI');
});
