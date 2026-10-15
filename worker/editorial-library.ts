import { libraryDocuments, readLibrary, libraryContextSnapshot } from './agent-library';
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
  if (section || id.includes('#')) return readLibrary(id, locale, section);
  const docs = env ? await editorialLibraryDocuments(env, locale) : [];
  const doc = docs.find((d) => d.id === id || d.alias === id);
  if (!doc) return readLibrary(id, locale, section);
  return {
    source: {
      id: doc.id,
      title: doc.title,
      url: doc.url,
      kind: 'guide' as const,
      level: 'editorial',
      excerpt: doc.content.slice(0, 280),
      readAt: new Date().toISOString(),
    },
    documentId: doc.id,
    content: doc.content,
    format: 'text/markdown',
    scope: 'full',
    section: null,
    truncated: false,
  };
}
export async function completeLibrarySnapshot(id: string, locale: 'zh' | 'en', env?: Env) {
  if (sectionIdentifier(id)) return libraryContextSnapshot(id, locale);
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
function sectionIdentifier(id: string) {
  return id.includes('#');
}
