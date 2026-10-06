import { z } from 'zod';
import type { Env } from './types';
import { classifyTraffic, contentTarget } from './traffic';
import {
  actions,
  campaigns,
  clientEvents,
  mediums,
  safePage,
  sources,
  statuses,
  tools,
  settings,
  variants,
  analyticsRelease,
  referrerSource,
} from '../src/lib/analytics-contract';

export const contextSchema = z
  .object({
    session: z.uuid(),
    visitor: z.uuid(),
    page: z.string().max(120).transform(safePage),
    entry: z.string().max(120).transform(safePage),
    locale: z.enum(['zh', 'en']),
    source: z.enum(sources),
    medium: z.enum(mediums),
    campaign: z.enum(campaigns),
    test: z.boolean().default(false),
    pageId: z.uuid().optional(),
    operation: z.uuid().optional(),
    parentOperation: z.uuid().optional(),
    conversation: z.uuid().optional(),
    release: z.enum(['legacy', '2026-09-29-feedback-v1', analyticsRelease]).default('legacy'),
  })
  .strict();
export const eventSchema = contextSchema
  .extend({
    id: z.uuid(),
    occurredAt: z.number().int().nonnegative().max(8640000000000000).optional(),
    sequence: z.number().int().nonnegative().max(10000000).optional(),
    version: z.literal(2).optional(),
    destination: z.string().max(120).transform(safePage).default('/other/'),
    setting: z.enum(settings).default('none'),
    variant: z.enum(variants).default('none'),
    event: z.enum(clientEvents),
    tool: z.enum(tools).default('none'),
    mode: z.enum(['none', 'explore', 'research']).default('none'),
    action: z.enum(actions).default('none'),
    status: z.enum(statuses).default('none'),
    value: z.number().int().min(0).max(100).default(0),
    duration: z.number().int().min(0).max(3600000).default(0),
  })
  .strict();
export const eventBatch = z.object({ events: z.array(eventSchema).min(1).max(10) }).strict();
export type ServiceMetric = {
  event:
    | 'calculation_succeeded'
    | 'interpret_succeeded'
    | 'agent_finished'
    | 'agent_tool_finished'
    | 'api_failed'
    | 'mcp_finished';
  tool: (typeof tools)[number];
  status: (typeof statuses)[number];
  action?: (typeof actions)[number];
  mode?: 'none' | 'explore' | 'research';
  locale?: 'zh' | 'en';
  duration: number;
  modelCalls?: number;
  toolCalls?: number;
  artifacts?: number;
};

export function requestDimensions(request: Request) {
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 2048);
  const actor = classifyTraffic(request);
  const browserLike = /Mozilla\/.*(?:Chrome\/|Safari\/|Firefox\/|Edg\/)/i.test(ua);
  return {
    device: ['search_crawler', 'ai_crawler', 'ai_agent', 'automation'].includes(actor.actor_type)
      ? 'bot'
      : /iPad|Tablet/i.test(ua)
        ? 'tablet'
        : /Mobi|Android/i.test(ua)
          ? 'mobile'
          : browserLike
            ? 'desktop'
            : 'unknown',
    browser: /Edg\//.test(ua)
      ? 'edge'
      : /Firefox\//.test(ua)
        ? 'firefox'
        : /Chrome\//.test(ua)
          ? 'chrome'
          : /Safari\//.test(ua)
            ? 'safari'
            : 'other',
    os: /iPhone|iPad/.test(ua)
      ? 'ios'
      : /Android/.test(ua)
        ? 'android'
        : /Windows/.test(ua)
          ? 'windows'
          : /Macintosh/.test(ua)
            ? 'macos'
            : /Linux/.test(ua)
              ? 'linux'
              : 'other',
    ...actor,
    country: /^[A-Z]{2}$/.test(String(request.cf?.country ?? '')) ? String(request.cf?.country) : 'XX',
  };
}
const columns =
  'id,occurred_at,event,origin,session_id,visitor_id,page,entry_page,locale,source,medium,campaign,device,browser,os,country,channel,tool,mode,action,status,value,duration_ms,model_calls,tool_calls,artifacts,is_test,received_at,client_at,page_id,operation_id,parent_operation_id,conversation_id,sequence,schema_version,release,destination_page,setting,variant,actor_type,actor_name,actor_purpose,classification_evidence,classification_version,bot_verified,signed_agent,bot_score,resource_type,http_status,http_method';
const insert = `INSERT OR IGNORE INTO events (${columns}) VALUES (${Array(50).fill('?').join(',')})`;
export const noTracking = (request: Request) =>
  request.headers.get('DNT') === '1' ||
  request.headers.get('Sec-GPC') === '1' ||
  request.headers.get('X-Wenbu-Analytics') === 'off' ||
  /(?:^|;\s*)wenbu_analytics=off(?:;|$)/.test(request.headers.get('Cookie') ?? '');
export const isTestRequest = (request: Request) =>
  request.headers.get('X-Wenbu-Test') === 'true' ||
  /(?:^|;\s*)wenbu_analytics_test=1(?:;|$)/.test(request.headers.get('Cookie') ?? '');
function trafficValues(request: Request, resource: string, status: number | null = null) {
  const c = classifyTraffic(request);
  return [
    c.actor_type,
    c.actor_name,
    c.actor_purpose,
    c.classification_evidence,
    c.classification_version,
    c.bot_verified,
    c.signed_agent,
    c.bot_score,
    resource,
    status,
    ['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method) ? request.method : 'OTHER',
  ];
}
export async function collectEvents(raw: unknown, request: Request, env: Env) {
  const { events } = eventBatch.parse(raw);
  if (noTracking(request)) return { accepted: 0 };
  if (!env.ANALYTICS) throw new Error('Analytics unavailable');
  const meta = requestDimensions(request);
  const received = Date.now();
  const result = await env.ANALYTICS.batch(
    events.map((e) =>
      env
        .ANALYTICS!.prepare(insert)
        .bind(
          e.id,
          e.occurredAt !== undefined &&
            e.occurredAt >= received - 7 * 86400000 &&
            e.occurredAt <= received + 300000
            ? e.occurredAt
            : received,
          e.event,
          'client',
          e.session,
          e.visitor,
          e.page,
          e.entry,
          e.locale,
          e.source,
          e.medium,
          e.campaign,
          meta.device,
          meta.browser,
          meta.os,
          meta.country,
          'web',
          e.tool,
          e.mode,
          e.action,
          e.status,
          e.value,
          e.duration,
          0,
          0,
          0,
          Number(e.test || isTestRequest(request)),
          received,
          e.occurredAt ?? null,
          e.pageId ?? null,
          e.operation ?? null,
          e.parentOperation ?? null,
          e.conversation ?? null,
          e.sequence ?? null,
          e.version ?? 1,
          e.release,
          e.destination,
          e.setting,
          e.variant,
          ...trafficValues(request, 'client_event'),
        ),
    ),
  );
  return { accepted: result.reduce((n, r) => n + (r.meta.changes ?? 0), 0) };
}
export function requestContext(request: Request) {
  if (noTracking(request)) return undefined;
  let context: z.infer<typeof contextSchema> | undefined;
  // Public correlation labels are approximate product analytics, never billing identity.
  const header = request.headers.get('X-Wenbu-Analytics');
  if (header && header.length <= 1500) {
    try {
      context = contextSchema.parse(JSON.parse(header));
    } catch {
      /* Discard the entire untrusted context. */
    }
  }
  return context;
}
export async function recordService(request: Request, env: Env, metric: ServiceMetric) {
  if (!env.ANALYTICS || noTracking(request)) return;
  const context = requestContext(request);
  const meta = requestDimensions(request);
  const path = new URL(request.url).pathname;
  const channel = path.startsWith('/mcp')
    ? 'mcp'
    : request.headers.get('X-Wenbu-Client') === 'cli'
      ? 'cli'
      : context || request.headers.get('X-Wenbu-Client') === 'web'
        ? 'web'
        : 'api';
  await env.ANALYTICS.prepare(insert)
    .bind(
      crypto.randomUUID(),
      Date.now(),
      metric.event,
      'server',
      context?.session ?? null,
      context?.visitor ?? null,
      context?.page ?? '/api/',
      context?.entry ?? '/api/',
      context?.locale ?? metric.locale ?? 'en',
      context?.source ?? 'direct',
      context?.medium ?? 'none',
      context?.campaign ?? 'none',
      meta.device,
      meta.browser,
      meta.os,
      meta.country,
      channel,
      metric.tool,
      metric.mode ?? 'none',
      metric.action ?? (request.headers.get('X-Wenbu-Action') === 'example' ? 'example' : 'none'),
      metric.status,
      0,
      Math.min(3600000, Math.max(0, Math.round(metric.duration))),
      metric.modelCalls ?? 0,
      metric.toolCalls ?? 0,
      metric.artifacts ?? 0,
      Number(context?.test || isTestRequest(request)),
      Date.now(),
      null,
      context?.pageId ?? null,
      context?.operation ?? null,
      context?.parentOperation ?? null,
      context?.conversation ?? null,
      null,
      2,
      analyticsRelease,
      '/other/',
      'none',
      'none',
      ...trafficValues(request, 'service'),
    )
    .run();
}

/** Counts content requests only; never creates visitor/session identities or a second PV. */
export async function recordContent(request: Request, response: Response, env: Env, duration: number) {
  const target = contentTarget(request);
  if (!env.ANALYTICS || noTracking(request) || !target) return;
  const time = Date.now(),
    meta = requestDimensions(request),
    url = new URL(request.url);
  const source =
    sources.find((s) => s === url.searchParams.get('utm_source')) ??
    referrerSource(request.headers.get('Referer') ?? '', url.origin);
  const medium =
    mediums.find((m) => m === url.searchParams.get('utm_medium')) ??
    (['google', 'bing', 'baidu', 'duckduckgo'].includes(source)
      ? 'organic'
      : ['chatgpt', 'perplexity', 'claude', 'deepseek'].includes(source)
        ? 'ai'
        : source === 'direct'
          ? 'none'
          : 'referral');
  await env.ANALYTICS.prepare(insert)
    .bind(
      crypto.randomUUID(),
      time,
      'page_request',
      'edge',
      null,
      null,
      target.page,
      '/other/',
      target.locale,
      source,
      medium,
      campaigns.find((c) => c === url.searchParams.get('utm_campaign')) ?? 'none',
      meta.device,
      meta.browser,
      meta.os,
      meta.country,
      'web',
      'none',
      'none',
      'none',
      'none',
      0,
      Math.min(3600000, Math.max(0, Math.round(duration))),
      0,
      0,
      0,
      Number(isTestRequest(request)),
      time,
      null,
      null,
      null,
      null,
      null,
      null,
      2,
      analyticsRelease,
      '/other/',
      'none',
      'none',
      ...trafficValues(request, target.resource, response.status),
    )
    .run();
}

export async function authorizedAnalytics(request: Request, env: Env) {
  if (!env.ANALYTICS_ADMIN_TOKEN) return false;
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!token || token.length > 256) return false;
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const a = await digest(token),
    b = await digest(env.ANALYTICS_ADMIN_TOKEN);
  return a.reduce((difference, byte, i) => difference | (byte ^ b[i]), 0) === 0;
}
export { analyticsReport } from './analytics-report';
export async function pruneAnalytics(env: Env) {
  if (env.ANALYTICS)
    await env.ANALYTICS.prepare('DELETE FROM events WHERE received_at < ? AND archive_key IS NOT NULL')
      .bind(Date.now() - 90 * 86400000)
      .run();
}
