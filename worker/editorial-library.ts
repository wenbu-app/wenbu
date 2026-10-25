import { libraryDocuments, readLibrary } from './agent-library';
import { editorialLibraryDocuments } from './editorial-discovery';
import type { Env } from './types';
export async function completeLibraryDocuments(locale: 'zh' | 'en', env?: Env) {
  const original = libraryDocuments(locale);
  if (!env || env.EDITORIAL_ENABLED !== 'true') return original;
  const additions = await editorialLibraryDocuments(env, locale);
  const replaced = new Set(additions.map((d) => d.id));
  return [...original.filter((d) => !replaced.has(d.id)), ...additions];
}
export async function searchCompleteLibrary(query: string, locale: 'zh' | 'en', limit = 6, env?: Env) {
  const docs = await completeLibraryDocuments(locale, env),
    q = query.toLowerCase();
  const terms = new Set(q.match(/[a-z0-9]{2,}|[\u3400-\u9fff]{1,}/g) ?? []);
  for (const term of [...terms])
    if (/^[\u3400-\u9fff]+$/.test(term) && term.length > 2)
      for (let i = 0; i < term.length - 1; i++) terms.add(term.slice(i, i + 2));
  return docs
    .map((d) => ({
      d,
      score: [...terms].reduce(
        (n, t) =>
          n +
          ((d.title + ' ' + d.keywords).toLowerCase().includes(t) ? 5 : 0) +
          (d.content.toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(8, Math.max(1, limit)))
    .map(({ d }) => ({
      id: d.id,
      title: d.title,
      url: d.url,
      kind: d.kind,
      level: d.level,
      snippet: d.content.slice(0, 220),
      nextTool: d.kind === 'reference' ? 'read_reference' : 'read_library',
    }));
}
export async function readCompleteLibrary(id: string, locale: 'zh' | 'en', section?: string, env?: Env) {
  const [documentId, savedSection, ...extra] = id.split('#');
  if (
    extra.length ||
    (id.includes('#') && !savedSection) ||
    (savedSection && section && savedSection !== section)
  )
    throw new Error('Conflicting or invalid section citation ID.');
  section ??= savedSection;
  const docs = env ? await editorialLibraryDocuments(env, locale) : [];
  const doc = docs.find((d) => d.id === documentId || d.alias === documentId);
  if (!doc) return readLibrary(id, locale, section);
  const part = section ? doc.sections.find((part) => part.id === section) : null;
  if (section && !part) throw new Error('Unknown document section. Use a section ID from the outline.');
  const content = part?.content ?? doc.content;
  return {
    source: {
      id: section ? `${doc.id}#${section}` : doc.id,
      title: doc.title + (part ? ` · ${part.title}` : ''),
      url: doc.url + (section ? `#${section}` : ''),
      kind: 'guide' as const,
      level: 'editorial',
      excerpt: content.slice(0, 280),
      readAt: new Date().toISOString(),
    },
    documentId: doc.id,
    content,
    format: 'text/markdown',
    scope: section ? 'section' : 'full',
    section: section ?? null,
    outline: doc.sections.map(({ id, title }) => ({ id, title })),
    links: {
      html: doc.url,
      markdown: doc.url.replace(
        /\/(en\/)?(learn|compare)\/([^/]+)\/$/,
        (_, _en, category, slug) =>
          `/knowledge/${locale}/${category === 'compare' ? 'compare-' : ''}${slug}.md`,
      ),
      json: doc.url.replace(
        /\/(en\/)?(learn|compare)\/([^/]+)\/$/,
        (_, _en, category, slug) =>
          `/knowledge/${locale}/${category === 'compare' ? 'compare-' : ''}${slug}.json`,
      ),
    },
    truncated: false,
  };
}
export async function completeLibrarySnapshot(id: string, locale: 'zh' | 'en', env?: Env) {
  const doc = await readCompleteLibrary(id, locale, undefined, env);
  return doc.scope === 'full' && doc.content.length > 1800
    ? {
        ...doc,
        content: doc.content.slice(0, 1800),
        scope: 'preview',
        truncated: true,
        fullContentLength: doc.content.length,
        requiresReadBeforeCitation: true,
      }
    : { ...doc, requiresReadBeforeCitation: false };
}
