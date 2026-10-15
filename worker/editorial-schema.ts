import { z } from 'zod';
import type { EditorialTopic } from '../src/data/editorial-topics';

const text = z.string().trim().min(1).max(3500);
const ids = z
  .array(z.string().regex(/^[a-z][a-zA-Z0-9-]{0,70}$/))
  .min(1)
  .max(6);
const edition = z
  .object({
    title: text.max(160),
    description: text.max(350),
    answer: text.min(80),
    takeaways: z.array(text).min(3).max(5),
    sections: z
      .array(
        z
          .object({ heading: text.max(160), paragraphs: z.array(text.min(30)).min(2).max(5), sourceIds: ids })
          .strict(),
      )
      .min(4)
      .max(7),
    figure: z
      .object({
        title: text.max(160),
        caption: text,
        steps: z
          .array(z.object({ label: text.max(90), detail: text.max(500) }).strict())
          .min(3)
          .max(6),
      })
      .strict(),
    table: z
      .object({
        title: text.max(160),
        columns: z.array(text.max(110)).min(2).max(4),
        rows: z
          .array(z.array(text.max(650)).min(2).max(4))
          .min(4)
          .max(9),
        sourceIds: ids,
      })
      .strict(),
    example: z
      .object({ title: text.max(160), intro: text, steps: z.array(text).min(4).max(7), conclusion: text })
      .strict(),
    faq: z
      .array(z.object({ question: text.max(180), answer: text.min(40) }).strict())
      .min(3)
      .max(5),
    glossary: z
      .array(z.object({ term: text.max(90), definition: text }).strict())
      .min(3)
      .max(6),
    cta: z.object({ label: text.max(100), reason: text }).strict(),
  })
  .strict();
export const editorialDraftSchema = z.object({ zh: edition, en: edition }).strict();
export type EditorialDraft = z.infer<typeof editorialDraftSchema>;
export type EditorialEdition = EditorialDraft['en'];
export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  role: string;
  fetchedAt: string;
  hash: string;
  excerpt: string;
  truncated: boolean;
};
export type EditorialDocument = EditorialDraft & {
  topic: EditorialTopic;
  sources: Omit<ResearchSource, 'excerpt'>[];
  publishedAt: string;
  updatedAt: string;
  revision: string;
  review: {
    factual: boolean;
    bilingual: boolean;
    useful: boolean;
    original: boolean;
    natural: boolean;
    issues: string[];
  };
};

export const editorialReviewSchema = z
  .object({
    factual: z.boolean(),
    bilingual: z.boolean(),
    useful: z.boolean(),
    original: z.boolean(),
    natural: z.boolean(),
    issues: z.array(z.string().max(400)).max(15),
  })
  .strict();

export function editionText(e: EditorialEdition) {
  return [
    e.title,
    e.description,
    e.answer,
    ...e.takeaways,
    ...e.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
    e.figure.title,
    e.figure.caption,
    ...e.figure.steps.flatMap((s) => [s.label, s.detail]),
    e.table.title,
    ...e.table.columns,
    ...e.table.rows.flat(),
    e.example.title,
    e.example.intro,
    ...e.example.steps,
    e.example.conclusion,
    ...e.faq.flatMap((f) => [f.question, f.answer]),
    ...e.glossary.flatMap((g) => [g.term, g.definition]),
  ].join('\n\n');
}
export function draftIssues(draft: EditorialDraft, sources: ResearchSource[], topic: EditorialTopic) {
  const issues: string[] = [];
  const allowed = new Set(sources.map((s) => s.id));
  for (const locale of ['zh', 'en'] as const) {
    const e = draft[locale],
      full = editionText(e);
    if (
      locale === 'zh' ? (full.match(/[\u3400-\u9fff]/g) ?? []).length < 1500 : full.split(/\s+/).length < 850
    )
      issues.push(`${locale}:insufficient_depth`);
    if (e.table.rows.some((row) => row.length !== e.table.columns.length))
      issues.push(`${locale}:table_width`);
    for (const s of [...e.sections, e.table])
      if (s.sourceIds.some((id) => !allowed.has(id))) issues.push(`${locale}:unread_source`);
    if (new Set(e.sections.map((s) => s.heading.toLowerCase())).size !== e.sections.length)
      issues.push(`${locale}:repeated_heading`);
    if (/https?:\/\/|<\/?[a-z]|\bTODO\b|\bTBD\b|待补|待核实来源/i.test(full))
      issues.push(`${locale}:unsafe_or_placeholder_text`);
    if (
      /保证.{0,8}(准确|预测|转运)|百分之百|100% accura|guaranteed.{0,15}(prediction|ranking)|scientifically proven.{0,30}(tarot|astrology)/i.test(
        full,
      )
    )
      issues.push(`${locale}:unsupported_claim`);
    const paras = e.sections.flatMap((s) => s.paragraphs);
    if (new Set(paras).size !== paras.length) issues.push(`${locale}:repeated_paragraph`);
  }
  if (
    draft.zh.sections.length !== draft.en.sections.length ||
    draft.zh.table.rows.length !== draft.en.table.rows.length
  )
    issues.push('bilingual_structure');
  if (topic.category === 'compare' && !sources.some((s) => new URL(s.url).hostname !== 'wenbu.app'))
    issues.push('comparison_without_vendor_source');
  return [...new Set(issues)];
}

export function shanghaiDay(time: number) {
  return new Date(time + 8 * 3600_000).toISOString().slice(0, 10);
}
export function publicationSlot(time: number) {
  const local = new Date(time + 8 * 3600_000),
    hour = local.getUTCHours();
  return `${shanghaiDay(time)}-${hour >= 21 ? '21' : hour >= 15 ? '15' : '09'}`;
}
export const pathForTopic = (topic: Pick<EditorialTopic, 'category' | 'slug'>) =>
  `${topic.category}/${topic.slug}`;
export async function contentHash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
