import {
  classificationVersion,
  type actorTypes,
  type actorNames,
  type actorPurposes,
  type classificationEvidence,
} from '../src/lib/traffic-contract';
import { pagePaths, safePage, isEditorialPath } from '../src/lib/analytics-contract';
import { articles } from '../src/data/articles';

type Type = (typeof actorTypes)[number];
type Name = (typeof actorNames)[number];
type Purpose = (typeof actorPurposes)[number];
type Evidence = (typeof classificationEvidence)[number];
const signatures: [RegExp, Type, Name, Purpose][] = [
  [/\bOAI-SearchBot\b/i, 'ai_crawler', 'oai_searchbot', 'search'],
  [/\bGPTBot\b/i, 'ai_crawler', 'gptbot', 'training'],
  [/\bChatGPT-User\b/i, 'ai_agent', 'chatgpt_user', 'user_fetch'],
  [/\bClaude-SearchBot\b/i, 'ai_crawler', 'claude_searchbot', 'search'],
  [/\bClaude-User\b/i, 'ai_agent', 'claude_user', 'user_fetch'],
  [/\bClaudeBot\b/i, 'ai_crawler', 'claudebot', 'training'],
  [/\bPerplexity-User\b/i, 'ai_agent', 'perplexity_user', 'user_fetch'],
  [/\bPerplexityBot\b/i, 'ai_crawler', 'perplexitybot', 'search'],
  [/\bBytespider\b/i, 'ai_crawler', 'bytespider', 'unknown'],
  [/\bGooglebot(?:-\w+)?\b/i, 'search_crawler', 'googlebot', 'search'],
  [/\bBingbot\b/i, 'search_crawler', 'bingbot', 'search'],
  [/\bBaiduspider\b/i, 'search_crawler', 'baiduspider', 'search'],
  [/\bDuckDuckBot\b/i, 'search_crawler', 'duckduckbot', 'search'],
  [/\bYandexBot\b/i, 'search_crawler', 'yandexbot', 'search'],
  [/\bHeadlessChrome\b|\bPlaywright\b|\bPuppeteer\b|\bSelenium\b/i, 'automation', 'headless', 'other'],
  [
    /\b(?:curl|wget|python-requests|python-httpx|Go-http-client|node-fetch)\b/i,
    'automation',
    'script',
    'other',
  ],
  [/\b\w*(?:bot|crawler|spider)\b/i, 'automation', 'generic_bot', 'unknown'],
];
export function classifyTraffic(request: Request) {
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 2048);
  const cf = request.cf as
    | {
        botManagement?: { score?: number; verifiedBot?: boolean; signedAgent?: boolean };
        verifiedBotCategory?: string;
      }
    | undefined;
  const bm = cf?.botManagement;
  const verified = typeof bm?.verifiedBot === 'boolean' ? Number(bm.verifiedBot) : null;
  const signed = typeof bm?.signedAgent === 'boolean' ? Number(bm.signedAgent) : null;
  const score = Number.isInteger(bm?.score) && bm!.score! >= 1 && bm!.score! <= 99 ? bm!.score! : null;
  let type: Type = 'unknown',
    name: Name = 'unknown',
    purpose: Purpose = 'unknown',
    evidence: Evidence = 'unknown';
  const signature = signatures.find(([pattern]) => pattern.test(ua));
  if (signature && !['headless', 'script', 'generic_bot'].includes(signature[2])) {
    [, type, name, purpose] = signature;
    evidence = 'ua_declared';
  } else if (/^\/mcp\/?$/.test(new URL(request.url).pathname)) {
    type = 'tool_client';
    name = 'mcp_client';
    purpose = 'tool';
    evidence = 'tool_declared';
  } else if (request.headers.get('X-Wenbu-Client') === 'cli') {
    type = 'tool_client';
    name = 'cli_client';
    purpose = 'tool';
    evidence = 'tool_declared';
  } else if (signature) {
    [, type, name, purpose] = signature;
    evidence = 'ua_declared';
  } else if (/Mozilla\/.*(?:Chrome\/|Safari\/|Firefox\/|Edg\/)/i.test(ua)) {
    type = 'browser';
    name = 'browser';
    purpose = 'browse';
    evidence = 'browser_hint';
  } else if (new URL(request.url).pathname.startsWith('/api/v1/')) {
    type = 'tool_client';
    name = 'api_client';
    purpose = 'tool';
    evidence = 'tool_declared';
  }
  // Only authentic Worker metadata is trusted. Client headers cannot claim verification.
  if (signed === 1) {
    if (!signature || ['headless', 'script', 'generic_bot'].includes(signature[2])) {
      type = 'ai_agent';
      name = 'cf_agent';
      purpose = 'unknown';
    }
    evidence = 'cf_signed';
  } else if (verified === 1) {
    if (!signature) {
      type =
        cf?.verifiedBotCategory === 'Search Engine Crawler'
          ? 'search_crawler'
          : cf?.verifiedBotCategory === 'AI Crawler'
            ? 'ai_crawler'
            : 'automation';
      purpose = type === 'search_crawler' ? 'search' : 'unknown';
      name = 'cf_bot';
    }
    evidence = 'cf_verified';
  } else if (score !== null && score < 30 && (type === 'browser' || type === 'unknown')) {
    type = 'automation';
    name = 'generic_bot';
    purpose = 'unknown';
    evidence = 'cf_score';
  }
  return {
    actor_type: type,
    actor_name: name,
    actor_purpose: purpose,
    classification_evidence: evidence,
    classification_version: classificationVersion,
    bot_verified: verified,
    signed_agent: signed,
    bot_score: score,
  };
}

const publicPaths = new Set(pagePaths.map((p) => `/${p ? p + '/' : ''}`));
const guides = new Set(articles.filter((a) => a.category === 'learn').map((a) => a.slug));
const discovery = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap-index.xml',
  '/feed.xml',
  '/en/feed.xml',
  '/llms.txt',
  '/llms-full.txt',
  '/SKILL.md',
  '/skill.md',
  '/openapi.json',
  '/wenbu.mjs',
  '/agent-protocol.md',
  '/.well-known/mcp-registry-auth',
  '/.well-known/agent.json',
  '/.well-known/mcp.json',
]);
export function contentTarget(request: Request) {
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const path = new URL(request.url).pathname;
  if (discovery.has(path)) return { page: path, resource: 'discovery', locale: 'en' };
  if (path === '/knowledge/index.json') return { page: path, resource: 'json', locale: 'en' };
  const guide = path.match(/^\/knowledge\/(zh|en)\/([a-z0-9-]+)\.(md|json)$/);
  if (
    guide &&
    (guides.has(guide[2]) ||
      isEditorialPath(guide[2].startsWith('compare-') ? 'compare/' + guide[2].slice(8) : 'learn/' + guide[2]))
  )
    return {
      page: guide[2].startsWith('compare-') ? `/compare/${guide[2].slice(8)}/` : `/learn/${guide[2]}/`,
      resource: guide[3] === 'md' ? 'markdown' : 'json',
      locale: guide[1],
    };
  const normalized = path.replace(/^\/en(?=\/|$)/, '') || '/';
  const canonical = normalized.endsWith('/') ? normalized : normalized + '/';
  if (!publicPaths.has(canonical) && !isEditorialPath(canonical)) return;
  return {
    page: safePage(canonical),
    resource: 'html',
    locale: path === '/en' || path.startsWith('/en/') ? 'en' : 'zh',
  };
}
