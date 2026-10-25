import { writeFile, readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Gregorian date, 1901–2099' };
const time = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const locale = { type: 'string', enum: ['zh', 'en'], default: 'zh' };
const body = (properties, required = []) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const schemas = {
  bazi: body(
    {
      date,
      time: { anyOf: [time, { type: 'null' }], default: null },
      timezone: { type: 'string', default: 'Asia/Shanghai', maxLength: 80 },
      dayBoundary: { type: 'string', enum: ['midnight', 'zi'], default: 'midnight' },
      solarTime: { type: 'boolean', default: false },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      locale,
    },
    ['date'],
  ),
  ziwei: body({ date, time, sex: { type: 'string', enum: ['male', 'female'] }, locale }, [
    'date',
    'time',
    'sex',
  ]),
  iching: body({
    lines: {
      type: 'array',
      minItems: 6,
      maxItems: 6,
      items: { type: 'integer', enum: [6, 7, 8, 9] },
      description: 'Bottom to top. Omit for cryptographic random three-coin casting.',
    },
    locale,
  }),
  tarot: body({
    count: { type: 'integer', enum: [1, 3], default: 3 },
    reversals: { type: 'boolean', default: true },
    locale,
  }),
};
const paths = Object.fromEntries(
  Object.entries(schemas).map(([kind, schema]) => [
    '/api/v1/' + kind,
    {
      post: {
        operationId: {
          bazi: 'calculate_bazi',
          iching: 'cast_iching',
          tarot: 'draw_tarot',
          ziwei: 'calculate_ziwei',
        }[kind],
        summary: 'Calculate or draw ' + kind + ' symbols',
        description:
          'No authentication. Cultural reflection, not established prediction. JSON body capped at 8192 bytes. Rate limits apply.',
        requestBody: { required: true, content: { 'application/json': { schema } } },
        responses: {
          200: {
            description: 'Structured result including method and conventions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['kind', 'version', 'method'],
                  properties: {
                    kind: { const: kind },
                    version: { type: 'string' },
                    method: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid JSON' },
          403: { description: 'Browser origin rejected' },
          413: { description: 'Request too large' },
          415: { description: 'JSON content type required' },
          422: { description: 'Invalid input or ambiguous date/time' },
          429: { description: 'Request limit reached' },
        },
      },
    },
  ]),
);
paths['/api/v1/interpret'] = {
  post: {
    operationId: 'interpret_reading',
    summary: 'Optional metered AI interpretation',
    description:
      'User must explicitly consent. Recomputes supplied chart data. Five attempts per network per Shanghai day; global budget 1000 attempts. Upstream attempts count even if they fail. Tarot input is cards [{id:0..77,reversed:boolean}] with 1 or 3 unique cards. Other inputs follow their calculation schema; I Ching requires the original lines.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: body(
            {
              kind: { type: 'string', enum: Object.keys(schemas) },
              input: { type: 'object' },
              question: { type: 'string', minLength: 2, maxLength: 600 },
              context: { type: 'string', maxLength: 1600, default: '' },
              locale,
              consent: { const: true },
            },
            ['kind', 'input', 'question', 'consent'],
          ),
        },
      },
    },
    responses: {
      200: {
        description:
          'Validated structured interpretation, remaining allowance and requested/served model provenance',
      },
      422: { description: 'Invalid input or missing consent' },
      429: { description: 'Daily allowance or global budget reached' },
      502: { description: 'Incomplete upstream response' },
      503: { description: 'AI unavailable' },
    },
  },
};
const agentSchema = body(
  {
    message: { type: 'string', minLength: 1, maxLength: 3000 },
    consent: { const: true },
    locale,
    mode: { type: 'string', enum: ['explore', 'research'], default: 'explore' },
    newDraw: {
      type: 'boolean',
      default: false,
      description: 'True only after the user explicitly requests a new random result.',
    },
    history: {
      type: 'array',
      maxItems: 16,
      description: 'At most 28000 characters combined; never system or tool roles.',
      items: body({ role: { enum: ['user', 'assistant'] }, content: { type: 'string', maxLength: 7000 } }, [
        'role',
        'content',
      ]),
    },
    context: body({
      note: { type: 'string', maxLength: 5000, default: '' },
      reports: {
        type: 'array',
        maxItems: 2,
        description:
          'Prior drafts for revision, never verified evidence. Combined summary/section headings/bodies/questions/visual text <=1800 characters per report.',
        items: body(
          {
            title: { type: 'string', minLength: 1, maxLength: 100 },
            summary: { type: 'string', minLength: 1, maxLength: 450 },
            sections: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: body(
                {
                  heading: { type: 'string', minLength: 1, maxLength: 100 },
                  body: { type: 'string', minLength: 1, maxLength: 700 },
                  sourceIds: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 120 } },
                },
                ['heading', 'body'],
              ),
            },
            questions: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 100 } },
            visual: body(
              {
                type: { enum: ['comparison', 'steps'] },
                title: { type: 'string', minLength: 1, maxLength: 80 },
                items: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 4,
                  items: body(
                    {
                      label: { type: 'string', minLength: 1, maxLength: 48 },
                      detail: { type: 'string', minLength: 1, maxLength: 160 },
                      sourceIds: {
                        type: 'array',
                        maxItems: 4,
                        items: { type: 'string', minLength: 1, maxLength: 120 },
                      },
                    },
                    ['label', 'detail'],
                  ),
                },
                note: { type: 'string', maxLength: 160, default: '' },
              },
              ['type', 'title', 'items'],
            ),
          },
          ['title', 'summary', 'sections'],
        ),
      },
      birth: body(
        {
          date,
          time: { anyOf: [time, { type: 'null' }] },
          timezone: { type: 'string', minLength: 1, maxLength: 80 },
          dayBoundary: { enum: ['midnight', 'zi'] },
          solarTime: { type: 'boolean' },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          sex: { enum: ['male', 'female'] },
        },
        ['date', 'time', 'timezone', 'dayBoundary', 'solarTime'],
      ),
      readings: {
        type: 'array',
        maxItems: 6,
        items: body(
          {
            kind: { enum: Object.keys(schemas) },
            input: {
              description:
                'Original calculation input. For I Ching, original six lines required; for tarot, original cards [{id:0..77,reversed:boolean}], 1 or 3 unique cards.',
            },
          },
          ['kind', 'input'],
        ),
      },
      sourceIds: {
        type: 'array',
        maxItems: 12,
        items: { type: 'string', maxLength: 120 },
        description:
          'Known source IDs are verified again. A client-provided ID never establishes that an external source was read.',
      },
    }),
  },
  ['message', 'consent'],
);
paths['/api/v1/agent'] = {
  post: {
    operationId: 'run_agent_turn',
    summary: 'Run one bounded Wenbu Agent turn with real tools and streamed artifacts',
    description:
      'Explicit consent to send selected context to DeepSeek. Unauthenticated external calls have no saved application history; first-party verified email accounts can opt into cloud records. Body <=98304 bytes. Browser trials/accounts have twelve turns per Shanghai day with trial usage carried over at sign-in and additional network/global limits. Unauthenticated external clients retain the per-network allowance; at most five model calls and 12 tool executions per turn, 120-second deadline. Shared site model budget 1000, Agent sub-budget 600. Each attempted model call counts, including failures. Research covers a curated catalogue, not unrestricted web search. Stream errors can occur after HTTP 200: only a done event confirms terminal status; waiting and limited are not complete.',
    requestBody: { required: true, content: { 'application/json': { schema: agentSchema } } },
    responses: {
      200: {
        description:
          'SSE JSON events: start, delta, tool_start, tool_end, plan, source, artifact, question, context, error, done. See /agent-protocol.md. Hidden model reasoning is never emitted.',
        content: { 'text/event-stream': { schema: { type: 'string' } } },
      },
      403: { description: 'Browser origin rejected' },
      413: { description: 'Body exceeds 96 KiB' },
      422: { description: 'Invalid request, missing consent or invalid original chart context' },
      429: { description: 'Network or shared daily limit reached' },
      503: { description: 'Model or quota configuration unavailable' },
    },
  },
};
paths['/api/feedback'] = {
  post: {
    operationId: 'submit_feedback',
    summary: 'Privately submit a rating or product feedback',
    description:
      'Requires the exact site Origin header. Five submissions per network per minute. UUID receipts deduplicate retries; a changed payload must use a new UUID. Excerpts require an explicit user choice (shareContext=true); never attach conversation text automatically. Analytics opt-out does not prevent explicit feedback.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: body(
            {
              id: { type: 'string', format: 'uuid' },
              page: { type: 'string', maxLength: 120 },
              locale,
              tool: {
                type: 'string',
                enum: ['none', 'bazi', 'iching', 'tarot', 'ziwei', 'agent', 'interpret', 'mcp'],
                default: 'none',
              },
              category: { type: 'string', enum: ['suggestion', 'bug', 'reading', 'content', 'other'] },
              rating: { type: 'string', enum: ['none', 'helpful', 'mixed', 'unhelpful'], default: 'none' },
              message: { type: 'string', maxLength: 3000, default: '' },
              contact: {
                type: 'string',
                maxLength: 254,
                description: 'Optional email address; omit or send an empty string for no contact.',
              },
              shareContext: { type: 'boolean', default: false },
              excerpt: { type: 'string', maxLength: 8000, default: '' },
            },
            ['id', 'page', 'locale', 'category'],
          ),
        },
      },
    },
    responses: {
      200: { description: 'Saved receipt: {id, saved:true}.' },
      403: { description: 'Origin rejected.' },
      409: { description: 'Receipt ID already used with different content.' },
      413: { description: 'JSON body exceeds 48,000 bytes.' },
      422: { description: 'Invalid input; provide a note or rating and explicit consent for any excerpt.' },
      429: { description: 'Submission limit reached.' },
      503: { description: 'Feedback storage unavailable.' },
    },
  },
};
paths['/api/v1/daily'] = JSON.parse(
  await readFile(new URL('./schemas/daily-path.json', import.meta.url), 'utf8'),
);
paths['/api/v1/capabilities'] = {
  get: {
    operationId: 'get_capabilities',
    summary: 'Discover Wenbu endpoints, MCP tools, prompts and conventions',
    description: 'Public versioned capability manifest. No personal data, model request or account access.',
    responses: {
      200: {
        description: 'Current product capabilities',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: [
                'schemaVersion',
                'version',
                'endpoints',
                'mcp',
                'conventions',
                'privacy',
                'evidence',
              ],
              properties: {
                schemaVersion: { const: 'wenbu-capabilities-1' },
                version: { type: 'string' },
                endpoints: { type: 'object' },
                mcp: { type: 'object' },
                conventions: { type: 'object' },
                privacy: { type: 'object' },
                evidence: { type: 'object' },
              },
            },
          },
        },
      },
      429: { description: 'Rate limited; back off.' },
    },
  },
};
await writeFile(
  'public/agent-request.schema.json',
  JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://wenbu.app/agent-request.schema.json',
      title: 'Wenbu Agent turn',
      ...agentSchema,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'public/openapi.json',
  JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'Wenbu · 问卜',
        version,
        description: 'Free, transparent cultural calculation tools. No predictive validity claims.',
        license: { name: 'MIT', identifier: 'MIT' },
      },
      servers: [{ url: 'https://wenbu.app' }],
      paths,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'public/context.schema.json',
  JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://wenbu.app/context.schema.json',
      title: 'Wenbu user-selected context',
      type: 'object',
      additionalProperties: false,
      required: [
        'schema',
        'version',
        'kind',
        'createdAt',
        'calculation',
        'question',
        'selectedContext',
        'birthDetailsIncluded',
        'instructions',
      ],
      properties: {
        schema: {
          enum: ['https://wenbu.app/context.schema.json', 'https://wenbu.genedai.me/context.schema.json'],
        },
        version: { const: 1 },
        kind: { enum: Object.keys(schemas) },
        createdAt: { type: 'string', format: 'date-time' },
        calculation: {
          type: 'object',
          description:
            'Calculation output. Original birth fields only when deliberately included. Symbols themselves may still be identifying.',
        },
        question: { type: 'string', maxLength: 600 },
        selectedContext: { type: 'string', maxLength: 1600 },
        birthDetailsIncluded: { type: 'boolean' },
        instructions: { type: 'string' },
      },
    },
    null,
    2,
  ) + '\n',
);
