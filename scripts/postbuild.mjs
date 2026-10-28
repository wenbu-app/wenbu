import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { indexNowManifest, isNoIndex } from './lib/indexnow.mjs';
const indexNowConfig = JSON.parse(await readFile('src/data/indexnow.json', 'utf8'));
const site = (process.env.SITE_URL || 'https://wenbu.app').replace(/\/$/, '');
async function walk(dir) {
  const out = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = (await walk('dist')).filter((f) => f.endsWith('.html'));
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pages = [];
const hashes = new Set();
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=|application\/ld\+json/.test(m[1]) && m[2])
      hashes.add("'sha256-" + createHash('sha256').update(m[2]).digest('base64') + "'");
  }
  if (!isNoIndex(html) && canonical) pages.push({ url: canonical, html });
}
if (site !== indexNowConfig.origin) throw new Error('IndexNow origin must match the production build.');
await writeFile('dist' + indexNowConfig.manifestPath, JSON.stringify(indexNowManifest(pages, site)) + '\n');
await writeFile('dist/' + indexNowConfig.key + '.txt', indexNowConfig.key);
await writeFile(
  'dist/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    pages
      .map((p) => {
        const modified = p.html.match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/)?.[1];
        return (
          '<url><loc>' +
          escape(p.url) +
          '</loc>' +
          (modified ? '<lastmod>' + modified + '</lastmod>' : '') +
          '</url>'
        );
      })
      .join('') +
    '</urlset>',
);
await writeFile(
  'dist/robots.txt',
  'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /mcp\nSitemap: ' + site + '/sitemap.xml\n',
);
for (const locale of ['zh', 'en']) {
  const posts = pages.filter(
    (p) =>
      p.url.startsWith(site + (locale === 'en' ? '/en/' : '/blog/')) &&
      (locale === 'zh' || p.url.includes('/blog/')),
  );
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Wenbu Journal</title><link>' +
    site +
    (locale === 'en' ? '/en/' : '/') +
    '</link><description>Old wisdom. A present perspective.</description>' +
    posts
      .filter((p) => !p.url.endsWith('/blog/'))
      .map(
        (p) =>
          '<item><title>' +
          escape(p.html.match(/<title>(.*?)<\/title>/)?.[1] || 'Wenbu') +
          '</title><link>' +
          escape(p.url) +
          '</link><guid>' +
          escape(p.url) +
          '</guid><description>' +
          escape(p.html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '') +
          '</description></item>',
      )
      .join('') +
    '</channel></rss>';
  await mkdir('dist/en', { recursive: true });
  await writeFile(locale === 'en' ? 'dist/en/feed.xml' : 'dist/feed.xml', xml);
}
let knowledgeHeaders = '';
for (const locale of ['zh', 'en'])
  for (const [extension, mime] of [
    ['md', 'text/markdown; charset=utf-8'],
    ['json', 'application/json; charset=utf-8'],
  ]) {
    knowledgeHeaders += `/knowledge/${locale}/*.${extension}\n  Content-Type: ${mime}\n  X-Robots-Tag: noindex\n`;
  }
const knowledgeCatalogue = JSON.parse(await readFile('dist/knowledge/index.json', 'utf8'));
for (const document of knowledgeCatalogue.guides)
  for (const edition of document.translations) {
    for (const format of ['markdown', 'json']) {
      const machine = new URL(edition[format]);
      if (
        machine.origin !== site ||
        new URL(edition.html).origin !== site ||
        !machine.pathname.startsWith('/knowledge/')
      )
        throw new Error('Unexpected knowledge canonical owner.');
    }
    const markdown = new URL(edition.markdown).pathname;
    if (!markdown.endsWith('.md') || new URL(edition.json).pathname !== markdown.slice(0, -3) + '.json')
      throw new Error('Knowledge formats must share a canonical owner.');
    // One document prefix covers its two formats within the 100-rule limit.
    knowledgeHeaders += `${markdown.slice(0, -3)}.*\n  Link: <${edition.html}>; rel="canonical"\n`;
  }
knowledgeHeaders +=
  '/knowledge/index.json\n  Content-Type: application/json; charset=utf-8\n  X-Robots-Tag: noindex\n';
const csp =
  "default-src 'self'; script-src 'self' https://*.clarity.ms " +
  [...hashes].join(' ') +
  "; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.clarity.ms https://c.bing.com; font-src 'self'; connect-src 'self' https://*.clarity.ms https://c.bing.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const finalHeaders =
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ' +
  csp +
  '\n  Strict-Transport-Security: max-age=31536000\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n/images/tarot/*\n  Cache-Control: public, max-age=86400\n' +
  knowledgeHeaders +
  indexNowConfig.manifestPath +
  '\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-cache\n  X-Robots-Tag: noindex\n' +
  '/' +
  indexNowConfig.key +
  '.txt\n  Content-Type: text/plain; charset=utf-8\n  Cache-Control: public, max-age=300\n';
if (
  finalHeaders.split('\n').filter((line) => /^(?:\/|https:\/\/)/.test(line)).length > 100 ||
  finalHeaders.split('\n').some((line) => line.length > 2000)
)
  throw new Error('Static header rules exceed Cloudflare limits.');
await writeFile('dist/_headers', finalHeaders);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f6f3ec"/><g fill="none" stroke="#c9c0ae"><circle cx="945" cy="315" r="255"/><circle cx="945" cy="315" r="217"/><circle cx="945" cy="315" r="140"/><path d="M640 315h570M945 20v590"/></g><circle cx="945" cy="315" r="73" fill="#b4533d"/><path d="M908 315h74m-37-37v74" stroke="#f6f3ec" stroke-width="2"/><text x="76" y="147" font-family="Georgia,serif" font-size="69" fill="#252d27">wenbu<tspan fill="#b4533d">.</tspan></text><text x="79" y="298" font-family="Georgia,serif" font-size="70" fill="#252d27">Old wisdom.</text><text x="79" y="378" font-family="Georgia,serif" font-size="70" fill="#252d27">A present perspective.</text><text x="82" y="497" font-family="Arial,sans-serif" font-size="19" letter-spacing="3" fill="#6e7167">BAZI / I CHING / TAROT / ZI WEI</text><path d="M80 555h500" stroke="#c9c0ae"/></svg>';
await sharp(Buffer.from(svg)).png().toFile('dist/og.png');
console.log('Generated sitemap for ' + pages.length + ' indexable pages, RSS, CSP and social image.');
