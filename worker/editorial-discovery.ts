import { guideOutline, guideMarkdown } from '../src/lib/knowledge';
import { articles } from '../src/data/articles';
import { contentHash, pathForTopic } from './editorial-schema';
import {
  editorialMarkdown,
  originalComparisonMarkdown,
  assetRequest,
  editorialIdentity,
  editorialSectionId,
} from './editorial-render';
import { publishedDocuments } from './editorial-store';
import type { Env } from './types';
import { readLibrary } from './agent-library';
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
export async function mergePublishedManifest<
  T extends { version: number; origin: string; revision: string; pages: { url: string; hash: string }[] },
>(env: Env, manifest: T) {
  if (env.EDITORIAL_ENABLED !== 'true') return manifest;
  const docs = await publishedDocuments(env);
  if (!docs.length) return manifest;
  const pages = new Map(manifest.pages.map((p) => [p.url, p]));
  for (const doc of docs)
    for (const lang of ['zh', 'en'] as const) {
      const url = `${env.SITE_URL}/${lang === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/`;
      pages.set(url, { url, hash: await contentHash(doc.revision + ':' + lang) });
    }
  const sorted = [...pages.values()].sort((a, b) => a.url.localeCompare(b.url, 'en'));
  return {
    ...manifest,
    staticRevision: manifest.revision,
    revision: await contentHash(JSON.stringify(sorted)),
    pages: sorted,
  };
}
export async function editorialDiscovery(request: Request, env: Env): Promise<Response | null> {
  if (env.EDITORIAL_ENABLED !== 'true' || !env.ANALYTICS || !['GET', 'HEAD'].includes(request.method))
    return null;
  const path = new URL(request.url).pathname;
  if (
    ![
      '/sitemap.xml',
      '/indexnow-manifest.json',
      '/knowledge/index.json',
      '/llms.txt',
      '/llms-full.txt',
      '/feed.xml',
      '/en/feed.xml',
    ].includes(path)
  )
    return null;
  const docs = await publishedDocuments(env);
  if (!docs.length) return null;
  const source = await env.ASSETS.fetch(assetRequest(request));
  if (!source.ok) return null;
  let text = await source.text();
  const headers = new Headers(source.headers);
  headers.set('Cache-Control', 'public, max-age=60');
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.delete('Last-Modified');
  if (path === '/indexnow-manifest.json')
    text = JSON.stringify(await mergePublishedManifest(env, JSON.parse(text)));
  else if (path === '/sitemap.xml') {
    for (const doc of docs)
      for (const lang of ['zh', 'en']) {
        const url = `${env.SITE_URL}/${lang === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/`;
        const existing = new RegExp(
          '<url>\\s*<loc>' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</loc>[\\s\\S]*?</url>',
          'g',
        );
        text = text.replace(existing, '');
        text = text.replace(
          '</urlset>',
          `<url><loc>${xml(url)}</loc><lastmod>${doc.updatedAt.slice(0, 10)}</lastmod></url></urlset>`,
        );
      }
  } else if (path === '/knowledge/index.json') {
    const index = JSON.parse(text),
      entries = docs.flatMap((doc) =>
        (['zh', 'en'] as const).map((lang) => ({
          id: `editorial-${doc.topic.id}`,
          slug: `${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}`,
          locale: lang,
          ...editorialIdentity(doc, lang),
          html: `${env.SITE_URL}/${lang === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/`,
          markdown: `${env.SITE_URL}/knowledge/${lang}/${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}.md`,
          json: `${env.SITE_URL}/knowledge/${lang}/${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}.json`,
          updated: doc.updatedAt,
          scope: 'full',
        })),
      );
    index.editorial = entries;
    for (const doc of docs) {
      const slug = `${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}`;
      const guide = {
        id: `editorial-${doc.topic.id}`,
        slug,
        tool: doc.topic.tool,
        translations: entries
          .filter((e) => e.id === `editorial-${doc.topic.id}`)
          .map((e) => ({
            locale: e.locale,
            title: e.title,
            description: e.description,
            html: e.html,
            markdown: e.markdown,
            json: e.json,
          })),
      };
      const found = index.guides?.findIndex((g: { slug: string }) => g.slug === slug) ?? -1;
      if (found >= 0)
        index.guides[found] = {
          ...index.guides[found],
          translations: guide.translations,
          updated: doc.updatedAt,
          editorialId: guide.id,
        };
      else index.guides?.push(guide);
    }
    index.editorialUpdated = docs[0].updatedAt;
    text = JSON.stringify(index);
  } else if (path.endsWith('feed.xml')) {
    const locale = path.startsWith('/en/') ? 'en' : 'zh';
    text = text.replace(
      '</channel>',
      docs
        .slice(0, 30)
        .map(
          (doc) =>
            `<item><title>${xml(doc[locale].title)}</title><link>${env.SITE_URL}/${locale === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/</link><guid>${env.SITE_URL}/${locale === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/</guid><pubDate>${new Date(doc.publishedAt).toUTCString()}</pubDate><description>${xml(doc[locale].description)}</description></item>`,
        )
        .join('') + '</channel>',
    );
  } else
    text +=
      '\n\n## Recently published and expanded guides\n' +
      docs
        .flatMap((doc) =>
          ['zh', 'en'].map(
            (lang) =>
              `- [${doc[lang as 'zh' | 'en'].title}](${env.SITE_URL}/knowledge/${lang}/${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}.md): full public text, figures, examples and sources.`,
          ),
        )
        .join('\n');
  return new Response(request.method === 'HEAD' ? null : text, { headers });
}

export async function editorialLibraryDocuments(env: Env, locale: 'zh' | 'en') {
  return (await publishedDocuments(env)).map((doc) => ({
    id:
      doc.topic.mode === 'extend' && doc.topic.category === 'learn'
        ? 'guide-' + doc.topic.slug
        : `editorial-${doc.topic.id}`,
    alias: `editorial-${doc.topic.id}`,
    path: pathForTopic(doc.topic),
    revision: doc.revision,
    title: editorialIdentity(doc, locale).title,
    url: `${env.SITE_URL}/${locale === 'en' ? 'en/' : ''}${pathForTopic(doc.topic)}/`,
    kind: 'guide' as const,
    level: 'editorial' as const,
    content:
      (doc.topic.mode === 'extend'
        ? (doc.topic.category === 'learn'
            ? readLibrary('guide-' + doc.topic.slug, locale).content
            : originalComparisonMarkdown(doc.topic.slug, locale)) + '\n\n---\n\n'
        : '') + editorialMarkdown(doc, locale),
    keywords: `${doc.topic.tool} ${doc.topic.zh} ${doc.topic.en} ${JSON.stringify(doc.topic.search ?? {})}`,
    sections: [
      ...(doc.topic.mode === 'extend' && doc.topic.category === 'learn'
        ? (() => {
            const original = articles.find((article) => article.slug === doc.topic.slug)!;
            return guideOutline(original, locale).map((part) => ({
              ...part,
              content: guideMarkdown(original, locale, part.id),
            }));
          })()
        : []),
      ...(doc.previousAdditions ?? []).flatMap((addition, history) =>
        addition[locale].sections.map((section, index) => ({
          id: editorialSectionId(addition, index),
          aliases: [`editorial-history-${history}-section-${index}`],
          title: section.heading,
          content: [
            `## ${section.heading}`,
            ...section.paragraphs,
            ...section.sourceIds
              .map((id) => addition.sources.find((s) => s.id === id))
              .filter((s) => s !== undefined)
              .map((s) => `[${s.title}](${s.url})`),
          ].join('\n\n'),
        })),
      ),
      ...doc[locale].sections.map((section, index) => ({
        id: editorialSectionId(doc, index),
        aliases: [`editorial-section-${index}`],
        title: section.heading,
        content: [
          `## ${section.heading}`,
          ...section.paragraphs,
          ...section.sourceIds
            .map((id) => doc.sources.find((source) => source.id === id))
            .filter((source) => source !== undefined)
            .map((source) => `[${source.title}](${source.url})`),
        ].join('\n\n'),
      })),
    ],
  }));
}
