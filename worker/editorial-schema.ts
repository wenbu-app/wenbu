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
    answerSourceIds: ids,
    evidence: z
      .array(
        z
          .object({
            claim: text.min(10),
            sourceId: z.string(),
            quote: text.min(4).max(220),
            kind: z.enum(['fact', 'tradition', 'editorial']),
          })
          .strict(),
      )
      .min(3)
      .max(10),
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
        sourceIds: ids,
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
      .object({
        title: text.max(160),
        intro: text,
        steps: z.array(text).min(4).max(7),
        conclusion: text,
        sourceIds: ids,
      })
      .strict(),
    faq: z
      .array(z.object({ question: text.max(180), answer: text.min(40), sourceIds: ids }).strict())
      .min(3)
      .max(5),
    glossary: z
      .array(z.object({ term: text.max(90), definition: text, sourceIds: ids }).strict())
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
    issues: z.array(z.string().max(2000)).max(30),
  })
  .strict();

function editionTextParts(e: EditorialEdition) {
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
    e.cta.label,
    e.cta.reason,
    ...e.evidence.map((item) => item.claim),
  ];
}
export function editionText(e: EditorialEdition) {
  return editionTextParts(e).join('\n\n');
}
function unfinishedArticleCopy(value: string) {
  const unwrap = (part: string) =>
    part
      .normalize('NFKC')
      .trim()
      .replace(/^[\s([{【「『“"']+|[\s)\]}】」』”"'。.!！?？…]+$/g, '');
  const field = unwrap(value);
  return (
    /^(?:(?:此处|正文|内容|段落|结论|示例|案例|图表|来源|引用|链接)[：:\s]*)?待补(?:充)?(?:[：:\s]*(?:正文|内容|段落|结论|示例|案例|图表|来源|引用|链接))?$/.test(
      field,
    ) ||
    value.split(/[。！？!?；;\n]/).some((sentence) => /^待补(?:充)?$/.test(unwrap(sentence))) ||
    /(?:此处|本段|本节|正文|内容|段落|章节)(?:暂)?(?:标为|写为)?[：:\s]*待补(?:充)?|待补(?:充)?(?:后续|余下|剩余)?(?:正文|内容|段落|章节|结论|示例|案例|图表|来源|引用|链接)/.test(
      value,
    )
  );
}
export function draftIssues(draft: EditorialDraft, sources: ResearchSource[], topic: EditorialTopic) {
  const issues: string[] = [];
  const allowed = new Set(sources.map((s) => s.id));
  for (const locale of ['zh', 'en'] as const) {
    const e = draft[locale],
      parts = editionTextParts(e),
      full = parts.join('\n\n');
    if (
      locale === 'zh' ? (full.match(/[\u3400-\u9fff]/g) ?? []).length < 1500 : full.split(/\s+/).length < 850
    )
      issues.push(`${locale}:insufficient_depth`);
    if (e.table.rows.some((row) => row.length !== e.table.columns.length))
      issues.push(`${locale}:table_width`);
    for (const s of [
      ...e.sections,
      e.table,
      e.figure,
      e.example,
      ...e.faq,
      ...e.glossary,
      { sourceIds: e.answerSourceIds },
    ])
      if (s.sourceIds.some((id) => !allowed.has(id))) issues.push(`${locale}:unread_source`);
    const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
    for (const evidence of e.evidence) {
      const source = sources.find((s) => s.id === evidence.sourceId);
      if (!source || !normalize(source.excerpt).includes(normalize(evidence.quote)))
        issues.push(`${locale}:unverified_evidence_quote`);
    }
    if (new Set(e.sections.map((s) => s.heading.toLowerCase())).size !== e.sections.length)
      issues.push(`${locale}:repeated_heading`);
    // A reader's missing-input status is not unfinished article copy. Check
    // each rendered field for actual scaffolding; never join field boundaries
    // or alter the text sent to the independent factual/originality review.
    if (/https?:\/\/|<\/?[a-z]|\bTODO\b|\bTBD\b|待核实来源/i.test(full) || parts.some(unfinishedArticleCopy))
      issues.push(`${locale}:unsafe_or_placeholder_text`);
    if (
      /(?<!不|无法|不能|不会)保证[^，。！？;\n]{0,8}(准确|预测|转运)|百分之百|100% accura|(?<!not |no )guaranteed.{0,15}(prediction|ranking)|(?<!not )scientifically proven.{0,30}(tarot|astrology)/i.test(
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
  if (topic.category === 'learn' && topic.slug.startsWith('compare-')) issues.push('reserved_slug_prefix');
  for (const source of sources)
    if (new URL(source.url).hostname !== 'wenbu.app') {
      const quotes = [...draft.zh.evidence, ...draft.en.evidence]
        .filter((e) => e.sourceId === source.id)
        .map((e) => e.quote)
        .join(' ');
      if ((quotes.match(/[\u3400-\u9fff]|[^\s\u3400-\u9fff]+/gu) ?? []).length > 20)
        issues.push('external_quote_budget');
      if (
        topic.category === 'compare' &&
        ![...draft.zh.evidence, ...draft.en.evidence].some((e) => e.sourceId === source.id)
      )
        issues.push('vendor_claim_evidence_missing');
    }
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
