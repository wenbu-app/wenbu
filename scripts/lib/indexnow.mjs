import { createHash } from 'node:crypto';

export function isNoIndex(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) => {
    const name = tag.match(/\bname\s*=\s*["']([^"']*)["']/i)?.[1];
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    return /^(?:robots|bingbot)$/i.test(name ?? '') && /\b(?:noindex|none)\b/i.test(content ?? '');
  });
}

// Substantive content, metadata and destinations; shared CSS/JS/navigation changes are not article edits.
export function substantiveContent(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const withoutRuntime = main
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
  const metadata = [
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '',
    ...[...html.matchAll(/<meta\b[^>]*name="description"[^>]*>/gi)].map(([t]) => t),
    ...[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi)].map(([t]) => t),
  ].join(' ');
  const destinations = [...withoutRuntime.matchAll(/\b(?:href|src|alt)="([^"]*)"/g)]
    .map(([, v]) => v)
    .filter((v) => !v.startsWith('/_astro/'))
    .join(' ');
  return [metadata, withoutRuntime.replace(/<[^>]+>/g, ' '), destinations]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function indexNowManifest(pages, origin) {
  const entries = pages
    .map(({ url, html }) => {
      const parsed = new URL(url);
      if (parsed.origin !== origin || parsed.search || parsed.hash || parsed.username || parsed.password)
        throw new Error('IndexNow requires canonical URLs on the primary origin.');
      if (/^\/(?:en\/)?(?:api|mcp|insights|journal|move)(?:\/|$)/.test(parsed.pathname))
        throw new Error('Private and migration routes must not be included in IndexNow.');
      if (isNoIndex(html)) throw new Error('A noindex page was included in IndexNow.');
      return { url, hash: createHash('sha256').update(substantiveContent(html)).digest('hex') };
    })
    .sort((a, b) => a.url.localeCompare(b.url, 'en'));
  if (!entries.length || new Set(entries.map((p) => p.url)).size !== entries.length)
    throw new Error('IndexNow manifest must contain unique, non-empty canonical pages.');
  return {
    version: 1,
    origin,
    revision: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
    pages: entries,
  };
}
