/** Deliberately closed vocabulary: no prompts, birth inputs, arbitrary URLs or labels. */
export const clientEvents = [
  'page_view',
  'daily_revealed',
  'daily_revisited',
  'daily_reflection_saved',
  'daily_agent_opened',
  'daily_exported',
  'registration_prompt_viewed',
  'registration_offer_viewed',
  'registration_offer_clicked',
  'registration_offer_dismissed',
  'auth_started',
  'page_exit',
  'setting_changed',
  'feedback_opened',
  'telemetry_gap',
  'engaged',
  'scroll_depth',
  'cta_click',
  'tool_started',
  'result_viewed',
  'ai_requested',
  'ai_result_viewed',
  'agent_started',
  'agent_received',
  'agent_result_visible',
  'agent_example_opened',
  'agent_stopped',
  'guide_opened',
  'guide_step',
  'guide_skipped',
  'guide_draft_created',
  'suggestion_selected',
  'artifact_opened',
  'report_exported',
  'conversation_exported',
  'context_exported',
  'journal_exported',
  'journal_saved',
  'context_opened',
  'card_inspected',
  'source_opened',
  'form_started',
  'client_error',
] as const;
export type ClientEvent = (typeof clientEvents)[number];
export const tools = [
  'none',
  'bazi',
  'iching',
  'tarot',
  'ziwei',
  'agent',
  'interpret',
  'mcp',
  'daily',
] as const;
export const sources = [
  'direct',
  'google',
  'bing',
  'baidu',
  'duckduckgo',
  'chatgpt',
  'perplexity',
  'claude',
  'deepseek',
  'github',
  'mcp-registry',
  'x',
  'weibo',
  'xiaohongshu',
  'youtube',
  'newsletter',
  'other',
  'internal',
] as const;
export const mediums = ['none', 'organic', 'referral', 'social', 'email', 'cpc', 'ai', 'other'] as const;
// Add campaign slugs here BEFORE distribution. Never collect arbitrary UTM values.
export const campaigns = [
  'none',
  'launch',
  'tarot-deck',
  'agent-studio',
  'bazi-guide',
  'developer-tools',
  'open-source-2026',
  'mcp-registry',
  'first-reading',
  'daily-card',
] as const;
export const actions = [
  'none',
  'account-header',
  'account-result',
  'account-save',
  'account-history',
  'hero-agent',
  'hero-chart',
  'hero-example',
  'home-agent',
  'daily-entry',
  'daily-reveal',
  'daily-save',
  'daily-reflection',
  'daily-agent',
  'daily-history',
  'daily-export',
  'tool-entry',
  'navigation',
  'article-tool',
  'article-guide-agent',
  'guide-markdown',
  'guide-json',
  'library-start',
  'library-article',
  'library-search',
  'library-filter',
  'library-view',
  'article-next',
  'example',
  'calculate',
  'export',
  'save',
  'inspect',
  'source',
  'context',
  'guided',
  'clarification',
  'followup',
  'feedback',
  'agent-search',
  'agent-read',
  'agent-calculate',
  'agent-report',
  'agent-clarify',
] as const;
export const analyticsRelease = '2026-10-15-daily-v1';
export const settings = ['none', 'tarot-count', 'tarot-reversals', 'iching-cast', 'agent-mode'] as const;
export const variants = [
  'none',
  'one',
  'three',
  'upright',
  'reversals',
  'random',
  'manual',
  'explore',
  'research',
  'queue-expired',
  'queue-full',
  'rejected',
] as const;
export const statuses = [
  'none',
  'complete',
  'waiting',
  'limited',
  'error',
  'cancelled',
  'timeout',
  'rate_limited',
  'invalid_input',
  'unavailable',
] as const;
export const pagePaths = [
  '',
  'bazi',
  'iching',
  'tarot',
  'daily',
  'tarot/deck',
  'ziwei',
  'journal',
  'learn',
  'compare',
  'blog',
  'blog/connect-your-agent',
  'agents',
  'agent',
  'sources',
  'about',
  'methodology',
  'privacy',
  'terms',
  'free',
  'compare/fatetell',
  'compare/labyrinthos',
  'compare/chatbot',
  'learn/bazi-basics',
  'learn/five-elements',
  'learn/birth-time-timezone',
  'learn/iching-three-coins',
  'learn/tarot-beginner',
  'learn/ziwei-twelve-palaces',
  'learn/unknown-birth-time',
  'learn/ai-divination',
  'learn/chinese-zodiac-vs-bazi',
  'learn/bazi-vs-western-astrology',
  'learn/choose-a-tool',
  'learn/first-reading',
  'learn/ask-a-better-question',
  'learn/prepare-birth-details',
  'learn/read-ai-with-sources',
  'learn/review-a-reading',
  'learn/bazi-ten-gods',
  'learn/iching-trigrams',
  'learn/tarot-suits-and-court-cards',
  'learn/tarot-reversals',
  'learn/ziwei-four-transformations',
  'blog/a-reading-you-can-return-to',
  'blog/why-calculation-comes-first',
] as const;
const registeredEditorialPaths = new Set<string>();
export function registerEditorialPaths(paths: string[]) {
  for (const path of paths)
    if (/^(?:learn|compare)\/[a-z][a-z0-9-]{2,65}$/.test(path)) registeredEditorialPaths.add(path);
}
export function isEditorialPath(path: string) {
  return registeredEditorialPaths.has(path.replace(/^\//, '').replace(/\/$/, ''));
}
export function safePage(path: string): string {
  const p = path
    .split(/[?#]/)[0]
    .replace(/^\//, '')
    .replace(/^en\/?/, '')
    .replace(/\/$/, '');
  return (pagePaths as readonly string[]).includes(p) || registeredEditorialPaths.has(p)
    ? '/' + (p ? p + '/' : '')
    : '/other/';
}
export function referrerSource(referrer: string, origin: string): (typeof sources)[number] {
  if (!referrer) return 'direct';
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return 'internal';
    const wenbuOrigins = ['https://wenbu.app', 'https://www.wenbu.app', 'https://wenbu.genedai.me'];
    if (wenbuOrigins.includes(origin) && wenbuOrigins.includes(url.origin)) return 'internal';
    const host = url.hostname.replace(/^www\./, '');
    const known: Record<string, (typeof sources)[number]> = {
      'google.com': 'google',
      'google.co.uk': 'google',
      'bing.com': 'bing',
      'baidu.com': 'baidu',
      'duckduckgo.com': 'duckduckgo',
      'chatgpt.com': 'chatgpt',
      'chat.openai.com': 'chatgpt',
      'perplexity.ai': 'perplexity',
      'claude.ai': 'claude',
      'chat.deepseek.com': 'deepseek',
      'github.com': 'github',
      'registry.modelcontextprotocol.io': 'mcp-registry',
      't.co': 'x',
      'x.com': 'x',
      'twitter.com': 'x',
      'weibo.com': 'weibo',
      'xiaohongshu.com': 'xiaohongshu',
      'youtube.com': 'youtube',
    };
    return known[host] ?? 'other';
  } catch {
    return 'other';
  }
}
