import { z } from 'zod';
import { version as releaseVersion } from '../package.json';
import { measurementVersion } from '../src/lib/measurement-contract';
import { domainRedirect } from './domain';
import { calculate } from '../src/lib/tools';
import { InputError, type ToolKind } from '../src/lib/schema';
import { ApiError, interpret } from './ai';
import { handleMcp } from './mcp';
import type { Env } from './types';
import { AGENT_BODY_LIMIT } from '../src/lib/agent-protocol';
import {
  collectEvents,
  recordService,
  recordContent,
  authorizedAnalytics,
  analyticsReport,
  type ServiceMetric,
} from './analytics';
import { submitFeedback, updateFeedback } from './feedback';
import { historyReport, feedbackDetail, storageStatus, archiveAnalytics, archiveDownload } from './history';
import { INDEXNOW_CRON, indexNowStatus, submitIndexNow } from './indexnow';
export { UsageGate } from './quota';
export { DeletionLedger } from './deletion-ledger';
import { handleAuth } from './account-auth';
import { handleAccounts, reconcileDeletionLedger, pruneAccountMetadata } from './accounts';
import { AccountError, accountJson } from './account-security';
import { requestActor, resultReceipt } from './account-operations';
import { accountAgentResponse } from './account-agent';
import { accountInsights } from './account-insights';

const apiHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: apiHeaders });
}
export async function boundedBody(request: Request, limit = 8192) {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json'))
    throw new ApiError(415, 'content_type', 'Use application/json.');
  if (Number(request.headers.get('Content-Length') || 0) > limit)
    throw new ApiError(413, 'body_too_large', 'Request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'missing_body', 'JSON body required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new ApiError(413, 'body_too_large', 'Request body is too large.');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, 'invalid_json', 'Invalid JSON.');
  }
}
export function originAllowed(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // CLI and server MCP clients have no browser Origin.
  const target = new URL(request.url);
  if (origin === env.SITE_URL || origin === target.origin) return true;
  if (['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    try {
      return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
    } catch {
      return false;
    }
  }
  return false;
}
export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const redirect = domainRedirect(request, env.SITE_URL);
    if (redirect) return redirect;
    const path = url.pathname;
    if (!path.startsWith('/api/') && path !== '/mcp' && path !== '/mcp/') {
      const started = Date.now();
      const response = await env.ASSETS.fetch(request);
      const task = recordContent(request, response, env, Date.now() - started).catch(() =>
        console.error('WENBU_ANALYTICS_WRITE_FAILED'),
      );
      if (ctx) ctx.waitUntil(task);
      else await task;
      return response;
    }
    if (!originAllowed(request, env))
      return json({ error: { code: 'origin_denied', message: 'Origin not allowed.' } }, 403);
    const started = Date.now();
    const observedTool = (
      path === '/mcp' || path === '/mcp/'
        ? 'mcp'
        : path.match(/^\/api\/v1\/(bazi|iching|tarot|ziwei|agent|interpret)$/)?.[1]
    ) as ServiceMetric['tool'] | undefined;
    let locale: 'zh' | 'en' = 'en';
    const record = (metric: ServiceMetric) => {
      const task = recordService(request, env, metric).catch(() => {
        // No request data or exception payload: expose a fixed operational signal only.
        console.error('WENBU_ANALYTICS_WRITE_FAILED');
      });
      if (ctx) ctx.waitUntil(task);
    };
    try {
      if (path.startsWith('/api/auth/')) return await handleAuth(request, env);
      if (path === '/api/account' || path.startsWith('/api/account/'))
        return await handleAccounts(request, env);
      if (path === '/api/events') {
        if (request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405);
        if (request.headers.get('Origin') !== url.origin)
          return json({ error: { code: 'origin_denied' } }, 403);
        if (
          env.ANALYTICS_LIMITER &&
          !(await env.ANALYTICS_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' }))
            .success
        )
          return json({ error: { code: 'rate_limited' } }, 429);
        if (!env.ANALYTICS) return json({ error: { code: 'analytics_unavailable' } }, 503);
        return json(await collectEvents(await boundedBody(request, 16000), request, env));
      }
      if (path === '/api/feedback') {
        if (request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405);
        if (request.headers.get('Origin') !== url.origin)
          return json({ error: { code: 'origin_denied' } }, 403);
        if (
          env.FEEDBACK_LIMITER &&
          !(await env.FEEDBACK_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' }))
            .success
        )
          return json({ error: { code: 'rate_limited' } }, 429);
        return json(await submitFeedback(await boundedBody(request, 48000), request, env));
      }
      if (path.startsWith('/api/admin/')) {
        if (
          env.ADMIN_LIMITER &&
          !(await env.ADMIN_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' }))
            .success
        )
          return json({ error: { code: 'rate_limited' } }, 429);
        if (!(await authorizedAnalytics(request, env))) return json({ error: { code: 'unauthorized' } }, 401);
        if (path === '/api/admin/accounts/reconcile' && request.method === 'POST') {
          if (request.headers.get('Origin') !== env.SITE_URL)
            return json({ error: { code: 'origin_denied' } }, 403);
          return accountJson(await reconcileDeletionLedger(env));
        }
        if (path === '/api/admin/accounts/analytics' && request.method === 'GET')
          return accountJson(await accountInsights(url, env));
        if (!env.ANALYTICS) return json({ error: { code: 'analytics_unavailable' } }, 503);
        if (request.method === 'GET') {
          if (path === '/api/admin/indexnow') return json(await indexNowStatus(env));
          if (path === '/api/admin/analytics') return json(await analyticsReport(url, env));
          if (path === '/api/admin/events') return json(await historyReport(url, env, 'events'));
          if (path === '/api/admin/feedback') return json(await historyReport(url, env, 'feedback'));
          if (path === '/api/admin/archives') return json(await historyReport(url, env, 'archives'));
          if (path === '/api/admin/storage') return json(await storageStatus(env));
          if (path === '/api/admin/archive') return archiveDownload(url.searchParams.get('key') ?? '', env);
          if (path.startsWith('/api/admin/feedback/'))
            return json(await feedbackDetail(path.slice('/api/admin/feedback/'.length), env));
        }
        if (request.method === 'PATCH' && path.startsWith('/api/admin/feedback/')) {
          if (request.headers.get('Origin') !== url.origin)
            return json({ error: { code: 'origin_denied' } }, 403);
          return json(
            await updateFeedback(path.slice('/api/admin/feedback/'.length), await boundedBody(request), env),
          );
        }
        if (request.method === 'POST' && path === '/api/admin/archives/run') {
          if (request.headers.get('Origin') !== url.origin)
            return json({ error: { code: 'origin_denied' } }, 403);
          return json(await archiveAnalytics(env));
        }
        if (request.method === 'POST' && path === '/api/admin/indexnow/run') {
          if (url.origin !== env.SITE_URL || request.headers.get('Origin') !== url.origin)
            return json({ error: { code: 'origin_denied' } }, 403);
          return json(await submitIndexNow(env));
        }
        return json({ error: { code: 'not_found' } }, 404);
      }
      if (path === '/api/health' && request.method === 'GET')
        return json({
          status: 'ok',
          version: releaseVersion,
          measurementVersion,
          aiConfigured: Boolean(env.DEEPSEEK_API_KEY && env.QUOTA_SALT),
          requestedModel: env.DEEPSEEK_MODEL,
        });
      if (request.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: {
            ...apiHeaders,
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers':
              'Content-Type, Accept, MCP-Protocol-Version, X-Wenbu-Client, X-Wenbu-Analytics, X-Wenbu-Action',
            'Access-Control-Allow-Origin': request.headers.get('Origin') || env.SITE_URL,
            Vary: 'Origin',
          },
        });
      if (env.RATE_LIMITER) {
        const result = await env.RATE_LIMITER.limit({
          key: request.headers.get('CF-Connecting-IP') ?? 'local',
        });
        if (!result.success) {
          if (observedTool)
            record({
              event: 'api_failed',
              tool: observedTool,
              status: 'rate_limited',
              duration: Date.now() - started,
            });
          return json({ error: { code: 'rate_limited', message: 'Please slow down. / 请稍后再试。' } }, 429);
        }
      }
      if (path === '/mcp' || path === '/mcp/') {
        if (request.method === 'POST') {
          const body = await boundedBody(request);
          request = new Request(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(body),
          });
        }
        const response = await handleMcp(request, (tool, success, duration, status) =>
          record({
            event: tool === 'mcp' ? 'mcp_finished' : success ? 'calculation_succeeded' : 'api_failed',
            tool,
            status: status ?? (success ? 'complete' : 'invalid_input'),
            duration,
          }),
        );
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(apiHeaders)) if (k !== 'Content-Type') headers.set(k, v);
        return new Response(response.body, { status: response.status, headers });
      }
      if (request.method !== 'POST')
        return json({ error: { code: 'method_not_allowed', message: 'Use POST with a JSON body.' } }, 405);
      const raw = await boundedBody(request, path === '/api/v1/agent' ? AGENT_BODY_LIMIT : 8192);
      locale = raw && typeof raw === 'object' && raw.locale === 'zh' ? 'zh' : 'en';
      const actor = path.startsWith('/api/v1/') ? await requestActor(request, env) : undefined;
      if (path === '/api/v1/agent')
        return await accountAgentResponse(
          raw,
          request,
          env,
          actor,
          (metric) => record({ ...metric, locale, duration: Date.now() - started }),
          record,
        );
      if (path === '/api/v1/interpret') {
        const result = await interpret(raw, request, env, actor);
        record({
          event: 'interpret_succeeded',
          tool: 'interpret',
          status: 'complete',
          locale,
          duration: Date.now() - started,
        });
        const receipt = actor ? await resultReceipt(env, actor, 'journal', result, 'answer') : undefined;
        return accountJson(result, 200, {
          ...(actor?.cookie ? { 'Set-Cookie': actor.cookie } : {}),
          ...(receipt ? { 'X-Wenbu-Receipt': receipt } : {}),
        });
      }
      const kind = path.match(/^\/api\/v1\/(bazi|iching|tarot|ziwei)$/)?.[1] as ToolKind | undefined;
      if (!kind) return json({ error: { code: 'not_found', message: 'Unknown endpoint.' } }, 404);
      const result = calculate(kind, raw);
      record({
        event: 'calculation_succeeded',
        tool: kind,
        status: 'complete',
        locale,
        duration: Date.now() - started,
      });
      const receipt =
        actor && request.headers.get('X-Wenbu-Action') !== 'example'
          ? await resultReceipt(env, actor, 'journal', { result })
          : undefined;
      return accountJson(result, 200, {
        ...(receipt ? { 'X-Wenbu-Receipt': receipt } : {}),
        ...(actor?.cookie ? { 'Set-Cookie': actor.cookie } : {}),
      });
    } catch (error) {
      if (error instanceof AccountError)
        return accountJson({ error: { code: error.code }, detail: error.detail }, error.status);
      if (observedTool)
        record({
          event: 'api_failed',
          tool: observedTool,
          locale,
          status:
            error instanceof ApiError && error.status === 429
              ? 'rate_limited'
              : error instanceof InputError ||
                  error instanceof z.ZodError ||
                  (error instanceof ApiError && error.status >= 400 && error.status < 500)
                ? 'invalid_input'
                : error instanceof ApiError && error.status === 503
                  ? 'unavailable'
                  : 'error',
          duration: Date.now() - started,
        });
      if (error instanceof ApiError)
        return json({ error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof InputError)
        return json({ error: { code: 'invalid_input', message: error.message } }, 422);
      if (error instanceof z.ZodError)
        return json(
          {
            error: {
              code: 'invalid_input',
              message: 'Please check the input fields. / 请检查填写内容。',
              fields: error.issues.map((x) => ({ path: x.path.join('.'), code: x.code })),
            },
          },
          422,
        );
      return json(
        {
          error: {
            code: 'internal_error',
            message: 'This request could not be completed. / 本次请求未完成，请稍后再试。',
          },
        },
        500,
      );
    }
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === '15 * * * *') {
      ctx.waitUntil(archiveAnalytics(env));
      ctx.waitUntil(pruneAccountMetadata(env));
    }
    if (event.cron === INDEXNOW_CRON) ctx.waitUntil(submitIndexNow(env));
  },
} satisfies ExportedHandler<Env>;
