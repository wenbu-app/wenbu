import { it, expect } from 'vitest';
import { readFile, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mcpToolNames } from '../src/lib/product-capabilities';
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

it('refuses redirects before forwarding selected input to another host', async () => {
  let forwarded = 0,
    received = 0;
  const target = createServer((_req, res) => {
    forwarded++;
    res.end('{}');
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const server = createServer((_req, res) => {
    received++;
    res.writeHead(307, {
      Location: `http://127.0.0.1:${(target.address() as { port: number }).port}/receive`,
    });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await expect(
      execute(process.execPath, ['public/wenbu.mjs', 'bazi', '{"date":"2000-08-16"}'], {
        env: { ...process.env, WENBU_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}` },
      }),
    ).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('redirected') });
    expect(received).toBe(1);
    expect(forwarded).toBe(0);
  } finally {
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => target.close(() => resolve())),
    ]);
  }
});
it('bounds streamed events by UTF-8 bytes and does not print an oversized event', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.end(`data: ${JSON.stringify({ type: 'text', delta: '测'.repeat(90000) })}\n\n`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await expect(
      execute(process.execPath, ['public/wenbu.mjs', 'agent', '{"message":"synthetic","consent":true}'], {
        env: { ...process.env, WENBU_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}` },
      }),
    ).rejects.toMatchObject({ code: 1, stdout: '', stderr: expect.stringContaining('262144 bytes') });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('discovers MCP capabilities and reads a focused section through the CLI', async () => {
  const calls: { method: string; params: { name?: string; arguments?: Record<string, string> } }[] = [];
  const version = JSON.parse(await readFile('package.json', 'utf8')).version;
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/v1/capabilities')
      return res.end(JSON.stringify({ version, mcp: { tools: ['read_library', 'search_library'] } }));
    let raw = '';
    for await (const chunk of req) raw += String(chunk);
    const body = JSON.parse(raw);
    calls.push(body);
    const result =
      body.method === 'initialize'
        ? { serverInfo: { version } }
        : body.method === 'tools/list'
          ? { tools: [{ name: 'read_library' }, { name: 'search_library' }] }
          : body.method === 'resources/list'
            ? { resources: [{ uri: 'wenbu://capabilities' }] }
            : body.method === 'prompts/list'
              ? { prompts: [{ name: 'research_with_sources' }] }
              : {
                  structuredContent: {
                    scope: 'section',
                    section: body.params.arguments.section,
                    content: 'Selected public text',
                  },
                };
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = {
      ...process.env,
      WENBU_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      WENBU_ANALYTICS: 'off',
    };
    const doctor = await execute(process.execPath, ['public/wenbu.mjs', 'doctor'], { env });
    expect(JSON.parse(doctor.stdout)).toMatchObject({ status: 'ok', version });
    expect(calls.some((call) => call.method === 'tools/call')).toBe(false);
    const read = await execute(
      process.execPath,
      ['public/wenbu.mjs', 'read', 'guide-bazi-basics', 'en', '--section', 'section-0'],
      { env },
    );
    expect(JSON.parse(read.stdout)).toMatchObject({ scope: 'section', section: 'section-0' });
    expect(calls.at(-1)?.params).toMatchObject({
      name: 'read_library',
      arguments: { id: 'guide-bazi-basics', locale: 'en', section: 'section-0' },
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('shows an actionable error without an uncaught stack for an unknown command', async () => {
  await expect(execute(process.execPath, ['public/wenbu.mjs', 'not-a-command'])).rejects.toMatchObject({
    code: 1,
    stderr: 'Wenbu: Unknown command. Run --help.\n',
  });
});

it('documents every exposed MCP tool in the public Skill and connection page', async () => {
  const skill = await readFile('public/SKILL.md', 'utf8');
  const page = await readFile('src/components/Agents.astro', 'utf8');
  for (const name of mcpToolNames) {
    expect(skill).toContain(name);
    expect(page).toContain(name);
  }
  const schema = JSON.parse(await readFile('public/openapi.json', 'utf8'));
  expect(schema.info.version).toBe(JSON.parse(await readFile('package.json', 'utf8')).version);
  expect(schema.paths['/api/v1/daily']).toBeDefined();
  expect(schema.paths['/api/v1/capabilities']).toBeDefined();
});
