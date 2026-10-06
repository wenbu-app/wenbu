import { z } from 'zod';
import { calculate, type Reading } from '../src/lib/tools';
import { castSchema, tarotSchema, ziweiSchema, type Locale } from '../src/lib/schema';
import type { AgentEvent, AgentSource, ReadingInput, ToolTrace } from '../src/lib/agent-protocol';
import { agentBirthSchema, reportSchema } from './agent-schema';
import { reportSourceIds } from '../src/lib/agent-report';
import { readLibrary, readReference, searchLibrary } from './agent-library';

const planSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            title: z.string().min(1).max(100),
            status: z.enum(['pending', 'active', 'complete']),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();
const searchSchema = z
  .object({ query: z.string().trim().min(1).max(160), limit: z.number().int().min(1).max(8).default(6) })
  .strict();
const readSchema = z.object({ id: z.string().min(1).max(120) }).strict();
const libraryReadSchema = readSchema.extend({ section: z.string().min(1).max(80).optional() });
const questionSchema = z
  .object({
    question: z.string().min(1).max(700),
    options: z.array(z.string().trim().min(1).max(160)).max(4).default([]),
    form: z.literal('birth').optional(),
    birthKind: z
      .enum(['bazi', 'ziwei'])
      .optional()
      .describe('For form=birth, name the requested calculation so only necessary fields are shown.'),
  })
  .strict();
const schemas = {
  update_plan: planSchema,
  calculate_bazi: agentBirthSchema,
  cast_iching: castSchema,
  draw_tarot: tarotSchema,
  calculate_ziwei: ziweiSchema,
  search_library: searchSchema,
  read_library: libraryReadSchema,
  read_reference: readSchema,
  ask_user: questionSchema,
  write_report: reportSchema,
};
const descriptions: Record<keyof typeof schemas, string> = {
  update_plan:
    'Show 2–5 concise user-visible task steps for a complex request and update progress. Not hidden reasoning. Use alongside real tools, not as a final answer.',
  calculate_bazi:
    'Calculate verified Four Pillars using Gregorian local birth date, explicit timezone and day convention. Never invent missing birth date/time. Unknown time can be null. Use shared birth context or ask_user. Does not predict life events.',
  cast_iching:
    'Actually cast cryptographically random six coin lines, or calculate supplied original lines (bottom-to-top 6/7/8/9). Only start a NEW cast if the user asks. Follow-up questions must use preserved verified results.',
  draw_tarot:
    'Actually draw 1 or 3 distinct cards from the complete 78-card deck. Only draw when requested or accepted by user. Follow-up questions use the preserved original cards, never redraw automatically.',
  calculate_ziwei:
    'Calculate verified Zi Wei twelve palaces with Gregorian local civil date, KNOWN time and sex as the traditional calculation parameter. If sex or time is missing ask_user; do not guess.',
  search_library:
    'Search Wenbu original guides, methodology, all hexagram/card notes and the curated source catalogue. This is catalogue search, NOT general web search. Use short focused queries. Returns IDs; search snippets alone are not fully read sources.',
  read_library:
    'Read an original Wenbu guide or symbol note by ID from search_library. Returns full Markdown, an outline, source scope and export URLs for handbook guides. Optionally supply a section ID from the outline for a focused read; cite only that section as read. These are modern editorial notes, not classical quotations. Reference IDs require read_reference.',
  read_reference:
    'Fetch and read a PUBLIC WEB excerpt of an exact reference ID from the curated catalogue. No arbitrary URLs or general internet search. Can fail for blocked, large, PDF or private pages. Failed references are NOT read and cannot be cited as reviewed.',
  ask_user:
    'Help clarify a vague question or ask for necessary missing information. Ask ONE focused question with 2–4 short, distinct answer options when useful (never invent user facts). The interface adds custom-answer and unsure controls. Reuse details already shared. Set form=birth only when birth data is required. This pauses the turn for the user; do not combine with other tools.',
  write_report:
    'Create a concise structured report in the results panel: 2–4 short sections, under 800 Chinese characters or 1500 Latin characters total, including summary/questions/visual. For a meaningful comparison or ordered procedure, include one optional visual: type comparison for 2–4 parallel alternatives, or steps for 2–4 ordered stages. Keep each visual item label short and its detail under 60 Chinese characters or 130 Latin characters. Preserve qualifications; never invent percentages, scores, evidence or causal order. Each visual item has its own sourceIds. Cite only source IDs returned by successfully read_library/read_reference calls or the verified source snapshot. Separate calculation facts, tradition and interpretation. Put material uncertainty and unfinished work in the summary as well as the relevant section. Use after gathering evidence. New calls create new report versions.',
};
const labels: Record<keyof typeof schemas, [string, string]> = {
  update_plan: ['整理探索步骤', 'Organize the approach'],
  calculate_bazi: ['计算八字命盘', 'Calculate Four Pillars'],
  cast_iching: ['起卦并核对六爻', 'Cast and verify the six lines'],
  draw_tarot: ['抽取塔罗牌', 'Draw tarot cards'],
  calculate_ziwei: ['计算紫微十二宫', 'Calculate Zi Wei palaces'],
  search_library: ['检索资料库', 'Search the library'],
  read_library: ['阅读资料', 'Read a library note'],
  read_reference: ['读取参考网页', 'Read a reference page'],
  ask_user: ['补充一个问题', 'Clarify one detail'],
  write_report: ['整理研究报告', 'Write the report'],
};
export const agentTools = Object.entries(schemas).map(([name, schema]) => {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' });
  delete jsonSchema.$schema;
  return {
    type: 'function',
    function: { name, description: descriptions[name as keyof typeof schemas], parameters: jsonSchema },
  };
});
export const toolLabel = (name: string, locale: Locale) =>
  labels[name as keyof typeof labels]?.[locale === 'zh' ? 0 : 1] ?? name;
export function readingInput(reading: Reading): ReadingInput {
  return {
    kind: reading.kind,
    input:
      reading.kind === 'tarot'
        ? { cards: reading.cards.map((c) => ({ id: c.id, reversed: c.reversed })) }
        : reading.kind === 'iching'
          ? { lines: reading.lines }
          : reading.input,
  };
}
type ToolContext = {
  locale: Locale;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
  sources: Map<string, AgentSource>;
  readings?: Reading[];
  allowNewDraw?: boolean;
  generatedRandom?: Set<string>;
};
export class CitationValidationError extends Error {
  readonly code = 'citation_unread' as const;
  constructor(readonly missingSourceIds: string[]) {
    super('A citation was not read or verified. Read its source first, or remove the unsupported citation.');
  }
}
export async function executeAgentTool(name: string, raw: unknown, ctx: ToolContext) {
  if (!(name in schemas) || !Object.hasOwn(schemas, name))
    throw new Error('Unknown tool. Use a listed capability.');
  const key = name as keyof typeof schemas;
  if (ctx.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const input = schemas[key].parse(raw);
  if (key === 'update_plan') {
    const { steps } = planSchema.parse(input);
    ctx.emit({ type: 'plan', steps });
    return { updated: true };
  }
  if (key === 'search_library') {
    const data = searchSchema.parse(input);
    return {
      results: searchLibrary(data.query, ctx.locale, data.limit),
      scope: 'Wenbu curated library and reference catalogue; not the whole web.',
    };
  }
  if (key === 'read_library' || key === 'read_reference') {
    const { id, section } = libraryReadSchema.parse(input);
    const doc =
      key === 'read_library' ? readLibrary(id, ctx.locale, section) : await readReference(id, ctx.signal);
    ctx.sources.set(doc.source.id, doc.source);
    ctx.emit({ type: 'source', source: doc.source });
    return doc;
  }
  if (key === 'ask_user') {
    const question = questionSchema.parse(input);
    ctx.emit({ type: 'question', question });
    return { waitingForUser: true };
  }
  if (key === 'write_report') {
    const report = reportSchema.parse(input);
    const ids = reportSourceIds(report);
    const missing = ids.filter((id) => !ctx.sources.has(id));
    if (missing.length) throw new CitationValidationError(missing);
    const artifact = {
      ...report,
      type: 'report' as const,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    ctx.emit({ type: 'artifact', artifact });
    return {
      saved: true,
      reportId: artifact.id,
      title: artifact.title,
      instruction:
        'The report is visible in the results panel. Give a short conversational synthesis; do not repeat the entire report.',
    };
  }
  const kind = (
    { calculate_bazi: 'bazi', cast_iching: 'iching', draw_tarot: 'tarot', calculate_ziwei: 'ziwei' } as const
  )[key as 'calculate_bazi'];
  const randomKind = kind as string;
  if (randomKind === 'tarot' || randomKind === 'iching') {
    const previous = ctx.readings
      ?.slice()
      .reverse()
      .find((r) => r.kind === randomKind);
    if (previous && (!ctx.allowNewDraw || ctx.generatedRandom?.has(randomKind)))
      return {
        reusedOriginal: true,
        verifiedCalculation: previous,
        note: 'Preserved the existing result. A new draw requires an explicit user request.',
      };
  }
  const reading = calculate(kind, { ...input, locale: ctx.locale });
  ctx.readings?.push(reading);
  if (randomKind === 'tarot' || randomKind === 'iching') ctx.generatedRandom?.add(randomKind);
  const names = {
    bazi: ['八字命盘', 'Four Pillars'],
    iching: ['六爻卦象', 'I Ching cast'],
    tarot: ['塔罗牌阵', 'Tarot spread'],
    ziwei: ['紫微十二宫', 'Zi Wei chart'],
  };
  const artifact = {
    type: 'chart' as const,
    id: crypto.randomUUID(),
    title: names[kind][ctx.locale === 'zh' ? 0 : 1],
    createdAt: new Date().toISOString(),
    reading,
    input: readingInput(reading),
  };
  ctx.emit({ type: 'artifact', artifact });
  return { artifactId: artifact.id, verifiedCalculation: reading };
}
export function toolTrace(id: string, name: string, locale: Locale): ToolTrace {
  return { id, name, label: toolLabel(name, locale), status: 'running' };
}
