import { it, expect } from 'vitest';
import { handleMcp } from '../worker/mcp';
import { mcpOutputSchemas } from '../worker/mcp-output';
import { productCapabilities } from '../src/lib/product-capabilities';
import { z } from 'zod';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
const call = (
  method: string,
  params: unknown = {},
  path = '/mcp',
  receipt?: Parameters<typeof handleMcp>[1],
) =>
  handleMcp(
    new Request('https://wenbu.app' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    receipt,
  );
it('supports stateless MCP initialization at both slash variants', async () => {
  for (const p of ['/mcp', '/mcp/']) {
    const r = await call(
      'initialize',
      { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      p,
    );
    expect(r.status).toBe(200);
    const b = (await r.json()) as { result: { serverInfo: { name: string } } };
    expect(b.result.serverInfo.name).toBe('wenbu');
  }
});
it('lists seven documented tools without isolate session state', async () => {
  const r = await call('tools/list');
  const b = (await r.json()) as { result: { tools: { name: string }[] } };
  expect(b.result.tools.map((x) => x.name).sort()).toEqual([
    'calculate_bazi',
    'calculate_ziwei',
    'cast_iching',
    'draw_tarot',
    'get_daily_card',
    'read_library',
    'search_library',
  ]);
});
it('executes a tool with structured content', async () => {
  const r = await call('tools/call', { name: 'cast_iching', arguments: { lines: [7, 7, 7, 7, 7, 7] } });
  const b = (await r.json()) as { result: { structuredContent: { original: { number: number } } } };
  expect(b.result.structuredContent.original.number).toBe(1);
});
it('returns tool error for invalid data', async () => {
  const r = await call('tools/call', { name: 'calculate_bazi', arguments: { date: '2023-02-29' } });
  const b = (await r.json()) as { result: { isError: boolean } };
  expect(b.result.isError).toBe(true);
});

it('searches and reads original library content with stable source IDs', async () => {
  const result = (await (
    await call('tools/call', { name: 'search_library', arguments: { query: '真太阳时', locale: 'zh' } })
  ).json()) as { result: { structuredContent: { results: { id: string; kind: string }[] } } };
  const doc = result.result.structuredContent.results.find((d) => d.kind === 'guide');
  expect(doc).toBeDefined();
  const read = (await (
    await call('tools/call', { name: 'read_library', arguments: { id: doc!.id, locale: 'zh' } })
  ).json()) as { result: { structuredContent: { source: { id: string }; content: string } } };
  expect(read.result.structuredContent.source.id).toBe(doc!.id);
  expect(read.result.structuredContent.content.length).toBeGreaterThan(100);
});

it('records one enclosing call for calculations, library reads and SDK validation failures', async () => {
  for (const [params, success, calculated] of [
    [{ name: 'cast_iching', arguments: { lines: [7, 7, 7, 7, 7, 7] } }, true, true],
    [{ name: 'search_library', arguments: { query: 'bazi' } }, true, false],
    [{ name: 'calculate_bazi', arguments: { date: '2023-02-29' } }, false, false],
    [{ name: 'calculate_bazi', arguments: { date: 123 } }, false, false],
    [{ name: 'nonexistent_tool', arguments: {} }, false, false],
  ] as const) {
    const receipts: { tool: string; success: boolean }[] = [];
    await call('tools/call', params, '/mcp', (tool, success) => receipts.push({ tool, success }));
    expect(receipts.filter((r) => r.tool === 'mcp')).toEqual([{ tool: 'mcp', success }]);
    expect(receipts.filter((r) => r.tool !== 'mcp')).toHaveLength(calculated ? 1 : 0);
  }
  const receipts: unknown[] = [];
  await call('tools/list', {}, '/mcp', (...receipt) => receipts.push(receipt));
  expect(receipts).toEqual([]);
});

it('validates every successful tool output against its advertised schema', async () => {
  const tools = (await (await call('tools/list')).json()) as {
    result: { tools: { name: string; outputSchema: JsonSchemaType }[] };
  };
  const validator = new AjvJsonSchemaValidator();
  const cases = [
    ['calculate_bazi', { date: '2024-02-05', time: '12:00' }],
    ['calculate_ziwei', { date: '2000-08-16', time: '03:30', sex: 'male' }],
    ['cast_iching', { lines: [7, 7, 7, 7, 7, 7] }],
    ['draw_tarot', { count: 1, reversals: false }],
    ['search_library', { query: 'solar time' }],
    ['read_library', { id: 'guide-bazi-basics' }],
    ['get_daily_card', { timezone: 'Asia/Shanghai', locale: 'zh' }],
  ] as const;
  for (const [name, args] of cases) {
    const data = (await (await call('tools/call', { name, arguments: args })).json()) as {
      result: { isError?: boolean; structuredContent: Record<string, unknown>; content: { text: string }[] };
    };
    expect(data.result.isError, name).not.toBe(true);
    expect(z.object(mcpOutputSchemas[name]).safeParse(data.result.structuredContent).success, name).toBe(
      true,
    );
    expect(JSON.parse(data.result.content[0].text)).toEqual(data.result.structuredContent);
    const schema = tools.result.tools.find((tool) => tool.name === name)!.outputSchema;
    const validated = validator.getValidator(schema)(data.result.structuredContent);
    expect(validated.valid, name + ': ' + validated.errorMessage).toBe(true);
  }
  const listed = (await (await call('tools/list')).json()) as {
    result: { tools: { name: string; outputSchema: { required: string[] } }[] };
  };
  for (const tool of listed.result.tools) expect(tool.outputSchema.required.length).toBeGreaterThan(0);
});
it('returns a stable public daily prompt without account context or model calls', async () => {
  const read = async () =>
    (await (await call('tools/call', { name: 'get_daily_card', arguments: { timezone: 'UTC' } })).json()) as {
      result: {
        structuredContent: {
          scope: string;
          result: { cards: { id: number; reversed: boolean }[] };
          clock: { date: string };
          note: string;
        };
      };
    };
  const first = (await read()).result.structuredContent,
    second = (await read()).result.structuredContent;
  expect(first.scope).toBe('public');
  expect(first.clock.date).toBe(second.clock.date);
  expect(first.result.cards).toEqual(second.result.cards);
  expect(first.result.cards[0].reversed).toBe(false);
  expect(first.note).toContain('No private history');
});
it('provides selectable prompts and a version-consistent capability resource', async () => {
  const listed = (await (await call('prompts/list')).json()) as { result: { prompts: { name: string }[] } };
  expect(listed.result.prompts.map((prompt) => prompt.name).sort()).toEqual([
    'reflect_on_reading',
    'research_with_sources',
  ]);
  const prompt = (await (
    await call('prompts/get', {
      name: 'reflect_on_reading',
      arguments: { reading: '{"cards":[{"id":17}]}', locale: 'en' },
    })
  ).json()) as { result: { messages: { content: { text: string } }[] } };
  expect(prompt.result.messages[0].content.text).toContain('without redrawing');
  const resource = (await (await call('resources/read', { uri: 'wenbu://capabilities' })).json()) as {
    result: { contents: { text: string }[] };
  };
  expect(JSON.parse(resource.result.contents[0].text)).toEqual(productCapabilities());
  const methods = (await (await call('resources/read', { uri: 'wenbu://methodology' })).json()) as {
    result: { contents: { text: string }[] };
  };
  expect(methods.result.contents[0].text).toContain(`Wenbu v${productCapabilities().version}`);
});
it('does not advertise an unavailable reference-reading tool in search results', async () => {
  const response = (await (
    await call('tools/call', { name: 'search_library', arguments: { query: 'I Ching', limit: 8 } })
  ).json()) as {
    result: {
      structuredContent: { results: { kind: string; nextTool: string | null; nextAction: string }[] };
    };
  };
  const references = response.result.structuredContent.results.filter((item) => item.kind === 'reference');
  expect(references.length).toBeGreaterThan(0);
  for (const reference of references)
    expect(reference).toMatchObject({ nextTool: null, nextAction: 'open_source_with_host' });
});

it('reports service failures separately from invalid personal input', async () => {
  const receipts: { tool: string; status?: string }[] = [];
  const response = await handleMcp(
    new Request('https://wenbu.app/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'read_library', arguments: { id: 'guide-bazi-basics' } },
      }),
    }),
    (tool, _success, _duration, status) => receipts.push({ tool, status }),
    {
      EDITORIAL_ENABLED: 'true',
      ANALYTICS: {
        prepare() {
          throw new Error('Synthetic storage outage');
        },
      },
    } as unknown as import('../worker/types').Env,
  );
  expect(await response.json()).toMatchObject({
    result: {
      isError: true,
      structuredContent: { error: { code: 'source_unavailable', recoverable: true } },
    },
  });
  expect(receipts).toEqual([{ tool: 'mcp', status: 'error' }]);
});
