import type { Env } from './types';

export const DEEPSEEK_PRICING_VERSION = 'deepseek-cny-2026-11-09';
export const DEEPSEEK_PRICING_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/';
const fallbackPrefix = 'model-usage-pending/';

export type ModelScene =
  | 'editorial_draft'
  | 'editorial_repair'
  | 'editorial_review'
  | 'commissioning_proposal'
  | 'commissioning_review'
  | 'agent'
  | 'interpretation';

export type ModelAttribution = { scene: ModelScene; runId?: string; round?: number; contextVersion?: string };
type Receipt = { model?: unknown; usage?: unknown; httpStatus?: number; requestBytes?: number };
type Usage = {
  prompt: number;
  completion: number;
  hit: number | null;
  miss: number | null;
  reasoning: number | null;
};

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000
    ? value
    : null;

export function readDeepSeekUsage(raw: unknown): Usage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const fields = raw as Record<string, unknown>;
  const prompt = count(fields.prompt_tokens),
    completion = count(fields.completion_tokens);
  if (prompt === null || completion === null) return null;
  const details = fields.prompt_tokens_details as { cached_tokens?: unknown } | undefined;
  let hit = count(fields.prompt_cache_hit_tokens) ?? count(details?.cached_tokens);
  let miss = count(fields.prompt_cache_miss_tokens);
  if (hit === null && miss !== null && miss <= prompt) hit = prompt - miss;
  if (miss === null && hit !== null && hit <= prompt) miss = prompt - hit;
  if (hit !== null && miss !== null && hit + miss !== prompt) hit = miss = null;
  if ((hit ?? 0) > prompt || (miss ?? 0) > prompt) hit = miss = null;
  const output = fields.completion_tokens_details as { reasoning_tokens?: unknown } | undefined;
  const reasoning = count(output?.reasoning_tokens);
  return {
    prompt,
    completion,
    hit,
    miss,
    reasoning: reasoning !== null && reasoning <= completion ? reasoning : null,
  };
}

// Official 2026 public holiday periods, State Council notice 国办发明电〔2025〕7号.
const holidays2026 = [
  ['01-01', '01-03'],
  ['02-15', '02-23'],
  ['04-04', '04-06'],
  ['05-01', '05-05'],
  ['06-19', '06-21'],
  ['09-25', '09-27'],
  ['10-01', '10-07'],
];

export function deepSeekCost(model: string | null, usage: Usage | null, startedAt: number) {
  if (!usage || usage.hit === null || usage.miss === null) return null;
  // The documented Flash aliases are billed at the same rate. Other served
  // model names need an explicit tariff before displaying a cost estimate.
  const name = model?.toLowerCase();
  const rates = [
    'deepseek-flash',
    'deepseek-v4-flash',
    'deepseek-v4-flash-vision-exp',
    'deepseek-v4.1-flash-1017',
  ].includes(name ?? '')
    ? [20, 1000, 4000]
    : name === 'deepseek-v4-pro' || name === 'deepseek-v4-pro-0813'
      ? [150, 4500, 13500]
      : null;
  if (!rates) return null;
  const local = new Date(startedAt + 8 * 3600_000);
  if (local.getUTCFullYear() !== 2026) return null;
  const day = local.toISOString().slice(5, 10);
  const weekday = local.getUTCDay(),
    hour = local.getUTCHours();
  const peak =
    weekday >= 1 &&
    weekday <= 5 &&
    !holidays2026.some(([start, end]) => day >= start && day <= end) &&
    ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18));
  const nanos = (usage.hit * rates[0] + usage.miss * rates[1] + usage.completion * rates[2]) * (peak ? 2 : 1);
  return { nanos, band: peak ? 'peak' : 'off_peak', version: DEEPSEEK_PRICING_VERSION };
}

type LedgerRow = [
  id: string,
  scene: ModelScene,
  run: string | null,
  round: number | null,
  context: string | null,
  startedAt: number,
  finishedAt: number,
  requested: string,
  served: string | null,
  status: number | null,
  outcome: 'returned' | 'failed',
  requestBytes: number | null,
  prompt: number | null,
  completion: number | null,
  hit: number | null,
  miss: number | null,
  reasoning: number | null,
  cost: number | null,
  version: string | null,
  band: string | null,
];

const insertUsage = `INSERT OR IGNORE INTO model_usage
  (id,scene,run_id,round,context_version,started_at,finished_at,requested_model,served_model,http_status,outcome,
   request_bytes,prompt_tokens,completion_tokens,cache_hit_tokens,cache_miss_tokens,reasoning_tokens,
   cost_cny_nanos,pricing_version,rate_band) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

async function saveUsage(env: Env, row: LedgerRow) {
  if (!env.ANALYTICS) return;
  try {
    await env.ANALYTICS.prepare(insertUsage)
      .bind(...row)
      .run();
  } catch {
    try {
      if (!env.ANALYTICS_ARCHIVE) throw new Error('usage_archive_unavailable');
      await env.ANALYTICS_ARCHIVE.put(`${fallbackPrefix}${row[0]}.json`, JSON.stringify(row));
    } catch {
      console.error('model_usage_persistence_failed');
    }
  }
}

// Record one physical upstream attempt. Validation can fail after a billable
// response. The receipt contains numeric usage and no prompt or user data.
export async function trackDeepSeekCall<T>(
  env: Env,
  attribution: ModelAttribution,
  call: (receipt: Receipt) => Promise<T>,
) {
  const id = crypto.randomUUID(),
    startedAt = Date.now(),
    receipt: Receipt = {};
  let outcome: LedgerRow[10] = 'returned';
  try {
    return await call(receipt);
  } catch (error) {
    outcome = 'failed';
    throw error;
  } finally {
    const served =
      typeof receipt.model === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(receipt.model)
        ? receipt.model
        : null;
    const usage = readDeepSeekUsage(receipt.usage);
    const price = deepSeekCost(served, usage, startedAt);
    await saveUsage(env, [
      id,
      attribution.scene,
      attribution.runId ?? null,
      attribution.round ?? null,
      attribution.contextVersion ?? null,
      startedAt,
      Date.now(),
      env.DEEPSEEK_MODEL,
      served,
      receipt.httpStatus ?? null,
      outcome,
      receipt.requestBytes ?? null,
      usage?.prompt ?? null,
      usage?.completion ?? null,
      usage?.hit ?? null,
      usage?.miss ?? null,
      usage?.reasoning ?? null,
      price?.nanos ?? null,
      price?.version ?? null,
      price?.band ?? null,
    ]);
  }
}

export async function replayModelUsage(env: Env) {
  if (!env.ANALYTICS || !env.ANALYTICS_ARCHIVE) return;
  const bucket = env.ANALYTICS_ARCHIVE;
  const { objects } = await bucket.list({ prefix: fallbackPrefix, limit: 40 });
  if (!objects.length) return;
  const entries = await Promise.all(objects.map(async ({ key }) => ({ key, object: await bucket.get(key) })));
  const rows = (
    await Promise.all(
      entries.map(async ({ key, object }) => {
        try {
          const row = await object?.json<LedgerRow>();
          return Array.isArray(row) &&
            row.length === 20 &&
            row.every((field) => field === null || typeof field === 'string' || Number.isFinite(field)) &&
            key === `${fallbackPrefix}${row[0]}.json`
            ? { key, row }
            : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((entry) => entry !== null);
  if (!rows.length) return;
  await env.ANALYTICS.batch(rows.map(({ row }) => env.ANALYTICS!.prepare(insertUsage).bind(...row)));
  await bucket.delete(rows.map(({ key }) => key));
}

type ModelUsageRow = {
  day: string;
  scene: ModelScene;
  model: string;
  context_version: string | null;
  pricing_version: string | null;
  calls: number;
  failed_calls: number;
  measured_calls: number;
  priced_calls: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  reasoning_tokens: number | null;
  cost_cny_nanos: number | null;
  peak_cost_cny_nanos: number | null;
  request_bytes: number | null;
};

export type ModelUsageReport = {
  status: 'available';
  startDay: string;
  endDay: string;
  checkedAt: number;
  timezone: 'Asia/Shanghai';
  pricing: { currency: 'CNY'; version: string; source: string };
  rows: ModelUsageRow[];
};

export async function modelUsageSummary(env: Env, now = Date.now()): Promise<ModelUsageReport> {
  const endDay = new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
  const start = Date.parse(`${endDay}T00:00:00+08:00`) - 6 * 86400_000;
  const startDay = new Date(start + 8 * 3600_000).toISOString().slice(0, 10);
  const result = await env
    .ANALYTICS!.prepare(
      `SELECT strftime('%Y-%m-%d',started_at/1000,'unixepoch','+8 hours') AS day,
      scene,COALESCE(served_model,requested_model) AS model,context_version,pricing_version,
      COUNT(*) AS calls,SUM(outcome='failed') AS failed_calls,COUNT(prompt_tokens) AS measured_calls,
      COUNT(cost_cny_nanos) AS priced_calls,SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,SUM(cache_hit_tokens) AS cache_hit_tokens,
      SUM(cache_miss_tokens) AS cache_miss_tokens,SUM(reasoning_tokens) AS reasoning_tokens,
      SUM(cost_cny_nanos) AS cost_cny_nanos,
      SUM(CASE rate_band WHEN 'off_peak' THEN cost_cny_nanos*2 WHEN 'peak' THEN cost_cny_nanos END) AS peak_cost_cny_nanos,
      SUM(request_bytes) AS request_bytes
      FROM model_usage WHERE started_at>=? AND started_at<=?
      GROUP BY day,scene,model,context_version,pricing_version ORDER BY day DESC,scene,model`,
    )
    .bind(start, now)
    .all<ModelUsageRow>();
  return {
    status: 'available' as const,
    startDay,
    endDay,
    checkedAt: now,
    timezone: 'Asia/Shanghai',
    pricing: { currency: 'CNY', version: DEEPSEEK_PRICING_VERSION, source: DEEPSEEK_PRICING_URL },
    rows: result.results,
  };
}
