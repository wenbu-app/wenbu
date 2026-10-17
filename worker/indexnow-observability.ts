import config from '../src/data/indexnow.json';
import { INDEXNOW_USER_AGENT } from './indexnow';
import { indexNowDiagnostics } from './indexnow-diagnostics';
import type { Env } from './types';

const HOUR = 3600_000;
const RETENTION = 30 * 24 * HOUR;
const KEY_LOCATION = `${config.origin}/${config.key}.txt`;

export function isIndexNowVerification(request: Request) {
  const url = new URL(request.url);
  return (
    url.origin === config.origin &&
    url.pathname === `/${config.key}.txt` &&
    ['GET', 'HEAD'].includes(request.method)
  );
}

function claimedSource(ua: string) {
  if (/^Wenbu(?:IndexNow|Operations)\//i.test(ua)) return 'wenbu_probe';
  if (/bingbot|bingpreview|microsoftpreview/i.test(ua)) return 'bing_claim';
  if (/indexnow/i.test(ua)) return 'indexnow_claim';
  if (/googlebot/i.test(ua)) return 'google_claim';
  if (/^node$|^undici|^curl\//i.test(ua)) return 'generic_client';
  if (/Mozilla\//i.test(ua)) return 'browser_claim';
  return 'unknown';
}

/** First 32 metadata samples per hour, exact counters, and a rolling 30-day window. */
export async function recordIndexNowVerification(request: Request, response: Response, env: Env) {
  if (!env.ANALYTICS || !isIndexNowVerification(request)) return;
  const at = Date.now();
  const cf = request.cf as
    { asn?: number; colo?: string; botManagement?: { verifiedBot?: boolean } } | undefined;
  const sample = JSON.stringify({
    at,
    method: request.method,
    status: response.status,
    claimedSource: claimedSource(request.headers.get('User-Agent') ?? ''),
    asn: Number.isSafeInteger(cf?.asn) && cf!.asn! > 0 ? cf!.asn : null,
    colo: /^[A-Z]{3}$/.test(cf?.colo ?? '') ? cf!.colo : null,
    verifiedBot: typeof cf?.botManagement?.verifiedBot === 'boolean' ? cf.botManagement.verifiedBot : null,
  });
  await env.ANALYTICS.batch([
    env.ANALYTICS.prepare('DELETE FROM indexnow_verification_hours WHERE hour<?').bind(at - RETENTION),
    env.ANALYTICS.prepare(
      `INSERT INTO indexnow_verification_hours(hour,requests,ok,first_seen,last_seen,samples_json)
       VALUES(?,1,?,?,?,json_array(json(?))) ON CONFLICT(hour) DO UPDATE SET
       requests=requests+1,ok=ok+excluded.ok,last_seen=excluded.last_seen,
       samples_json=CASE WHEN json_array_length(samples_json)<32
         THEN json_insert(samples_json,'$[#]',json(?)) ELSE samples_json END`,
    ).bind(Math.floor(at / HOUR) * HOUR, Number(response.status === 200), at, at, sample, sample),
  ]);
}

async function boundedText(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  let text = '';
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw new Error('response_too_large');
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    void reader.cancel().catch(() => {});
  }
}

/** Fixed destinations only. No URL notification, credentials, incoming headers, or POST. */
export async function runIndexNowDiagnostic(env: Env, id: string) {
  if (!env.ANALYTICS || env.SITE_URL !== config.origin) return { status: 'disabled' };
  const probe = async (kind: 'endpoint_head' | 'public_key' | 'cloudflare_trace' | 'aws_checkip') => {
    try {
      const response = await fetch(
        kind === 'endpoint_head'
          ? config.endpoint
          : kind === 'public_key'
            ? KEY_LOCATION
            : kind === 'cloudflare_trace'
              ? 'https://www.cloudflare.com/cdn-cgi/trace'
              : 'https://checkip.amazonaws.com/',
        {
          method: kind === 'endpoint_head' ? 'HEAD' : 'GET',
          headers: { 'User-Agent': INDEXNOW_USER_AGENT },
          redirect: 'manual',
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (kind === 'endpoint_head')
        return { kind, status: response.status, ...(await indexNowDiagnostics(response)) };
      const body = await boundedText(response, kind === 'public_key' ? 512 : 2048).catch(() => null);
      if (kind === 'public_key')
        return {
          kind,
          status: response.status,
          exactKey: response.status === 200 && body?.trim() === config.key,
          bodyRead: body !== null,
          contentType: response.headers.get('content-type')?.slice(0, 100) ?? null,
          ray: response.headers.get('cf-ray')?.slice(0, 100) ?? null,
        };
      const fields =
        kind === 'aws_checkip'
          ? { ip: body?.trim(), colo: '' }
          : Object.fromEntries((body ?? '').split('\n').map((line) => line.split('=', 2)));
      return {
        kind,
        status: response.status,
        ipSeenByTrace: /^[\da-f.:]{3,45}$/i.test(fields.ip ?? '') ? fields.ip : null,
        colo: /^[A-Z]{3}$/.test(fields.colo ?? '') ? fields.colo : null,
        note: 'This destination observation only; not the IP seen by IndexNow. Cloudflare trace may show a cross-zone Worker identity.',
      };
    } catch {
      return { kind, status: null, error: 'probe_unavailable' };
    }
  };
  const probes = await Promise.all([
    probe('endpoint_head'),
    probe('public_key'),
    probe('cloudflare_trace'),
    probe('aws_checkip'),
  ]);
  const result = { id, checkedAt: new Date().toISOString(), notificationSent: false, probes };
  await env.ANALYTICS.batch([
    env.ANALYTICS.prepare('DELETE FROM indexnow_diagnostics WHERE checked_at<?').bind(Date.now() - RETENTION),
    env.ANALYTICS.prepare(
      'INSERT OR IGNORE INTO indexnow_diagnostics(id,checked_at,result_json) VALUES(?,?,?)',
    ).bind(id, Date.now(), JSON.stringify(result).replaceAll(config.key, '[ownership-key]')),
  ]);
  return result;
}

export async function dispatchIndexNowDiagnostic(env: Env) {
  if (!env.INDEXNOW_WORKFLOW || env.SITE_URL !== config.origin) return { status: 'disabled' };
  // One manually requested diagnostic per UTC date; not a new timer or notification retry.
  const id = `indexnow-diagnostic-${new Date().toISOString().slice(0, 10)}`;
  await env.INDEXNOW_WORKFLOW.createBatch([{ id, params: { mode: 'diagnostic' } }]);
  return { id, ...(await (await env.INDEXNOW_WORKFLOW.get(id)).status()), notificationSent: false };
}

export async function indexNowDiagnosticStatus(env: Env) {
  if (!env.ANALYTICS) return { available: false };
  const [runs, verification] = await Promise.all([
    env.ANALYTICS.prepare(
      'SELECT id,checked_at,result_json FROM indexnow_diagnostics ORDER BY checked_at DESC LIMIT 5',
    ).all(),
    env.ANALYTICS.prepare(
      'SELECT * FROM indexnow_verification_hours WHERE hour>=? ORDER BY hour DESC LIMIT 48',
    )
      .bind(Date.now() - RETENTION)
      .all(),
  ]);
  return {
    available: true,
    runs: runs.results,
    verification: verification.results,
    coverage:
      'Worker-handled canonical key GET/HEAD; exact hourly counters, first 32 metadata samples/hour, 30-day retention. Edge-blocked requests require Cloudflare analytics. UA claims do not verify bot identity.',
  };
}
