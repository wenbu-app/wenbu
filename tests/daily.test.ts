import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { dailyClock } from '../worker/daily-clock';
import { getDaily } from '../worker/daily';
import {
  dailyEntry,
  dailyPractice,
  dailyReading,
  isDailyReading,
  validDailyTimezone,
} from '../src/lib/daily';
import { dailyPractices } from '../src/data/daily-practices';
import { journalRecord } from '../src/lib/account-protocol';
import { readingConversation } from '../src/lib/reading-conversation';
import { pagePaths, clientEvents, tools } from '../src/lib/analytics-contract';
import DailyCard from '../src/components/DailyCard';
import worker from '../worker/index';
import type { Env } from '../worker/types';

const now = Date.parse('2026-10-15T15:59:59.999Z');
const env = { SITE_URL: 'https://wenbu.app', QUOTA_SALT: 'daily-test-only' } as Env;
const input = { action: 'reveal', timezone: 'Asia/Shanghai', seed: 'a0000000-0000-4000-8000-000000000001' };
describe('daily reading calendar and selection', () => {
  it('uses the server calendar date and advances at local midnight', () => {
    expect(dailyClock('Asia/Shanghai', now)).toMatchObject({ date: '2026-10-15', nextAt: now + 1 });
    expect(dailyClock('Asia/Shanghai', now + 1).date).toBe('2026-10-16');
    expect(dailyClock('America/New_York', now + 1).date).toBe('2026-10-15');
    expect(dailyClock('UTC', Date.parse('2028-02-29T23:59:59Z')).nextAt).toBe(
      Date.parse('2028-03-01T00:00:00Z'),
    );
  });
  it('handles both 23-hour and 25-hour DST days', () => {
    const spring = Date.parse('2026-03-08T05:00:00Z'),
      fall = Date.parse('2026-11-01T04:00:00Z');
    expect(dailyClock('America/New_York', spring).nextAt - spring).toBe(23 * 3600000);
    expect(dailyClock('America/New_York', fall).nextAt - fall).toBe(25 * 3600000);
  });
  it('keeps one identity/date stable across locale and equivalent timezone names', async () => {
    const a = await getDaily({ ...input, locale: 'zh' }, env, undefined, now);
    const b = await getDaily(
      { ...input, locale: 'en', timezone: 'Asia/Hong_Kong' },
      env,
      undefined,
      now - 1000,
    );
    expect(a.result?.cards).toEqual(b.result?.cards);
    expect(a.result?.method.name).toBe('identity-date-hmac-sha256');
    expect(a.result?.cards[0].reversed).toBe(false);
  });
  it('status does not reveal a card, and callers cannot set dates, cards or unknown fields', async () => {
    expect(await getDaily({ ...input, action: 'status' }, env, undefined, now)).not.toHaveProperty('result');
    for (const patch of [
      { date: '2099-01-01' },
      { card: 19 },
      { question: 'private' },
      { timezone: 'Mars/Olympus' },
      { timezone: '+08:00' },
      { seed: 'user@example.test' },
    ]) {
      await expect(getDaily({ ...input, ...patch }, env, undefined, now)).rejects.toThrow();
    }
    expect(validDailyTimezone('UTC')).toBe(true);
    expect(validDailyTimezone(undefined)).toBe(false);
  });
  it('has varied stable selections over time, without promising no repeated cards', async () => {
    const ids = new Set<number>();
    for (let n = 0; n < 78; n++)
      ids.add((await getDaily(input, env, undefined, now + n * 86400000)).result!.cards[0].id);
    expect(ids.size).toBeGreaterThan(35);
  });
});
describe('daily content, account journal and Agent continuity', () => {
  it('provides complete original bilingual actions and questions for all 78 cards', () => {
    expect(dailyPractices).toHaveLength(78);
    expect(new Set(dailyPractices.map((row) => row[0])).size).toBe(78);
    for (let id = 0; id < 78; id++) {
      const reading = dailyReading(id, dailyClock('UTC', now));
      expect(isDailyReading(reading)).toBe(true);
      for (const locale of ['zh', 'en'] as const) {
        const practice = dailyPractice(reading, locale);
        expect(practice.action.length).toBeGreaterThan(10);
        expect(practice.question.length).toBeGreaterThan(8);
        if (locale === 'en') expect(practice.action + practice.question).not.toMatch(/[\u3400-\u9fff]/);
      }
    }
    expect(isDailyReading({})).toBe(false);
    const valid = dailyReading(0, dailyClock('UTC', now));
    expect(isDailyReading({ ...valid, daily: { ...valid.daily, date: '2026-02-30' } })).toBe(false);
    expect(isDailyReading({ ...valid, daily: { ...valid.daily, date: ['2026-10-15'] } })).toBe(false);
    expect(isDailyReading({ ...dailyReading(0, dailyClock('UTC', now)), cards: [] })).toBe(false);
    expect(() => dailyReading(78, dailyClock('UTC', now))).toThrow();
  });
  it('survives the actual cloud record schema and carries the existing card into a draft Agent session', () => {
    const reading = dailyReading(16, dailyClock('UTC', now));
    const entry = { ...dailyEntry(reading, 'en'), note: 'Synthetic reflection' };
    const roundtrip = journalRecord.parse(JSON.parse(JSON.stringify(entry)));
    expect(roundtrip.result.daily).toEqual(reading.daily);
    expect(roundtrip.note).toBe(entry.note);
    const session = readingConversation(entry, 'en');
    expect(session.context.journalIds).toEqual([entry.id]);
    expect(session.messages).toHaveLength(0);
    expect(session.context.useBirth).toBe(false);
    expect(entry.context).toContain('not a forecast');
  });
  it('disables the reveal controls in SSR, with bilingual entry text', () => {
    for (const locale of ['zh', 'en'] as const) {
      const html = renderToStaticMarkup(createElement(DailyCard, { locale }));
      for (const className of ['daily-card-back', 'daily-reveal-button']) {
        const button = html.match(new RegExp('<button[^>]*class="[^"]*' + className + '[^"]*"[^>]*>'))?.[0];
        expect(button).toContain('disabled');
      }
      expect(html).not.toContain('DeepSeek');
      expect(html).not.toContain('<textarea');
    }
  });
  it('has an explicit closed analytics vocabulary and no free-text analytics fields', () => {
    expect(pagePaths).toContain('daily');
    expect(tools).toContain('daily');
    for (const event of [
      'daily_revealed',
      'daily_revisited',
      'daily_reflection_saved',
      'daily_agent_opened',
      'daily_exported',
    ])
      expect(clientEvents).toContain(event);
  });
});
describe('daily public API', () => {
  it('returns a private response and rejects cross-origin, malformed fields and GET', async () => {
    const request = (body: unknown, origin = 'https://wenbu.app') =>
      new Request('https://wenbu.app/api/v1/daily', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const response = await worker.fetch(request(input), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(((await response.json()) as { result: unknown }).result).toSatisfy(isDailyReading);
    expect((await worker.fetch(request(input, 'https://foreign.test'), env)).status).toBe(403);
    expect((await worker.fetch(request({ ...input, date: '2099-01-01' }), env)).status).toBe(422);
    expect((await worker.fetch(new Request('https://wenbu.app/api/v1/daily'), env)).status).toBe(405);
  });
});
