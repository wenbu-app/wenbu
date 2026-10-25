import { z } from 'zod';
const object = z.looseObject({});
const card = z.looseObject({
  id: z.number().int().min(0).max(77),
  zh: z.string(),
  en: z.string(),
  reversed: z.boolean(),
  position: z.string(),
});
const tarot = {
  kind: z.literal('tarot'),
  version: z.string(),
  cards: z.array(card).min(1).max(3),
  method: z.looseObject({
    deckSize: z.literal(78),
    reversals: z.boolean(),
    spread: z.string(),
    source: z.string(),
  }),
};
const hexagram = z.looseObject({
  number: z.number().int().min(1).max(64),
  bits: z.string().regex(/^[01]{6}$/),
  zh: z.string(),
  en: z.string(),
});
export const mcpOutputSchemas: Record<string, Record<string, z.ZodType>> = {
  calculate_bazi: {
    kind: z.literal('bazi'),
    version: z.string(),
    input: z.looseObject({
      date: z.string(),
      time: z.string().nullable(),
      timezone: z.string(),
      dayBoundary: z.enum(['midnight', 'zi']),
    }),
    calendar: z.looseObject({
      lunar: z.string(),
      instant: z.string().nullable(),
      timezoneAssumed: z.boolean(),
      zodiacConvention: z.literal('lunar-new-year'),
      yearPillarZodiac: z.string(),
    }),
    pillars: z
      .array(z.looseObject({ key: z.enum(['year', 'month', 'day', 'hour']), value: z.string().nullable() }))
      .length(4),
    dayMaster: object,
    elements: z
      .array(z.looseObject({ zh: z.string(), en: z.string(), count: z.number().int().nonnegative() }))
      .length(5),
    warnings: z.array(z.string()),
    method: object,
  },
  cast_iching: {
    kind: z.literal('iching'),
    version: z.string(),
    lines: z.array(z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)])).length(6),
    moving: z.array(z.number().int().min(1).max(6)),
    original: hexagram,
    changed: hexagram,
    method: object,
  },
  draw_tarot: tarot,
  calculate_ziwei: {
    kind: z.literal('ziwei'),
    version: z.string(),
    input: object,
    lunarDate: z.string(),
    time: z.string(),
    fiveElementsClass: z.string(),
    soul: z.string(),
    body: z.string(),
    palaces: z
      .array(
        z.looseObject({
          name: z.string(),
          stem: z.string(),
          branch: z.string(),
          stars: z.array(object),
          supporting: z.array(z.string()),
        }),
      )
      .length(12),
    method: object,
  },
  search_library: {
    results: z
      .array(
        z.looseObject({
          id: z.string(),
          title: z.string(),
          url: z.string(),
          kind: z.string(),
          level: z.string(),
          snippet: z.string(),
          nextTool: z.string().nullable(),
          nextAction: z.string(),
        }),
      )
      .max(8),
  },
  read_library: {
    source: z.looseObject({ id: z.string(), title: z.string(), url: z.string(), readAt: z.string() }),
    documentId: z.string(),
    content: z.string(),
    format: z.enum(['text/plain', 'text/markdown']),
    scope: z.enum(['full', 'section']),
    section: z.string().nullable(),
    truncated: z.literal(false),
    outline: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
    links: object.optional(),
  },
  get_daily_card: {
    scope: z.literal('public'),
    clock: z.object({ date: z.string(), timezone: z.string(), serverNow: z.number(), nextAt: z.number() }),
    result: z.looseObject({
      ...tarot,
      cards: z.array(card.extend({ reversed: z.literal(false) })).length(1),
      daily: z.object({ version: z.string(), date: z.string(), timezone: z.string() }),
    }),
    practice: z.object({ action: z.string(), question: z.string() }),
    note: z.string(),
  },
};
