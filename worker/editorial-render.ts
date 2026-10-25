import { editorialArt } from '../src/lib/editorial-art';
export { editorialArt };
import type { EditorialDocument, EditorialEdition } from './editorial-schema';
import { pathForTopic } from './editorial-schema';
import { publishedDocument, publishedDocuments } from './editorial-store';
import type { Env } from './types';
import { comparisons } from '../src/data/comparisons';
import { articles } from '../src/data/articles';
import { learningTopics, topicForGuide } from '../src/data/learning-paths';
import { titleParts } from '../src/lib/reading-type';
export function editorialIdentity(doc: EditorialDocument, locale: 'zh' | 'en') {
  const original =
    doc.topic.mode === 'extend'
      ? (doc.topic.category === 'learn' ? articles : comparisons).find(
          (item) => item.slug === doc.topic.slug,
        )?.[locale]
      : undefined;
  return {
    title: original?.title ?? doc[locale].title,
    description: original?.description ?? doc[locale].description,
  };
}
export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const h = escapeHtml;
const heading = (value: string) =>
  titleParts(value)
    .map((part) => (part.keep ? `<span class="keep-term">${h(part.text)}</span>` : h(part.text)))
    .join('');
const pref = (locale: 'zh' | 'en') => (locale === 'en' ? '/en/' : '/');
const machineSlug = (doc: EditorialDocument) =>
  `${doc.topic.category === 'compare' ? 'compare-' : ''}${doc.topic.slug}`;
export function originalComparisonMarkdown(slug: string, locale: 'zh' | 'en') {
  const comparison = comparisons.find((c) => c.slug === slug);
  if (!comparison) throw new Error('original_comparison_unavailable');
  const e = comparison[locale];
  return [
    `# ${e.title}`,
    e.description,
    e.intro,
    '| Dimension | Wenbu | ' + comparison.name + ' |',
    '| --- | --- | --- |',
    ...e.rows.map((row) => '| ' + row.join(' | ') + ' |'),
    e.conclusion,
    '## Sources',
    ...comparison.sources.map((s) => `- [${s.title}](${s.url})`),
  ].join('\n\n');
}
export function assetRequest(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  return new Request(request, { headers, method: 'GET' });
}
export async function preserveExtendedMetadata(
  response: Response,
  doc: EditorialDocument,
  locale: 'zh' | 'en',
  base: string,
) {
  const canonical = `${base}${pref(locale)}${pathForTopic(doc.topic)}/`;
  let html = await response.text();
  html = html.replace(
    /<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g,
    (whole, attributes, raw) => {
      try {
        const schema = JSON.parse(raw);
        const nodes = schema['@graph'] ?? [schema];
        for (const node of nodes)
          if (node.url === canonical || node['@id'] === canonical) {
            node.dateModified = doc.updatedAt;
            node.citation = [...new Set([...(node.citation ?? []), ...doc.sources.map((s) => s.url)])];
            node.hasPart = {
              '@type': 'CreativeWork',
              name: doc[locale].title,
              url: canonical + '#editorial-addition',
              datePublished: doc.publishedAt,
            };
          }
        return `<script${attributes}>${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
      } catch {
        return whole;
      }
    },
  );
  html = html.replace(
    '</head>',
    `<meta name="wenbu-editorial-path" content="${h(pathForTopic(doc.topic))}"></head>`,
  );
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.delete('Last-Modified');
  return new Response(html, { status: response.status, headers });
}
export function editorialMarkdown(doc: EditorialDocument, locale: 'zh' | 'en'): string {
  const e = doc[locale];
  const refs = (ids: string[]) =>
    ids
      .map((id) => doc.sources.find((s) => s.id === id))
      .filter((s) => s)
      .map((s) => `[${s!.title}](${s!.url})`)
      .join(' · ');
  return [
    ...(doc.previousAdditions ?? []).map((addition) =>
      editorialMarkdown({ ...doc, ...addition, previousAdditions: [] }, locale),
    ),
    `# ${e.title}`,
    e.description,
    `Updated: ${doc.updatedAt.slice(0, 10)} · Wenbu AI-assisted editorial`,
    e.answer,
    refs(e.answerSourceIds),
    ...e.takeaways.map((t) => `- ${t}`),
    `## ${e.figure.title}`,
    ...e.figure.steps.map((s, i) => `${i + 1}. **${s.label}** — ${s.detail}`),
    e.figure.caption,
    refs(e.figure.sourceIds),
    ...e.sections.flatMap((s) => [`## ${s.heading}`, ...s.paragraphs, refs(s.sourceIds)]),
    `## ${e.table.title}`,
    '| ' + e.table.columns.join(' | ') + ' |',
    '| ' + e.table.columns.map(() => '---').join(' | ') + ' |',
    ...e.table.rows.map((row) => '| ' + row.join(' | ') + ' |'),
    refs(e.table.sourceIds),
    `## ${e.example.title}`,
    e.example.intro,
    ...e.example.steps.map((s, i) => `${i + 1}. ${s}`),
    e.example.conclusion,
    refs(e.example.sourceIds),
    '## FAQ',
    ...e.faq.flatMap((f) => [`### ${f.question}`, f.answer, refs(f.sourceIds)]),
    '## Glossary',
    ...e.glossary.map((g) => `- **${g.term}**: ${g.definition} ${refs(g.sourceIds)}`),
    '## Evidence notes',
    ...e.evidence.map((item) => `- ${item.claim} — “${item.quote}” (${item.kind}); ${refs([item.sourceId])}`),
    '## Sources',
    ...doc.sources.map(
      (s) =>
        `- [${s.title}](${s.url}) — ${s.role}; fetched ${s.fetchedAt}; ${s.truncated ? 'excerpt' : 'complete response'}`,
    ),
    `[${e.cta.label}](https://wenbu.app${pref(locale)}${doc.topic.tool}/)`,
  ].join('\n\n');
}
function citations(doc: EditorialDocument, ids: string[]) {
  return `<p class="editorial-source-links">${ids
    .map((id) => doc.sources.find((s) => s.id === id))
    .filter((s) => s)
    .map((s) => `<a href="${h(s!.url)}" rel="noreferrer" data-track="source">${h(s!.title)} ↗</a>`)
    .join('')}</p>`;
}
export const editorialSectionId = (doc: Pick<EditorialDocument, 'revision'>, index: number) =>
  `editorial-${doc.revision.slice(0, 24)}-section-${index}`;
export function editorialBody(doc: EditorialDocument, locale: 'zh' | 'en', anchor = 'editorial'): string {
  const e: EditorialEdition = doc[locale],
    t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const retained = (doc.previousAdditions ?? [])
    .map(
      (addition, i) =>
        `<section class="editorial-retained"><h2>${h(addition[locale].title)}</h2>${editorialBody({ ...doc, ...addition, previousAdditions: [] }, locale, `editorial-history-${i}`)}</section>`,
    )
    .join('');
  return `${retained}<div class="editorial-answer"><p>${h(e.answer)}</p>${citations(doc, e.answerSourceIds)}</div><ul>${e.takeaways.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
    <figure class="editorial-figure"><h2>${h(e.figure.title)}</h2><ol>${e.figure.steps.map((s, i) => `<li><b aria-hidden="true">${String(i + 1).padStart(2, '0')}</b><strong>${h(s.label)}</strong><p>${h(s.detail)}</p></li>`).join('')}</ol><figcaption>${h(e.figure.caption)}</figcaption>${citations(doc, e.figure.sourceIds)}</figure>
    ${e.sections.map((s, i) => `<section id="${anchor}-section-${i}"><span id="${h(editorialSectionId(doc, i))}" aria-hidden="true"></span><h2>${h(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${h(p)}</p>`).join('')}${citations(doc, s.sourceIds)}</section>`).join('')}
    <div class="editorial-table" role="region" aria-label="${h(e.table.title)}" tabindex="0"><table><caption>${h(e.table.title)}</caption><thead><tr>${e.table.columns.map((c) => `<th scope="col">${h(c)}</th>`).join('')}</tr></thead><tbody>${e.table.rows.map((row) => `<tr>${row.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${citations(doc, e.table.sourceIds)}
    <section class="editorial-example"><h2>${h(e.example.title)}</h2><p>${h(e.example.intro)}</p><ol>${e.example.steps.map((s) => `<li>${h(s)}</li>`).join('')}</ol><p>${h(e.example.conclusion)}</p>${citations(doc, e.example.sourceIds)}</section>
    <section><h2>${t('常见问题', 'Questions you may have')}</h2>${e.faq.map((f) => `<details><summary>${h(f.question)}</summary><p>${h(f.answer)}</p>${citations(doc, f.sourceIds)}</details>`).join('')}</section>
    <section><h2>${t('术语速查', 'Terms in this guide')}</h2><dl>${e.glossary.map((g) => `<dt><strong>${h(g.term)}</strong></dt><dd>${h(g.definition)}${citations(doc, g.sourceIds)}</dd>`).join('')}</dl></section>
    <details class="editorial-evidence"><summary>${t('查看事实与来源的核对笔记', 'See the claim and source notes')}</summary><ul>${e.evidence.map((item) => `<li><p>${h(item.claim)}</p><q>${h(item.quote)}</q>${citations(doc, [item.sourceId])}</li>`).join('')}</ul></details>
    <section class="editorial-sources"><h2>${t('来源与核对范围', 'Sources and review scope')}</h2><p>${t('这是问卜的 AI 辅助编辑内容，经过自动结构检查和独立生成的编辑检查；不代表独立专家审稿。公开产品介绍不等于付费体验测试。', 'This AI-assisted Wenbu article passed automated structure checks and a separate editorial model pass. It is not independent expert review or a paid-account product test.')}</p><ol>${doc.sources.map((s) => `<li><a href="${h(s.url)}" rel="noreferrer" data-track="source">${h(s.title)} ↗</a><small>${h(s.role)} · ${s.fetchedAt.slice(0, 10)} · ${s.truncated ? t('已读选段', 'Read excerpt') : t('已取回正文', 'Fetched text')}</small></li>`).join('')}</ol></section>
    <section class="editorial-cta"><h2>${h(e.cta.label)}</h2><p>${h(e.cta.reason)}</p><a class="button primary" data-track="article-tool" href="${pref(locale)}${doc.topic.tool}/">${h(e.cta.label)} ↗</a><p><a class="article-context-link" data-track="article-guide-agent" href="${pref(locale)}agent/?guide=${machineSlug(doc)}">${t('围绕这篇，继续问', 'Explore this guide with Wenbu')} ↗</a></p><div class="editorial-downloads"><a data-track="guide-markdown" href="/knowledge/${locale}/${machineSlug(doc)}.md">Markdown ↗</a><a data-track="guide-json" href="/knowledge/${locale}/${machineSlug(doc)}.json">JSON ↗</a><a href="${pref(locale)}${locale === 'en' ? 'compare/' : 'compare/'}">${t('比较不同产品', 'Compare products')} ↗</a></div></section>`;
}
export function editorialCards(
  docs: EditorialDocument[],
  locale: 'zh' | 'en',
  category: 'learn' | 'compare',
) {
  const relevant = docs.filter(
    (d) =>
      d.topic.category === category &&
      !(category === 'compare' ? comparisons : articles).some((original) => original.slug === d.topic.slug),
  );
  if (!relevant.length) return '';
  return `<section class="editorial-catalogue"><h2>${category === 'compare' ? (locale === 'zh' ? '按需求，找到适合的工具' : 'Choose a tool for your task') : locale === 'zh' ? '最近补充的实践与指南' : 'Recent guides and practical additions'}</h2><div class="editorial-cards">${relevant.map((d) => `<a class="editorial-card" data-track="library-article" href="${pref(locale)}${pathForTopic(d.topic)}/"><div class="editorial-card-art" aria-hidden="true">${editorialArt(d.topic.tool, d.topic.category === 'compare')}</div><small>${d.updatedAt.slice(0, 10)} · ${d.topic.mode === 'extend' ? (locale === 'zh' ? '新增练习' : 'Updated practice') : category === 'compare' ? (locale === 'zh' ? '产品对比' : 'Product comparison') : locale === 'zh' ? '图解指南' : 'Illustrated guide'}</small><h3>${heading(d[locale].title)}</h3><p>${h(d[locale].description)}</p></a>`).join('')}</div></section>`;
}
function libraryTopic(doc: EditorialDocument) {
  return (
    topicForGuide(doc.topic.slug) ??
    learningTopics.find((topic) => topic.id === doc.topic.tool) ??
    learningTopics[5]
  );
}
function guideSearch(doc: EditorialDocument) {
  const topic = libraryTopic(doc);
  return [
    doc.topic.slug.replaceAll('-', ' '),
    doc.zh.title,
    doc.en.title,
    doc.zh.description,
    doc.en.description,
    topic.zh,
    topic.en,
    doc.topic.tool,
  ]
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();
}
function libraryCard(doc: EditorialDocument, locale: 'zh' | 'en') {
  const e = doc[locale],
    topic = libraryTopic(doc);
  return `<a class="library-guide" href="${pref(locale)}${pathForTopic(doc.topic)}/" data-track="library-article" data-guide data-guide-slug="${h(doc.topic.slug)}" data-search="${h(guideSearch(doc))}"><div class="editorial-card-art" aria-hidden="true">${editorialArt(doc.topic.tool)}</div><div class="library-guide-copy"><div class="library-guide-meta"><span>${h(topic[locale])}</span><span>${doc.updatedAt.slice(0, 10)}</span></div><h4>${heading(e.title)}</h4><p>${h(e.description)}</p><span class="library-guide-read">${locale === 'zh' ? '继续阅读' : 'Read the guide'} ↗</span></div></a>`;
}
function rewriteMetadata(response: Response, doc: EditorialDocument, locale: 'zh' | 'en', base: string) {
  const e = doc[locale],
    path = pathForTopic(doc.topic),
    canonical = `${base}${pref(locale)}${path}/`;
  const graph = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: e.title,
    description: e.description,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: locale === 'zh' ? 'zh-Hans' : 'en',
    datePublished: doc.publishedAt,
    dateModified: doc.updatedAt,
    author: { '@type': 'Organization', name: 'Wenbu', url: `${base}/about/` },
    citation: doc.sources.map((s) => s.url),
    encoding: [
      {
        '@type': 'MediaObject',
        encodingFormat: 'text/markdown',
        contentUrl: `${base}/knowledge/${locale}/${machineSlug(doc)}.md`,
      },
    ],
  };
  return new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append(`<meta name="wenbu-editorial-path" content="${h(path)}">`, { html: true });
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(`${e.title} · Wenbu`);
      },
    })
    .on('a.language-switch', {
      element(el) {
        el.setAttribute('href', `${pref(locale === 'zh' ? 'en' : 'zh')}${path}/`);
      },
    })
    .on('meta[name="robots"]', {
      element(el) {
        el.setAttribute('content', 'index, follow');
      },
    })
    .on('meta[name="description"],meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', e.description);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', e.title + ' · Wenbu');
      },
    })
    .on('meta[property="og:type"]', {
      element(el) {
        el.setAttribute('content', 'article');
      },
    })
    .on('meta[property="og:url"],link[rel="canonical"]', {
      element(el) {
        el.setAttribute(el.tagName === 'link' ? 'href' : 'content', canonical);
      },
    })
    .on('link[hreflang]', {
      element(el) {
        el.setAttribute(
          'href',
          `${base}${pref(el.getAttribute('hreflang') === 'zh-Hans' ? 'zh' : 'en')}${path}/`,
        );
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        el.setInnerContent(JSON.stringify(graph).replace(/</g, '\\u003c'), { html: true });
      },
    })
    .transform(response);
}

export async function editorialResponse(request: Request, env: Env): Promise<Response | null> {
  if (env.EDITORIAL_ENABLED !== 'true' || !env.ANALYTICS || !['GET', 'HEAD'].includes(request.method))
    return null;
  const url = new URL(request.url),
    locale = url.pathname.startsWith('/en/') ? 'en' : 'zh';
  const normalized = url.pathname.replace(/^\/en\//, '/');
  const route = normalized.match(/^\/(learn|compare)\/([a-z][a-z0-9-]{1,80})\/$/);
  const machine = url.pathname.match(/^\/knowledge\/(zh|en)\/(compare-)?([a-z][a-z0-9-]{1,80})\.(md|json)$/);
  if (route || machine) {
    const path = route ? `${route[1]}/${route[2]}` : `${machine![2] ? 'compare' : 'learn'}/${machine![3]}`;
    const doc = await publishedDocument(env, path);
    if (!doc) return null;
    if (machine) {
      const lang = machine[1] as 'zh' | 'en';
      let markdown = editorialMarkdown(doc, lang);
      if (doc.topic.mode === 'extend') {
        if (doc.topic.category === 'compare')
          markdown = originalComparisonMarkdown(doc.topic.slug, lang) + '\n\n---\n\n' + markdown;
        else {
          const original = await env.ASSETS.fetch(
            new Request(`${env.SITE_URL}/knowledge/${lang}/${doc.topic.slug}.md`),
          );
          if (!original.ok) throw new Error('original_article_unavailable');
          markdown = (await original.text()) + '\n\n---\n\n' + markdown;
        }
      }
      return new Response(
        request.method === 'HEAD'
          ? null
          : machine[4] === 'md'
            ? markdown
            : JSON.stringify({
                version: 1,
                scope: 'full',
                truncated: false,
                id: `editorial-${doc.topic.id}`,
                url: `${env.SITE_URL}${pref(lang)}${path}/`,
                locale: lang,
                revision: doc.revision,
                updated: doc.updatedAt,
                content: markdown,
                edition: doc[lang],
                editionScope: doc.topic.mode === 'extend' ? 'addition' : 'full',
                sources: doc.sources,
                previousAdditions: doc.previousAdditions ?? [],
              }),
        {
          headers: {
            'Content-Type':
              machine[4] === 'md' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
            'X-Robots-Tag': 'noindex',
            Link: `<${env.SITE_URL}${pref(lang)}${path}/>; rel="canonical"`,
          },
        },
      );
    }
    let response: Response;
    if (doc.topic.mode === 'extend') {
      response = await env.ASSETS.fetch(assetRequest(request));
      if (!response.ok) return null;
      const addition = `<section id="editorial-addition" class="editorial-addition editorial-prose"><p class="eyebrow">${locale === 'zh' ? '新增实践与核对' : 'ADDITIONAL PRACTICE'} · ${doc.updatedAt.slice(0, 10)}</p><h2>${h(doc[locale].title)}</h2>${editorialBody(doc, locale)}</section>`;
      response = new HTMLRewriter()
        .on('article.prose,.comparison-body', {
          element(el) {
            el.append(addition, { html: true });
          },
        })
        .transform(response);
      // Comparisons have a different static layout; append inside main if there is no article prose.
      if (doc.topic.category === 'compare') {
        const original = await env.ASSETS.fetch(assetRequest(request));
        response = new HTMLRewriter()
          .on('main', {
            element(el) {
              el.append(`<div class="shell">${addition}</div>`, { html: true });
            },
          })
          .transform(original);
      }
    } else {
      response = await env.ASSETS.fetch(
        new Request(`${env.SITE_URL}/${locale === 'en' ? 'en/' : ''}editorial-template/`),
      );
      if (!response.ok) return null;
      const e = doc[locale];
      response = new HTMLRewriter()
        .on('#editorial-document', {
          element(el) {
            el.setInnerContent(
              `<div class="shell editorial-reading"><nav class="breadcrumbs" aria-label="${locale === 'zh' ? '当前位置' : 'Breadcrumb'}"><a href="${pref(locale)}">${locale === 'zh' ? '首页' : 'Home'}</a> / <a href="${pref(locale)}${doc.topic.category}/">${doc.topic.category === 'compare' ? (locale === 'zh' ? '产品对比' : 'Comparisons') : locale === 'zh' ? '知识手册' : 'Library'}</a></nav><header class="editorial-heading"><span class="eyebrow">WENBU · ${doc.topic.category === 'compare' ? 'SIDE BY SIDE' : 'FIELD NOTES'}</span><h1>${heading(e.title)}</h1><p>${h(e.description)}</p><div class="editorial-meta"><span>Wenbu · ${locale === 'zh' ? 'AI 辅助编辑' : 'AI-assisted editorial'}</span><time datetime="${doc.updatedAt}">${doc.updatedAt.slice(0, 10)}</time><span>${locale === 'zh' ? '图解 · 实例 · 来源' : 'Figures · Worked example · Sources'}</span></div><div class="editorial-hero-art" aria-hidden="true">${editorialArt(doc.topic.tool, doc.topic.category === 'compare')}</div></header><div class="editorial-grid"><article class="editorial-prose">${editorialBody(doc, locale)}</article><aside class="editorial-toc"><strong>${locale === 'zh' ? '这一篇讲什么' : 'On this page'}</strong><nav>${e.sections.map((s, i) => `<a href="#editorial-section-${i}">${h(s.heading)}</a>`).join('')}</nav></aside></div></div>`,
              { html: true },
            );
          },
        })
        .transform(response);
    }
    response =
      doc.topic.mode === 'extend'
        ? await preserveExtendedMetadata(response, doc, locale, env.SITE_URL)
        : rewriteMetadata(response, doc, locale, env.SITE_URL);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=60');
    headers.delete('X-Robots-Tag');
    headers.delete('Content-Length');
    headers.delete('ETag');
    headers.delete('Last-Modified');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
  }
  if (normalized === '/learn/' || normalized === '/compare/') {
    const docs = await publishedDocuments(env),
      category = normalized === '/compare/' ? 'compare' : 'learn';
    let response = await env.ASSETS.fetch(assetRequest(request));
    if (category === 'compare')
      return new HTMLRewriter()
        .on('[data-editorial-catalogue]', {
          element(el) {
            el.setInnerContent(editorialCards(docs, locale, category), { html: true });
          },
        })
        .transform(response);
    const guides = docs.filter((doc) => doc.topic.category === 'learn');
    const originals = articles.filter((article) => article.category === 'learn');
    const additions = guides.filter((doc) => !originals.some((article) => article.slug === doc.topic.slug));
    const total = originals.length + additions.length;
    // The visible directory and its CollectionPage describe the same canonical owners.
    const items = learningTopics.flatMap((topic) => [
      ...topic.slugs
        .map((slug) => originals.find((article) => article.slug === slug))
        .filter((article) => article !== undefined)
        .map((article) => ({
          name: article[locale].title,
          url: `${env.SITE_URL}${pref(locale)}learn/${article.slug}/`,
        })),
      ...additions
        .filter((doc) => libraryTopic(doc).id === topic.id)
        .map((doc) => ({
          name: doc[locale].title,
          url: `${env.SITE_URL}${pref(locale)}${pathForTopic(doc.topic)}/`,
        })),
    ]);
    const sourceHtml = await response.text();
    const html = sourceHtml.replace(
      /<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g,
      (whole, attributes, raw) => {
        try {
          const schema = JSON.parse(raw);
          for (const node of schema['@graph'] ?? [schema])
            if (node['@type'] === 'CollectionPage' && node.url === `${env.SITE_URL}${pref(locale)}learn/`)
              node.mainEntity = {
                '@type': 'ItemList',
                numberOfItems: items.length,
                itemListElement: items.map((item, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  ...item,
                })),
              };
          return `<script${attributes}>${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
        } catch {
          return whole;
        }
      },
    );
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    headers.delete('Last-Modified');
    response = new Response(html, { status: response.status, headers });
    return new HTMLRewriter()
      .on('[data-library-edition]', {
        element(el) {
          el.setInnerContent(
            locale === 'zh'
              ? `${total} 篇双语图解指南 · 案例与来源 · 免费阅读`
              : `${total} illustrated guides · Examples and sources · Free to read`,
          );
        },
      })
      .on('[data-guide-slug]', {
        element(el) {
          const doc = guides.find((doc) => doc.topic.slug === el.getAttribute('data-guide-slug'));
          if (doc)
            el.setAttribute('data-search', `${el.getAttribute('data-search') ?? ''} ${guideSearch(doc)}`);
        },
      })
      .on('[data-topic-guides]', {
        element(el) {
          el.append(
            additions
              .filter((doc) => libraryTopic(doc).id === el.getAttribute('data-topic-guides'))
              .map((doc) => libraryCard(doc, locale))
              .join(''),
            { html: true },
          );
        },
      })
      .on('[data-editorial-catalogue]', {
        element(el) {
          el.setInnerContent('');
        },
      })
      .transform(response);
  }
  return null;
}
