// Identity, acquisition and transport are independent dimensions.
export const actorTypes = [
  'browser',
  'search_crawler',
  'ai_crawler',
  'ai_agent',
  'automation',
  'tool_client',
  'unknown',
  'legacy',
] as const;
export const actorPurposes = [
  'browse',
  'search',
  'training',
  'user_fetch',
  'tool',
  'other',
  'unknown',
  'legacy',
] as const;
export const actorNames = [
  'browser',
  'googlebot',
  'bingbot',
  'baiduspider',
  'duckduckbot',
  'yandexbot',
  'oai_searchbot',
  'gptbot',
  'chatgpt_user',
  'claudebot',
  'claude_searchbot',
  'claude_user',
  'perplexitybot',
  'perplexity_user',
  'bytespider',
  'headless',
  'script',
  'generic_bot',
  'cf_bot',
  'cf_agent',
  'mcp_client',
  'cli_client',
  'api_client',
  'unknown',
  'legacy',
] as const;
export const classificationEvidence = [
  'ua_declared',
  'browser_hint',
  'tool_declared',
  'cf_verified',
  'cf_signed',
  'cf_score',
  'unknown',
  'legacy',
] as const;
export const resourceTypes = [
  'html',
  'markdown',
  'json',
  'discovery',
  'service',
  'client_event',
  'legacy',
] as const;
export const trafficDimensions = {
  actor_type: actorTypes,
  actor_name: actorNames,
  actor_purpose: actorPurposes,
  classification_evidence: classificationEvidence,
  resource_type: resourceTypes,
  http_method: ['GET', 'HEAD', 'POST', 'OPTIONS', 'OTHER'],
} as const;
export const classificationVersion = 1;
// Historical records lack UA / Cloudflare evidence. Keep their provenance visible.
export const browserAudienceSQL =
  "(actor_type='browser' OR (actor_type='legacy' AND device!='bot' AND origin!='edge'))";
export const browserViewSQL = `(event='page_view' AND ${browserAudienceSQL})`;
export const contentRequestSQL = "(event='page_request' AND http_method='GET')";
// One terminal record per operation; MCP calculations have an enclosing tools/call receipt.
export const serviceRequestSQL =
  "(origin='server' AND event IN ('calculation_succeeded','interpret_succeeded','daily_ready','agent_finished','api_failed','mcp_finished') AND (channel!='mcp' OR event IN ('mcp_finished','api_failed')))";
