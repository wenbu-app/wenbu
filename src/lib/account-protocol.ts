import { z } from 'zod';

export const RECORD_BYTES = 256 * 1024;
export const ACCOUNT_BYTES = 10 * 1024 * 1024;
export const TRANSFER_BYTES = 1024 * 1024;
export const recordId = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const recordKind = z.enum(['journal', 'session']);
export type RecordKind = z.infer<typeof recordKind>;
const text = z.string().max(100000);
const date = z.string().refine((v) => Number.isFinite(Date.parse(v)), 'Invalid date');
const reading = z.looseObject({ kind: z.enum(['bazi', 'ziwei', 'tarot', 'iching']) });
const answer = z.object({
  title: text,
  summary: text,
  observations: z.array(z.object({ basis: text, reflection: text })).max(100),
  nextSteps: z.array(text).max(100),
  question: text,
});
export const journalRecord = z
  .object({
    id: recordId,
    createdAt: date,
    kind: z.enum(['bazi', 'ziwei', 'tarot', 'iching']),
    result: reading,
    question: text,
    note: text,
    answer: answer.optional(),
    context: text.optional(),
    provenance: text.optional(),
    receipt: z.string().max(3000).optional(),
  })
  .refine((v) => v.kind === v.result.kind, 'Reading kind mismatch');
const source = z.object({
  id: text,
  title: text,
  url: z.url().refine((v) => /^https?:\/\//.test(v)),
  kind: z.enum(['guide', 'reference', 'symbol']),
  level: text,
  excerpt: text,
  readAt: date,
});
const tool = z.object({
  id: z.string().max(200),
  name: text,
  label: text,
  status: z.enum(['running', 'complete', 'error', 'stopped']),
  detail: text.optional(),
  issue: z.enum(['citation_unread', 'report_invalid']).optional(),
  artifactId: recordId.optional(),
  recovery: z.object({ toolId: z.string().min(1).max(200), artifactId: recordId }).optional(),
});
const artifact = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chart'),
    id: recordId,
    title: text,
    createdAt: date,
    reading,
    input: z.object({ kind: z.enum(['bazi', 'ziwei', 'tarot', 'iching']), input: z.unknown() }),
  }),
  z.object({
    type: z.literal('report'),
    id: recordId,
    title: text,
    createdAt: date,
    summary: text,
    sections: z.array(z.object({ heading: text, body: text, sourceIds: z.array(text).max(100) })).max(100),
    questions: z.array(text).max(100),
    visual: z.unknown().optional(),
  }),
]);
export const messageRecord = z.object({
  id: recordId,
  role: z.enum(['user', 'assistant']),
  text,
  status: z.enum(['complete', 'running', 'stopped', 'error', 'waiting', 'limited']),
  tools: z.array(tool).max(100),
  artifacts: z.array(artifact).max(100),
  sources: z.array(source).max(100),
  plan: z
    .array(z.object({ title: text, status: z.enum(['pending', 'active', 'complete']) }))
    .max(100)
    .optional(),
  question: z
    .object({ question: text, options: z.array(text).max(20), form: z.literal('birth').optional() })
    .optional(),
  model: text.optional(),
  error: text.optional(),
});
const birth = z.object({
  date: z.string().max(30),
  time: z.string().max(20).nullable(),
  timezone: z.string().max(100),
  dayBoundary: z.enum(['midnight', 'zi']),
  solarTime: z.boolean(),
  longitude: z.number().optional(),
  sex: z.enum(['male', 'female']).optional(),
});
export const sessionRecord = z.object({
  id: recordId,
  title: text,
  locale: z.enum(['zh', 'en']),
  updatedAt: date,
  mode: z.enum(['explore', 'research']),
  messages: z.array(messageRecord).max(160),
  context: z.object({
    note: text,
    birth: birth.optional(),
    useBirth: z.boolean(),
    journalIds: z.array(recordId).max(100),
  }),
  receipt: z.string().max(3000).optional(),
});
export const saveRecord = z
  .object({
    requestId: z.uuid(),
    revision: z.number().int().min(0),
    content: z.unknown(),
    source: z.enum(['current', 'legacy']).default('current'),
  })
  .strict();
export type CloudRecord = {
  kind: RecordKind;
  id: string;
  revision: number;
  updatedAt: number;
  content: unknown;
  provenance: string;
};
