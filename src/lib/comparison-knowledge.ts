import { comparisons, type Comparison } from '../data/comparisons';
import type { Locale } from './schema';

const origin = 'https://wenbu.app';
export function comparisonLinks(slug: string, locale: Locale) {
  return {
    html: `${origin}/${locale === 'en' ? 'en/' : ''}compare/${slug}/`,
    markdown: `${origin}/knowledge/${locale}/compare-${slug}.md`,
    json: `${origin}/knowledge/${locale}/compare-${slug}.json`,
  };
}
export function comparisonCheckedNote(comparison: Comparison, locale: Locale) {
  return locale === 'zh'
    ? `公开资料核验：${comparison.reviewed}。根据官方公开页面比较，未测试登录后或付费体验。`
    : `Public pages checked ${comparison.reviewed}. This comparison uses official sources; paid and signed-in features have not been tested.`;
}
export function comparisonSources(comparison: Comparison, locale: Locale) {
  const prefix = locale === 'en' ? '/en/' : '/';
  return [
    ...comparison.sources,
    {
      title: 'Wenbu · ' + (locale === 'zh' ? '计算方法' : 'Methodology'),
      url: origin + prefix + 'methodology/',
    },
    {
      title: 'Wenbu · ' + (locale === 'zh' ? '免费使用说明' : 'Free-use policy'),
      url: origin + prefix + 'free/',
    },
  ];
}
export function comparisonSections(comparison: Comparison, locale: Locale) {
  const e = comparison[locale];
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const row = (cells: string[]) =>
    '| ' + cells.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |';
  return [
    {
      id: 'comparison-workflow',
      title: t('先比较使用方式', 'Compare the workflow first'),
      content: e.intro + '\n\n' + comparisonCheckedNote(comparison, locale),
    },
    {
      id: 'comparison-table',
      title: t('产品功能对比', 'Product comparison'),
      content: [
        row([t('维度', 'Dimension'), 'Wenbu', locale === 'zh' ? comparison.nameZh : comparison.nameEn]),
        row(['---', '---', '---']),
        ...e.rows.map(row),
      ].join('\n'),
    },
    { id: 'comparison-choice', title: t('怎样选', 'Making a choice'), content: e.conclusion },
    {
      id: 'comparison-sources',
      title: t('来源与适用范围', 'Sources and their scope'),
      content: comparisonSources(comparison, locale)
        .map((s) => `- [${s.title}](${s.url})`)
        .join('\n'),
    },
  ];
}
export function comparisonOutline(comparison: Comparison, locale: Locale) {
  return comparisonSections(comparison, locale).map(({ id, title }) => ({ id, title }));
}
export function comparisonMarkdown(comparison: Comparison, locale: Locale, section?: string) {
  const sections = comparisonSections(comparison, locale);
  if (section && !sections.some((s) => s.id === section))
    throw new Error('Unknown section. Use an ID from the document outline.');
  const e = comparison[locale],
    links = comparisonLinks(comparison.slug, locale);
  return [
    '# ' + e.title,
    e.description,
    `${locale === 'zh' ? '原文' : 'Canonical'}: ${links.html}${section ? '#' + section : ''}`,
    comparisonCheckedNote(comparison, locale),
    locale === 'zh'
      ? '编写：Wenbu · AI 辅助编辑。资料链接不代表在本次读取中重新核验过外部页面；未比较预测准确率。'
      : 'Authorship: Wenbu · AI-assisted editorial. Listed sources have not been fetched again by this read; predictive accuracy was not compared.',
    ...sections.filter((s) => !section || s.id === section).map((s) => `## ${s.title}\n\n${s.content}`),
    ...(!section
      ? [
          `[${locale === 'zh' ? '选一个适合的工具' : 'Find your starting point'}](${origin}/${locale === 'en' ? 'en/' : ''}learn/choose-a-tool/)`,
        ]
      : []),
  ].join('\n\n');
}
export function comparisonDocument(comparison: Comparison, locale: Locale) {
  return {
    schemaVersion: 'wenbu-knowledge-v1',
    id: `guide-compare-${comparison.slug}`,
    slug: `compare-${comparison.slug}`,
    category: 'compare' as const,
    language: locale === 'zh' ? 'zh-Hans' : 'en',
    ...comparison[locale],
    updated: comparison.reviewed,
    reviewed: comparison.reviewed,
    reviewScope: comparisonCheckedNote(comparison, locale),
    authorship: 'Wenbu · AI-assisted editorial; no independent expert review claimed',
    evidenceType: 'editorial',
    scope: 'full',
    truncated: false,
    links: comparisonLinks(comparison.slug, locale),
    outline: comparisonOutline(comparison, locale),
    sources: comparisonSources(comparison, locale),
    content: comparisonMarkdown(comparison, locale),
  };
}
export function comparisonIndex() {
  return comparisons.map((comparison) => ({
    id: `guide-compare-${comparison.slug}`,
    slug: `compare-${comparison.slug}`,
    tool: 'agent',
    category: 'compare',
    translations: (['zh', 'en'] as const).map((locale) => ({
      locale,
      title: comparison[locale].title,
      description: comparison[locale].description,
      ...comparisonLinks(comparison.slug, locale),
    })),
  }));
}
