#!/usr/bin/env node
// Wenbu CLI · Node.js 22+ · MIT · No dependencies, account or API key.
import { readFile } from 'node:fs/promises';
const [command, arg, ...extra] = process.argv.slice(2);
if (!command || ['help', '--help', '-h'].includes(command)) {
  console.log(
    'Wenbu CLI\n\n  node wenbu.mjs bazi \'{"date":"2000-08-16","time":"03:30","timezone":"Asia/Shanghai"}\'\n  node wenbu.mjs daily \'{"timezone":"Asia/Shanghai"}\'\n  node wenbu.mjs library\n  node wenbu.mjs guide bazi-basics en\n  node wenbu.mjs guide bazi-basics zh --json\n  node wenbu.mjs iching \'{}\'\n  node wenbu.mjs tarot \'{"count":3}\'\n  node wenbu.mjs ziwei --file private-input.json\n  cat private-input.json | node wenbu.mjs bazi -\n  node wenbu.mjs agent --file selected-context.json\n\nAgent input requires {"message":"...","consent":true}; sends selected context to DeepSeek.\nAgent stdout is newline-delimited JSON events, including text, artifacts and completion.\nNo history is read or saved automatically. See /agent-protocol.md and /openapi.json.\nUse a file or stdin to keep personal information out of shell history.\nWENBU_ANALYTICS=off disables coarse service-usage measurement; request content is never recorded.\nWENBU_URL may select another HTTPS deployment or a local development server.\nThese tools calculate cultural symbols, not factual predictions.',
  );
  process.exit(0);
}
if (!['bazi', 'iching', 'tarot', 'ziwei', 'daily', 'agent', 'library', 'guide'].includes(command))
  throw new Error('Unknown tool. Run --help.');
try {
  const maxBytes = command === 'agent' ? 98304 : 8192;
  const base = new URL(process.env.WENBU_URL || 'https://wenbu.app');
  if (
    base.protocol !== 'https:' &&
    !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  )
    throw new Error('Use HTTPS or a local development endpoint.');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw new Error('WENBU_URL must be an origin without credentials or a path.');
  if (command === 'library' || command === 'guide') {
    if (command === 'library' && (arg || extra.length)) throw new Error('library takes no arguments.');
    const asJson = extra.at(-1) === '--json';
    const localeArgs = asJson ? extra.slice(0, -1) : extra;
    const locale = localeArgs[0] || 'en';
    if (
      command === 'guide' &&
      (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(arg || '') ||
        !['zh', 'en'].includes(locale) ||
        localeArgs.length > 1)
    )
      throw new Error('Usage: guide <slug> [zh|en] [--json]. List slugs with library.');
    const path =
      command === 'library'
        ? '/knowledge/index.json'
        : `/knowledge/${locale}/${arg}.${asJson ? 'json' : 'md'}`;
    const res = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(15000),
      headers: {
        'X-Wenbu-Client': 'cli',
        ...(process.env.WENBU_ANALYTICS === 'off' ? { 'X-Wenbu-Analytics': 'off' } : {}),
        ...(process.env.WENBU_TEST === 'true' ? { 'X-Wenbu-Test': 'true' } : {}),
      },
    });
    if (!res.ok) throw new Error('Guide request failed: HTTP ' + res.status);
    const mime = res.headers.get('content-type') || '';
    if (!(path.endsWith('.json') ? mime.includes('application/json') : mime.includes('text/markdown')))
      throw new Error('Unexpected response format. Check the deployment and guide slug.');
    process.stdout.write(
      (path.endsWith('.json') ? JSON.stringify(await res.json(), null, 2) : await res.text()) + '\n',
    );
    process.exit(0);
  }
  let raw = arg || '{}';
  if (arg === '--file') {
    if (!extra[0] || extra.length > 1) throw new Error('Provide one input file.');
    raw = await readFile(extra[0], 'utf8');
  } else if (arg === '-') {
    if (extra.length) throw new Error('Unexpected argument.');
    raw = '';
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) throw new Error(`Input exceeds ${maxBytes} bytes.`);
    }
  } else if (extra.length) throw new Error('Unexpected argument.');
  if (Buffer.byteLength(raw) > maxBytes) throw new Error(`Input exceeds ${maxBytes} bytes.`);
  const input = JSON.parse(raw);
  if (command === 'daily') {
    input.action ??= 'reveal';
    input.timezone ??= 'UTC';
  }
  if (command === 'agent' && input.consent !== true)
    throw new Error('Agent requires explicit consent:true to send this context to DeepSeek.');
  const res = await fetch(new URL('/api/v1/' + command, base), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wenbu-Client': 'cli',
      ...(process.env.WENBU_TEST === 'true' ? { 'X-Wenbu-Test': 'true' } : {}),
      ...(process.env.WENBU_ANALYTICS === 'off' ? { 'X-Wenbu-Analytics': 'off' } : {}),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(command === 'agent' ? 130000 : 15000),
  });
  if (command === 'agent' && res.ok) {
    if (!res.body || !res.headers.get('content-type')?.includes('text/event-stream'))
      throw new Error('Expected an Agent event stream.');
    const decoder = new TextDecoder();
    let buffer = '',
      terminal = false;
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        if (end > 262144) throw new Error('Agent event exceeds limit.');
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = block.split('\n').filter((line) => line.startsWith('data:'));
        if (!lines.length) continue;
        const event = JSON.parse(lines.map((line) => line.slice(5).trimStart()).join('\n'));
        if (terminal) throw new Error('Unexpected event after completion.');
        process.stdout.write(JSON.stringify(event) + '\n');
        if (event.type === 'done' || event.type === 'error') terminal = true;
        if (event.type === 'error') process.exitCode = 1;
      }
      if (buffer.length > 262144) throw new Error('Agent event exceeds limit.');
    }
    buffer += decoder.decode();
    if (buffer.trim() || !terminal)
      throw new Error('Agent stream ended before completion. Keep received artifacts and retry explicitly.');
  } else {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'HTTP ' + res.status);
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
} catch (e) {
  console.error('Wenbu: ' + e.message);
  process.exitCode = 1;
}
