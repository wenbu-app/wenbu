import { version as releaseVersion } from '../package.json';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { calculateBazi } from '../src/lib/bazi';
import { castIching } from '../src/lib/iching';
import { drawTarot } from '../src/lib/tarot';
import { calculateZiwei } from '../src/lib/ziwei';
import { knowledgeIndex } from '../src/lib/knowledge';
import { searchCompleteLibrary, readCompleteLibrary } from './editorial-library';
import type { Env } from './types';
import { editorialDiscovery } from './editorial-discovery';
import type { ToolKind } from '../src/lib/schema';
type ToolReceipt = (
  tool: ToolKind | 'mcp',
  success: boolean,
  duration: number,
  status?: 'complete' | 'invalid_input' | 'error',
) => void;

const language = z.enum(['zh', 'en']).default('en');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const pack = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  structuredContent: data,
});

export function createMcpServer(receipt?: ToolReceipt, env?: Env) {
  const server = new McpServer(
    { name: 'wenbu', version: releaseVersion },
    {
      instructions:
        'Wenbu provides cultural reflection tools, not factual predictions. Only send birth details the user explicitly chooses to share. Preserve all calculation conventions and warnings. Use your host model to interpret the returned data; Wenbu MCP does not need an AI key.',
    },
  );
  const register = (
    name: string,
    description: string,
    inputSchema: Record<string, z.ZodType>,
    fn: (a: unknown) => Record<string, unknown> | Promise<Record<string, unknown>>,
    random = false,
  ) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: !random,
          openWorldHint: false,
        },
      },
      async (args) => {
        const started = Date.now();
        const kind =
          (
            {
              calculate_bazi: 'bazi',
              calculate_ziwei: 'ziwei',
              cast_iching: 'iching',
              draw_tarot: 'tarot',
            } as Partial<Record<string, ToolKind>>
          )[name] ?? 'mcp';
        try {
          const result = await fn(args);
          if (kind !== 'mcp') receipt?.(kind, true, Date.now() - started);
          return pack(result);
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  name === 'read_library'
                    ? 'Unknown document or section. Use an ID from search_library and a section ID from the returned outline.'
                    : 'Invalid input. Check the date, timezone and required fields. No chart was generated.',
              },
            ],
          };
        }
      },
    );
  };
  register(
    'calculate_bazi',
    'Calculate four pillars. Unknown time returns no hour pillar. Gregorian date, IANA timezone, explicit day boundary. No prediction.',
    {
      date,
      time: time.nullable().default(null),
      timezone: z.string().default('Asia/Shanghai'),
      dayBoundary: z.enum(['midnight', 'zi']).default('midnight'),
      solarTime: z.boolean().default(false),
      longitude: z.number().min(-180).max(180).optional(),
      locale: language,
    },
    calculateBazi,
  );
  register(
    'cast_iching',
    'Cast six three-coin lines or supply your own. Lines are ordered bottom to top, values 6/7/8/9. Returns original and changed King Wen hexagrams.',
    {
      lines: z
        .array(z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]))
        .length(6)
        .optional(),
      locale: language,
    },
    castIching,
    true,
  );
  register(
    'draw_tarot',
    'Draw one or three cards from a full 78-card deck without replacement. Reversals optional. Symbolic reflection only.',
    {
      count: z.union([z.literal(1), z.literal(3)]).default(3),
      reversals: z.boolean().default(true),
      locale: language,
    },
    drawTarot,
    true,
  );
  register(
    'calculate_ziwei',
    'Calculate Zi Wei Dou Shu twelve palaces from an entered local civil date and known time. iztro default school, no solar-time correction. Sex is a traditional calculation parameter.',
    { date, time, sex: z.enum(['male', 'female']), locale: language },
    calculateZiwei,
  );
  register(
    'search_library',
    'Search Wenbu original guides, symbols and curated reference metadata. This is a bounded catalogue, not a web search. Search snippets do not mean the source was read.',
    { query: z.string().min(1).max(160), locale: language, limit: z.number().int().min(1).max(8).default(6) },
    async (a) => {
      const { query, locale, limit } = a as { query: string; locale: 'zh' | 'en'; limit: number };
      return { results: await searchCompleteLibrary(query, locale, limit, env) };
    },
  );
  register(
    'read_library',
    'Read a complete Wenbu guide or symbol by search_library ID. Handbook guides return Markdown, outline and export links without truncation. Optionally provide a section ID from the outline; the returned scope makes partial reads explicit. External reference entries are metadata only; use your host browsing capability to verify them.',
    { id: z.string().min(1).max(100), locale: language, section: z.string().min(1).max(80).optional() },
    (a) => {
      const { id, locale, section } = a as { id: string; locale: 'zh' | 'en'; section?: string };
      return readCompleteLibrary(id, locale, section, env);
    },
  );
  server.registerResource('methodology', 'wenbu://methodology', { mimeType: 'text/plain' }, async () => ({
    contents: [
      {
        uri: 'wenbu://methodology',
        mimeType: 'text/plain',
        text: 'Wenbu v1.1. BaZi: lunar-typescript 1.8.6; solar-term year/month at the absolute instant in fixed UTC+08:00 standard time; day/hour in local civil or approximate solar time. I Ching: cryptographic three-coin probabilities 1/8,3/8,3/8,1/8; bottom-to-top lines; changing lines 6 and 9. Tarot: uniform selection without replacement, optional independent 50% reversals. Zi Wei: iztro 2.6.1 local civil time, fixLeap=true, default school. Details: https://wenbu.app/en/methodology/',
      },
    ],
  }));
  server.registerResource(
    'knowledge-index',
    'wenbu://knowledge',
    {
      mimeType: 'application/json',
      description: 'Bilingual handbook catalogue with canonical, full Markdown and structured JSON links.',
    },
    async () => ({
      contents: [
        {
          uri: 'wenbu://knowledge',
          mimeType: 'application/json',
          text: env
            ? ((await (
                await editorialDiscovery(new Request(env.SITE_URL + '/knowledge/index.json'), env)
              )?.text()) ?? JSON.stringify(knowledgeIndex()))
            : JSON.stringify(knowledgeIndex()),
        },
      ],
    }),
  );
  return server;
}
export async function handleMcp(request: Request, receipt?: ToolReceipt, env?: Env) {
  const started = Date.now();
  const body =
    request.method === 'POST'
      ? ((await request
          .clone()
          .json()
          .catch(() => null)) as { method?: string } | null)
      : null;
  const isToolCall = body?.method === 'tools/call';
  const server = createMcpServer(receipt, env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  // JSON-only stateless operation: no isolate-local session map or private-data storage.
  try {
    const response = await transport.handleRequest(request);
    if (isToolCall) {
      const result = (await response
        .clone()
        .json()
        .catch(() => null)) as { result?: { isError?: boolean }; error?: unknown } | null;
      receipt?.(
        'mcp',
        response.ok && Boolean(result?.result) && !result?.error && !result?.result?.isError,
        Date.now() - started,
        !result || response.status >= 500
          ? 'error'
          : result.error || result.result?.isError
            ? 'invalid_input'
            : 'complete',
      );
    }
    return response;
  } finally {
    await server.close();
  }
}
