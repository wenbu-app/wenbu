import { z } from 'zod';
import {
  dailyVersion,
  dailyReading,
  dailyPractice,
  isDailyReading,
  type DailyReading,
} from '../src/lib/daily';
import { dailyClock, dailyTimezone } from './daily-clock';
import { hmac } from './account-security';
import { getRecord } from './account-records';
import { verifiedReceipt, type Actor } from './account-operations';
import type { Env } from './types';

export const dailyInput = z
  .object({
    action: z.enum(['status', 'reveal']),
    timezone: dailyTimezone,
    locale: z.enum(['zh', 'en']).optional(),
    seed: z.uuid().optional(),
    previous: z
      .object({ result: z.unknown(), receipt: z.string().max(3000) })
      .strict()
      .optional(),
  })
  .strict();

/** No model, quota reservation, private notes or caller-selected date/card. */
export async function getDaily(raw: unknown, env: Env, actor?: Actor, now = Date.now()) {
  const input = dailyInput.parse(raw);
  const clock = dailyClock(input.timezone, now);
  if (input.action === 'status') return { clock };
  let result: DailyReading | undefined;
  if (actor?.owner) {
    // Restored copies have new IDs. Search this owner's daily date, then use the
    // ordinary privacy-ledger read guard; deleted IDs remain deleted.
    const candidates = (
      await env
        .USERDATA!.prepare(
          "SELECT id FROM wb_records WHERE owner=? AND kind='journal' AND deleted_at IS NULL AND json_extract(content,'$.result.daily.version')=? AND json_extract(content,'$.result.daily.date')=? ORDER BY created_at,id LIMIT 8",
        )
        .bind(actor.owner, dailyVersion, clock.date)
        .all<{ id: string }>()
    ).results;
    let saved: unknown;
    for (const candidate of candidates) {
      const existing = await getRecord(env, actor.owner, 'journal', candidate.id);
      const value = (existing?.content as { result?: unknown } | undefined)?.result;
      if (isDailyReading(value) && value.daily.date === clock.date) {
        saved = value;
        break;
      }
    }
    if (isDailyReading(saved) && saved.daily.date === clock.date) {
      // Rebuild from our deck; stored user data never becomes executable/editorial copy.
      result = dailyReading(saved.cards[0].id, clock);
    } else if (
      input.previous &&
      isDailyReading(input.previous.result) &&
      input.previous.result.daily.date === clock.date &&
      (await verifiedReceipt(env, actor.request, actor.owner, 'journal', input.previous))
    ) {
      // Explicit account save may be one request behind the login. Preserve today's signed guest card.
      result = dailyReading(input.previous.result.cards[0].id, clock);
    }
  }
  if (!result) {
    const identity = actor?.subject ?? (input.seed ? `browser:${input.seed}` : 'public');
    const digest = await hmac(
      env.ACCOUNT_DATA_KEY || env.QUOTA_SALT || 'wenbu-public-daily-v1',
      `daily-v1:${identity}:${clock.date}`,
    );
    result = dailyReading(Number.parseInt(digest.slice(0, 12), 16) % 78, clock);
  }
  return { clock, result, practice: dailyPractice(result, input.locale || 'en') };
}
