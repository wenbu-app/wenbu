import { z } from 'zod';
import { birthSchema, castSchema, localeSchema, ziweiSchema } from '../src/lib/schema';
import { calculate } from '../src/lib/tools';
import type { Reading } from '../src/lib/tools';
import { tarotDeck } from '../src/data/tarot';
import type { ReadingInput } from '../src/lib/agent-protocol';
import { reportVisualSchema } from '../src/lib/agent-report';

export const agentBirthSchema = birthSchema.safeExtend({ timezone: z.string().trim().min(1).max(80) });

export const readingInputSchema = z
  .object({
    kind: z.enum(['bazi', 'iching', 'tarot', 'ziwei']),
    input: z.unknown(),
  })
  .strict();
const profile = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    timezone: z.string().trim().min(1).max(80),
    dayBoundary: z.enum(['midnight', 'zi']),
    solarTime: z.boolean(),
    longitude: z.number().min(-180).max(180).optional(),
    sex: z.enum(['male', 'female']).optional(),
  })
  .strict();
export const reportSchema = z
  .object({
    title: z.string().min(1).max(100),
    summary: z.string().min(1).max(450),
    sections: z
      .array(
        z
          .object({
            heading: z.string().min(1).max(100),
            body: z.string().min(1).max(700),
            sourceIds: z.array(z.string().max(120)).max(6).default([]),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    questions: z
      .array(z.string().max(100))
      .max(3)
      .default([])
      .describe(
        'Clickable follow-up messages written from the user’s perspective. Use specific requests, not questions addressed to the user or either-or choices. Example: Explain this with a hypothetical chart. Omit when unnecessary.',
      ),
    visual: reportVisualSchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.summary.length +
        v.sections.reduce((n, s) => n + s.heading.length + s.body.length, 0) +
        v.questions.join('').length +
        (v.visual
          ? v.visual.title.length +
            v.visual.note.length +
            v.visual.items.reduce((n, item) => n + item.label.length + item.detail.length, 0)
          : 0) <=
      1800,
    { message: 'Keep the report concise (under 1200 Chinese characters or 1800 Latin characters).' },
  );

export const agentRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(3000),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(7000),
          })
          .strict(),
      )
      .max(16)
      .default([]),
    context: z
      .object({
        note: z.string().max(5000).default(''),
        birth: profile.optional(),
        readings: z.array(readingInputSchema).max(6).default([]),
        reports: z.array(reportSchema).max(2).default([]),
        sourceIds: z.array(z.string().max(120)).max(12).default([]),
      })
      .strict()
      .default({ note: '', readings: [], reports: [], sourceIds: [] }),
    mode: z.enum(['explore', 'research']).default('explore'),
    newDraw: z.boolean().default(false),
    locale: localeSchema,
    consent: z.literal(true),
  })
  .strict()
  .refine((v) => v.history.reduce((n, m) => n + m.content.length, 0) <= 28000, {
    message: 'Conversation history exceeds the context budget.',
  });
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export function restoreReading(ref: ReadingInput): Reading {
  if (ref.kind === 'bazi') return calculate('bazi', agentBirthSchema.parse(ref.input));
  if (ref.kind === 'ziwei') return calculate('ziwei', ziweiSchema.parse(ref.input));
  if (ref.kind === 'iching')
    return calculate('iching', castSchema.required({ lines: true }).parse(ref.input));
  const data = z
    .object({
      cards: z
        .array(
          z
            .object({
              id: z.number().int().min(0).max(77),
              reversed: z.boolean(),
            })
            .strict(),
        )
        .min(1)
        .max(3),
    })
    .strict()
    .parse(ref.input);
  if (![1, 3].includes(data.cards.length) || new Set(data.cards.map((c) => c.id)).size !== data.cards.length)
    throw new Error('The original one or three distinct cards are required.');
  return {
    kind: 'tarot',
    version: 'wenbu-tarot-1.0',
    cards: data.cards.map((c, i) => ({
      ...tarotDeck[c.id],
      reversed: c.reversed,
      position: data.cards.length === 1 ? 'reflection' : ['situation', 'tension', 'next-step'][i],
    })),
    method: {
      name: 'restored-original-cards',
      deckSize: 78,
      reversals: data.cards.some((c) => c.reversed),
      spread: data.cards.length === 1 ? 'one-card' : 'situation-tension-next-step',
      source: 'https://www.gutenberg.org/ebooks/43548',
      note: 'User-selected original cards; identities verified against the 78-card deck. No new draw.',
    },
  };
}
