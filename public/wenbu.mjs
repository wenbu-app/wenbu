#!/usr/bin/env node
// Wenbu CLI · Node.js 22+ · MIT · No dependencies or automatic history access.
import { readFile, stat } from 'node:fs/promises';
const [command, arg, ...extra] = process.argv.slice(2);
const commands = [
  'bazi',
  'iching',
  'tarot',
  'ziwei',
  'daily',
  'agent',
  'library',
  'guide',
  'capabilities',
  'doctor',
  'search',
  'read',
  'prompts',
  'prompt',
];
if (!command || ['help', '--help', '-h'].includes(command)) {
  console.log(`Wenbu CLI

  node wenbu.mjs doctor
  node wenbu.mjs capabilities
  node wenbu.mjs search "birth time" en
  node wenbu.mjs read guide-birth-time-timezone en
  node wenbu.mjs read guide-bazi-basics zh --section section-0
  node wenbu.mjs library
  node wenbu.mjs guide bazi-basics en
  node wenbu.mjs guide bazi-basics zh --json
  node wenbu.mjs bazi '{"date":"2000-08-16","time":"03:30","timezone":"Asia/Shanghai"}'
  node wenbu.mjs daily '{"timezone":"Asia/Shanghai"}'
  node wenbu.mjs iching '{}'
  node wenbu.mjs tarot '{"count":3,"reversals":false}'
  node wenbu.mjs ziwei --file private-input.json
  cat private-input.json | node wenbu.mjs bazi -
  node wenbu.mjs prompts
  node wenbu.mjs prompt research_with_sources '{"question":"How do solar-term boundaries work?","locale":"en"}'
  node wenbu.mjs agent --file selected-context.json

Calculations, library and prompts do not call a model or require a key.
Daily returns the public prompt; it can differ from a personal browser/account card.
Agent requires {"message":"...","consent":true}; sends selected context to Wenbu's model provider.
Agent stdout is newline-delimited JSON, including artifacts and completion.
Prompt retrieval returns a template for your host model; it does not execute it.
No history is read or saved automatically. Requests are never automatically retried.
Use a file or stdin to keep personal information out of shell history.
WENBU_ANALYTICS=off disables coarse service-usage measurement; input content is not recorded in those metrics.
WENBU_URL accepts an HTTPS origin or a local development server. Redirects are refused.
See /agent-protocol.md and /openapi.json. Cultural reflection, not factual prediction.`);
  process.exit(0);
}
const headers = {
  'X-Wenbu-Client': 'cli',
  ...(process.env.WENBU_ANALYTICS === 'off' ? { 'X-Wenbu-Analytics': 'off' } : {}),
  ...(process.env.WENBU_TEST === 'true' ? { 'X-Wenbu-Test': 'true' } : {}),
};
async function textBody(response, limit = 2097152) {
  if (!response.body) throw new Error('Empty response.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > limit) throw new Error(`Response exceeds ${limit} bytes.`);
    chunks.push(chunk);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
async function jsonBody(response) {
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(`Expected JSON; HTTP ${response.status}. Check the deployment.`);
  const text = await textBody(response);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The service returned invalid JSON. No automatic retry was made.');
  }
}
async function inputFrom(value, tail, limit) {
  let raw = value || '{}';
  if (value === '--file') {
    if (!tail[0] || tail.length !== 1) throw new Error('Provide one input file.');
    const info = await stat(tail[0]);
    if (!info.isFile() || info.size > limit)
      throw new Error(`Input must be a file of at most ${limit} bytes.`);
    raw = await readFile(tail[0], 'utf8');
  } else if (value === '-') {
    if (tail.length) throw new Error('Unexpected argument.');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > limit) throw new Error(`Input exceeds ${limit} bytes.`);
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString('utf8');
  } else if (tail.length) throw new Error('Unexpected argument.');
  if (Buffer.byteLength(raw) > limit) throw new Error(`Input exceeds ${limit} bytes.`);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('Input must be a JSON object. Use --file or stdin for selected private details.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Input must be a JSON object.');
  return input;
}
const print = (value) => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
try {
  if (!commands.includes(command)) throw new Error('Unknown command. Run --help.');
  const base = new URL(process.env.WENBU_URL || 'https://wenbu.app');
  if (
    base.protocol !== 'https:' &&
    !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  )
    throw new Error('Use HTTPS or a local development endpoint.');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw new Error('WENBU_URL must be an origin without credentials or a path.');
  const request = async (path, options = {}) => {
    try {
      return await fetch(new URL(path, base), {
        ...options,
        redirect: 'error',
        headers: { ...headers, ...options.headers },
        signal: AbortSignal.timeout(command === 'agent' ? 130000 : 15000),
      });
    } catch {
      throw new Error(
        'Request failed, timed out or redirected. Check the endpoint. No automatic retry was made.',
      );
    }
  };
  const rpc = async (method, params = {}) => {
    const response = await request('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const data = await jsonBody(response);
    if (!response.ok || data.error || !data.result || data.result.isError)
      throw new Error(
        data.result?.structuredContent?.error?.message ||
          (data.error
            ? 'MCP rejected this request. Check its method and arguments.'
            : `MCP request failed: HTTP ${response.status}.`),
      );
    return data.result;
  };
  const get = async (path) => {
    const response = await request(path);
    if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}.`);
    return jsonBody(response);
  };
  if (['doctor', 'capabilities', 'library', 'prompts'].includes(command)) {
    if (arg || extra.length) throw new Error(`${command} takes no arguments.`);
    if (command === 'doctor') {
      const init = await rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'wenbu-cli-doctor', version: '1' },
      });
      const tools = await rpc('tools/list'),
        resources = await rpc('resources/list'),
        prompts = await rpc('prompts/list');
      const capabilities = await get('/api/v1/capabilities');
      const actual = tools.tools.map((tool) => tool.name);
      if (
        capabilities.mcp.tools.some((name) => !actual.includes(name)) ||
        capabilities.version !== init.serverInfo.version
      )
        throw new Error('Capability discovery and MCP disagree. Check the deployment version.');
      print({
        status: 'ok',
        origin: base.origin,
        version: init.serverInfo.version,
        tools: actual,
        resources: resources.resources.map((resource) => resource.uri),
        prompts: prompts.prompts.map((prompt) => prompt.name),
        privacy: 'No personal input, model call or private history access.',
      });
    } else if (command === 'prompts') print(await rpc('prompts/list'));
    else print(await get(command === 'library' ? '/knowledge/index.json' : '/api/v1/capabilities'));
  } else if (command === 'guide') {
    const asJson = extra.at(-1) === '--json',
      localeArgs = asJson ? extra.slice(0, -1) : extra,
      locale = localeArgs[0] || 'en';
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(arg || '') ||
      arg.length > 100 ||
      !['zh', 'en'].includes(locale) ||
      localeArgs.length > 1
    )
      throw new Error('Usage: guide <slug> [zh|en] [--json]. List slugs with library.');
    const response = await request(`/knowledge/${locale}/${arg}.${asJson ? 'json' : 'md'}`);
    if (!response.ok) throw new Error(`Guide request failed: HTTP ${response.status}.`);
    if (asJson) print(await jsonBody(response));
    else {
      if (!response.headers.get('content-type')?.includes('text/markdown'))
        throw new Error('Expected Markdown. Check the guide slug.');
      process.stdout.write((await textBody(response)) + '\n');
    }
  } else if (command === 'search' || command === 'read') {
    const locale = extra[0] && !extra[0].startsWith('--') ? extra[0] : 'en';
    const tail = extra[0] === locale ? extra.slice(1) : extra;
    if (
      !arg ||
      !['zh', 'en'].includes(locale) ||
      (command === 'search' ? tail.length : tail.length && (tail[0] !== '--section' || tail.length !== 2))
    )
      throw new Error('Usage: search <query> [zh|en], or read <id> [zh|en] [--section id].');
    if (Buffer.byteLength(arg) > 640 || (tail[1] && tail[1].length > 80))
      throw new Error('Query or section exceeds its limit.');
    const args =
      command === 'search'
        ? { query: arg, locale }
        : { id: arg, locale, ...(tail.length ? { section: tail[1] } : {}) };
    const result = await rpc('tools/call', {
      name: command === 'search' ? 'search_library' : 'read_library',
      arguments: args,
    });
    if (!result.structuredContent) throw new Error('Missing structured MCP output.');
    print(result.structuredContent);
  } else if (command === 'prompt') {
    if (!arg || !/^[a-z_]{1,80}$/.test(arg))
      throw new Error('Usage: prompt <name> <JSON>, --file path, or -.');
    const args = await inputFrom(extra[0], extra.slice(1), 24576);
    print(await rpc('prompts/get', { name: arg, arguments: args }));
  } else {
    const input = await inputFrom(arg, extra, command === 'agent' ? 98304 : 8192);
    if (command === 'daily') {
      input.action ??= 'reveal';
      input.timezone ??= 'UTC';
    }
    if (command === 'agent' && input.consent !== true)
      throw new Error('Agent requires consent:true to send this selected context to the model provider.');
    const response = await request('/api/v1/' + command, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (command === 'agent' && response.ok) {
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
        throw new Error('Expected an Agent event stream.');
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let buffer = '',
        terminal = false;
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, end);
          if (Buffer.byteLength(block) > 262144) throw new Error('Agent event exceeds 262144 bytes.');
          buffer = buffer.slice(end + 2);
          const lines = block.split('\n').filter((line) => line.startsWith('data:'));
          if (!lines.length) continue;
          const event = JSON.parse(lines.map((line) => line.slice(5).trimStart()).join('\n'));
          if (terminal) throw new Error('Unexpected event after completion.');
          process.stdout.write(JSON.stringify(event) + '\n');
          if (event.type === 'done' || event.type === 'error') terminal = true;
          if (event.type === 'error') process.exitCode = 1;
        }
        if (Buffer.byteLength(buffer) > 262144) throw new Error('Agent event exceeds 262144 bytes.');
      }
      buffer += decoder.decode();
      if (buffer.trim() || !terminal)
        throw new Error(
          'Agent stream ended before completion. Keep received artifacts and retry explicitly.',
        );
    } else {
      const data = await jsonBody(response);
      if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}.`);
      print(data);
    }
  }
} catch (error) {
  console.error('Wenbu: ' + (error instanceof Error ? error.message : 'Request failed.'));
  process.exitCode = 1;
}
