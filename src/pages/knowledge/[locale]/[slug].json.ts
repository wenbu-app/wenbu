import { articles, type Article } from '../../../data/articles';
import { knowledgeDocument } from '../../../lib/knowledge';
import type { Locale } from '../../../lib/schema';
import { comparisons, type Comparison } from '../../../data/comparisons';
import { comparisonDocument } from '../../../lib/comparison-knowledge';
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
  const document = props.comparison
    ? comparisonDocument(props.comparison, props.locale)
    : knowledgeDocument(props.article!, props.locale);
  return new Response(JSON.stringify(document, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
