import { articles, type Article } from '../data/articles';
import { guideDepth, handbookUpdated } from '../data/guide-depth';
import type { Locale } from './schema';

export const knowledgeOrigin = 'https://wenbu.app';
export function knowledgeLinks(slug: string, locale: Locale) {
  return {
    html: `${knowledgeOrigin}/${locale === 'en' ? 'en/' : ''}learn/${slug}/`,
    markdown: `${knowledgeOrigin}/knowledge/${locale}/${slug}.md`,
    json: `${knowledgeOrigin}/knowledge/${locale}/${slug}.json`,
  };
}
export function guideSources(article: Article) {
  const enriched = guideDepth[article.slug]?.sources ?? [];
  const merged = new Map<string, { title: string; url: string; noteZh?: string; noteEn?: string }>(
    [...enriched, ...article.sources].map((s) => [s.url, s]),
  );
  // Keep scope annotations when a legacy source is already present in the expanded guide.
  for (const s of enriched) merged.set(s.url, s);
  return [...merged.values()];
}
export function guideOutline(article: Article, locale: Locale) {
  const d = guideDepth[article.slug]?.[locale];
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const parts = article[locale].sections.map((s, i) => ({ id: `section-${i}`, title: s.heading }));
  if (!d) return parts;
  return [
    { id: 'quick-answer', title: t('先把结论说清楚', 'The short answer') },
    ...parts.slice(0, 2),
    { id: 'reference-table', title: d.table.title },
    ...parts.slice(2),
    { id: 'worked-example', title: d.example.title },
    { id: 'glossary', title: t('读懂这些词', 'Key terms') },
    { id: 'questions', title: t('常见问题', 'Common questions') },
    { id: 'sources', title: t('来源与适用范围', 'Sources and their scope') },
  ];
}
export function knowledgeDocument(article: Article, locale: Locale) {
  const depth = guideDepth[article.slug];
  return {
    schemaVersion: 'wenbu-knowledge-v1',
    id: `guide-${article.slug}`,
    slug: article.slug,
    language: locale === 'zh' ? 'zh-Hans' : 'en',
    ...article[locale],
    updated: article.updated ?? (depth ? handbookUpdated : '2026-09-29'),
    authorship: 'Wenbu · AI-assisted editorial; no independent expert review claimed',
    evidenceType: 'editorial',
    links: knowledgeLinks(article.slug, locale),
    outline: guideOutline(article, locale),
    ...(depth ? depth[locale] : {}),
    sources: guideSources(article).map((s) => ({
      title: s.title,
      url: s.url,
      scope:
        s.noteZh && s.noteEn
          ? locale === 'zh'
            ? s.noteZh
            : s.noteEn
          : locale === 'zh'
            ? '进一步阅读；不代表验证了现实预测。'
            : 'Further reading; not validation of real-world predictions.',
    })),
  };
}
export function guideMarkdown(article: Article, locale: Locale, section?: string) {
  const doc = knowledgeDocument(article, locale);
  const depth = guideDepth[article.slug]?.[locale];
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const blocks = new Map<string, string>();
  if (depth)
    blocks.set(
      'quick-answer',
      `## ${t('先把结论说清楚', 'The short answer')}\n\n${depth.answer}\n\n${depth.takeaways.map((x) => '- ' + x).join('\n')}\n\n**${depth.figure.caption}**\n\n${depth.figure.description}`,
    );
  for (const [i, s] of article[locale].sections.entries())
    blocks.set(
      `section-${i}`,
      `## ${s.heading}\n\n${s.paragraphs.join('\n\n')}${s.bullets ? '\n\n' + s.bullets.map((x) => '- ' + x).join('\n') : ''}`,
    );
  if (depth) {
    const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const row = (r: string[]) => '| ' + r.map(cell).join(' | ') + ' |';
    blocks.set(
      'reference-table',
      `## ${depth.table.title}\n\n${[row(depth.table.columns), row(depth.table.columns.map(() => '---')), ...depth.table.rows.map(row)].join('\n')}`,
    );
    blocks.set(
      'worked-example',
      `## ${depth.example.title}\n\n${depth.example.intro}\n\n${depth.example.steps.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}\n\n${depth.example.conclusion}`,
    );
    blocks.set(
      'glossary',
      `## ${t('读懂这些词', 'Key terms')}\n\n${depth.glossary.map((g) => `**${g.term}** — ${g.definition}`).join('\n\n')}`,
    );
    blocks.set(
      'questions',
      `## ${t('常见问题', 'Common questions')}\n\n${depth.faq.map((f) => `### ${f.question}\n\n${f.answer}`).join('\n\n')}`,
    );
  }
  blocks.set(
    'sources',
    `## ${t('来源与适用范围', 'Sources and their scope')}\n\n${doc.sources.map((s) => `- [${s.title}](${s.url}) — ${s.scope}`).join('\n')}`,
  );
  if (section && !blocks.has(section))
    throw new Error('Unknown section. Use an ID from the document outline.');
  const selected = section
    ? [blocks.get(section)!]
    : [
        ...guideOutline(article, locale)
          .map((s) => blocks.get(s.id))
          .filter(Boolean),
      ];
  return `# ${doc.title}\n\n${doc.description}\n\n${t('原文', 'Canonical')}: ${doc.links.html}${section ? '#' + section : ''}\n${t('更新', 'Updated')}: ${doc.updated}\n${t('编写', 'Authorship')}: Wenbu · ${t('AI 辅助编辑', 'AI-assisted editorial')}\n\n${selected.join('\n\n')}`;
}
export function guideMinutes(article: Article, locale: Locale) {
  if (!guideDepth[article.slug]) return article.minutes;
  const text = guideMarkdown(article, locale);
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const words = (text.replace(/https?:\/\/\S+/g, '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []).length;
  return Math.max(3, Math.ceil(cjk / 380 + words / 210));
}
export function knowledgeIndex() {
  return {
    schemaVersion: 'wenbu-knowledge-index-v1',
    updated: articles
      .filter((a) => a.category === 'learn')
      .reduce((latest, a) => (a.updated && a.updated > latest ? a.updated : latest), handbookUpdated),
    description:
      'Public editorial guides, not personal context. Each translation has complete Markdown and JSON. Sources distinguish calculation, tradition and editorial guidance.',
    guides: articles
      .filter((a) => a.category === 'learn')
      .map((a) => ({
        id: `guide-${a.slug}`,
        slug: a.slug,
        tool: a.tool,
        translations: (['zh', 'en'] as const).map((locale) => ({
          locale,
          title: a[locale].title,
          description: a[locale].description,
          ...knowledgeLinks(a.slug, locale),
        })),
      })),
  };
}
