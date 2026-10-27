import { pathForTopic } from './editorial-schema';
import { observeEditorial, publishedDocuments } from './editorial-store';
import { indexNowStatus } from './indexnow';
import { searchConsoleAction, searchConsoleStatus } from './search-console';
import type { Env } from './types';
import { recordEditorialGrowthReview } from './editorial-growth';
import { refreshEditorialSources } from './editorial-research';
export async function checkEditorialHealth(env: Env) {
  // Source availability is an independent read-only check. It must continue
  // while the shared model account is paused, under the existing six-hour cache.
  const sourceAvailability = await refreshEditorialSources(env);
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
  const expected = new Map<string, { revision: string; answer: string; cta: string; hub: string }>();
  const contents = new Map<string, string>();
  for (const d of docs.slice(0, 6))
    for (const lang of ['zh', 'en'] as const) {
      const html = `/${lang === 'en' ? 'en/' : ''}${pathForTopic(d.topic)}/`;
      const machine = `/knowledge/${lang}/${d.topic.category === 'compare' ? 'compare-' : ''}${d.topic.slug}`;
      const details = {
        revision: d.revision,
        answer: d[lang].answer,
        cta: `/${lang === 'en' ? 'en/' : ''}${d.topic.tool}/`,
        hub: `/${lang === 'en' ? 'en/' : ''}${d.topic.category}/`,
      };
      for (const path of [html, machine + '.md', machine + '.json']) {
        routes.add(path);
        expected.set(path, details);
      }
      routes.add(details.cta);
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
      contents.set(path, text);
      if (response.status !== 200) issues.push(`http_${response.status}`);
      if (
        response.headers.get('X-Robots-Tag')?.includes('noindex') &&
        path.endsWith('/') &&
        expected.has(path)
      )
        issues.push('noindex_header');
      if (response.status === 200 && response.headers.get('Content-Type')?.includes('text/html')) {
        if (!text.includes(`rel="canonical" href="${env.SITE_URL}${path}"`)) issues.push('canonical');
        if (!/hreflang="(?:zh-Hans|zh-CN)"/.test(text) || !text.includes('hreflang="en"'))
          issues.push('hreflang');
        if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(text)) issues.push('noindex');
        const e = expected.get(path);
        if (e && !text.includes(`href="${e.cta}"`)) issues.push('product_cta');
      }
      if (response.status === 200 && path.endsWith('.json') && expected.has(path)) {
        try {
          if (JSON.parse(text).revision !== expected.get(path)!.revision) issues.push('revision');
        } catch {
          issues.push('json_invalid');
        }
      }
      if (
        response.status === 200 &&
        path.endsWith('.md') &&
        expected.has(path) &&
        !text.includes(expected.get(path)!.answer)
      )
        issues.push('edition_body');
      checks.push({ path, status: response.status, issues });
    } catch {
      checks.push({ path, status: 0, issues: ['transport_error'] });
    }
  }
  for (const c of checks) {
    const e = expected.get(c.path);
    if (!e || !c.path.endsWith('/')) continue;
    if (!contents.get('/sitemap.xml')?.includes(`<loc>${env.SITE_URL}${c.path}</loc>`))
      c.issues.push('sitemap_membership');
    if (!contents.get(e.hub)?.includes(`href="${c.path}"`)) c.issues.push('directory_link');
    const destination = checks.find((r) => r.path === e.cta);
    if (!destination || destination.status !== 200) c.issues.push('cta_destination');
  }
  const reconciled = await searchConsoleAction(env, { action: 'reconcile' });
  const search = await searchConsoleStatus(env);
  const evidence = {
    at: new Date().toISOString(),
    checks,
    sourceHealth: {
      cacheHours: 6,
      records: sourceAvailability,
      note: 'Allowlisted source GETs only; per-source checked_at records actual freshness. No model or balance probe.',
    },
    indexnow: await indexNowStatus(env),
    searchConsole: {
      reconciled,
      counts: search.counts,
      nextRequest: search.nextRequest,
      globalRetryAt: search.globalRetryAt,
      blockedByUnresolvedDispatch: search.blockedByUnresolvedDispatch,
      inspections: { counts: search.inspections.counts, dueTotal: search.inspections.dueTotal },
      note: 'Technical health is separate from provider inspection. Browser delivery and follow-up are scheduled independently.',
    },
    geo: {
      status: 'citation_observations_separate',
      note: 'Crawler access and machine-readable documents are not AI answer citations.',
    },
    publishedTopics: docs.length,
    productionReview: await recordEditorialGrowthReview(env),
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
