import { pathForTopic } from './editorial-schema';
import { observeEditorial, publishedDocuments } from './editorial-store';
import { indexNowStatus } from './indexnow';
import type { Env } from './types';
export async function checkEditorialHealth(env: Env) {
  const docs = await publishedDocuments(env),
    checks: { path: string; status: number; issues: string[] }[] = [];
  const routes = new Set([
    '/',
    '/en/',
    '/learn/',
    '/en/learn/',
    '/compare/',
    '/en/compare/',
    '/sitemap.xml',
    '/robots.txt',
    '/knowledge/index.json',
    '/llms.txt',
  ]);
  for (const d of docs.slice(0, 6))
    for (const lang of ['zh', 'en']) {
      routes.add(`/${lang === 'en' ? 'en/' : ''}${pathForTopic(d.topic)}/`);
      routes.add(`/knowledge/${lang}/${d.topic.category === 'compare' ? 'compare-' : ''}${d.topic.slug}.md`);
    }
  for (const path of routes) {
    try {
      const response = await fetch(env.SITE_URL + path, {
        signal: AbortSignal.timeout(15_000),
        redirect: 'manual',
        headers: { 'User-Agent': 'WenbuQualityBot/1.0 (+https://wenbu.app/about/)' },
      });
      const issues: string[] = [],
        text = await response.text();
      if (response.status !== 200) issues.push(`http_${response.status}`);
      if (response.status === 200 && response.headers.get('Content-Type')?.includes('text/html')) {
        if (!text.includes(`rel="canonical" href="${env.SITE_URL}${path}"`)) issues.push('canonical');
        if (!/hreflang="(?:zh-Hans|zh-CN)"/.test(text) || !text.includes('hreflang="en"'))
          issues.push('hreflang');
        if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(text)) issues.push('noindex');
      }
      checks.push({ path, status: response.status, issues });
    } catch {
      checks.push({ path, status: 0, issues: ['transport_error'] });
    }
  }
  const evidence = {
    at: new Date().toISOString(),
    checks,
    indexnow: await indexNowStatus(env),
    searchConsole: {
      status: 'requires_authenticated_observation',
      note: 'Technical checks do not prove indexing. Read Search Console via the scheduled authenticated review.',
    },
    geo: {
      status: 'citation_observations_separate',
      note: 'Crawler access and machine-readable documents are not AI answer citations.',
    },
    publishedTopics: docs.length,
  };
  const observation = await observeEditorial(
    env,
    'technical_health',
    evidence,
    checks.some((c) => c.issues.length) ? 'attention' : 'passed',
  );
  await env
    .ANALYTICS!.prepare('UPDATE editorial_state SET last_health_at=? WHERE id=1')
    .bind(Date.now())
    .run();
  return { ...observation, checked: checks.length, issues: checks.filter((c) => c.issues.length) };
}
