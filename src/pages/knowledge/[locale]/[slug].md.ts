import { articles, type Article } from '../../../data/articles';
import { guideMarkdown } from '../../../lib/knowledge';
import type { Locale } from '../../../lib/schema';
import { comparisons, type Comparison } from '../../../data/comparisons';
import { comparisonMarkdown } from '../../../lib/comparison-knowledge';
export function getStaticPaths() {
  return [
    ...articles
      .filter((a) => a.category === 'learn')
      .flatMap((article) =>
        (['zh', 'en'] as const).map((locale) => ({
          params: { locale, slug: article.slug },
          props: { article, locale },
        })),
      ),
    ...comparisons.flatMap((comparison) =>
      (['zh', 'en'] as const).map((locale) => ({
        params: { locale, slug: `compare-${comparison.slug}` },
        props: { comparison, locale },
      })),
    ),
  ];
}
export function GET({ props }: { props: { article?: Article; comparison?: Comparison; locale: Locale } }) {
  const markdown = props.comparison
    ? comparisonMarkdown(props.comparison, props.locale)
    : guideMarkdown(props.article!, props.locale);
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
