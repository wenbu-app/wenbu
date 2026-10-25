import type { Locale } from './schema';
export type GuideEntry = { id: string; title: string; url: string };
export function guideEntryFromIndex(index: unknown, slug: string, locale: Locale): GuideEntry | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return null;
  const guides = (index as { guides?: unknown[] } | null)?.guides;
  if (!Array.isArray(guides)) return null;
  for (const raw of guides) {
    const guide = raw as {
      slug?: string;
      id?: string;
      translations?: { locale: string; title: string; html: string }[];
    };
    if (guide.slug !== slug || !guide.id || !/^[a-z0-9-]{1,100}$/.test(guide.id)) continue;
    const edition = guide.translations?.find((translation) => translation.locale === locale);
    if (!edition || typeof edition.title !== 'string' || edition.title.length > 200) continue;
    const path = slug.startsWith('compare-') ? `compare/${slug.slice(8)}` : `learn/${slug}`;
    const url = `https://wenbu.app/${locale === 'en' ? 'en/' : ''}${path}/`;
    if (edition.html === url) return { id: guide.id, title: edition.title, url };
  }
  return null;
}
