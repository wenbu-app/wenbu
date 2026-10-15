import { tarotDeck } from '../data/tarot';
import { dailyPractices } from '../data/daily-practices';
import type { TarotResult } from './tarot';
import type { Entry } from './journal';
import type { Locale } from './schema';

export const dailyVersion = 'wenbu-daily-1';
export function validDailyTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.length || value.length > 80) return false;
  try {
    // IANA zones and UTC only; never accept a caller-selected date or fixed offset.
    return !/^[+-]/.test(value) && !!new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    return false;
  }
}
export type DailyClock = { date: string; timezone: string; serverNow: number; nextAt: number };
export type DailyReading = TarotResult & {
  daily: { version: typeof dailyVersion; date: string; timezone: string };
};
export function validDailyDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function dailyReading(cardId: number, clock: DailyClock): DailyReading {
  if (!Number.isInteger(cardId) || cardId < 0 || cardId >= tarotDeck.length)
    throw new Error('Invalid daily card');
  return {
    kind: 'tarot',
    version: dailyVersion,
    cards: [{ ...tarotDeck[cardId], reversed: false, position: 'reflection' }],
    method: {
      name: 'identity-date-hmac-sha256',
      deckSize: 78,
      reversals: false,
      spread: 'one-card',
      source: 'https://www.gutenberg.org/ebooks/43548',
      note: 'A stable daily symbolic prompt, selected by identity and server calendar date. Original editorial practices; not a personal forecast.',
    },
    daily: { version: dailyVersion, date: clock.date, timezone: clock.timezone },
  };
}
export function isDailyReading(value: unknown): value is DailyReading {
  if (!value || typeof value !== 'object') return false;
  const v = value as DailyReading;
  const id = v.cards?.[0]?.id;
  return (
    v.kind === 'tarot' &&
    v.version === dailyVersion &&
    v.daily?.version === dailyVersion &&
    validDailyDate(v.daily.date) &&
    validDailyTimezone(v.daily.timezone) &&
    Array.isArray(v.cards) &&
    v.cards.length === 1 &&
    Number.isInteger(id) &&
    id >= 0 &&
    id < 78 &&
    v.cards[0].reversed === false
  );
}
export function dailyPractice(reading: DailyReading, locale: Locale) {
  const row = dailyPractices[reading.cards[0].id];
  return { action: row[locale === 'zh' ? 0 : 1], question: row[locale === 'zh' ? 2 : 3] };
}
export function dailyEntry(result: DailyReading, locale: Locale, receipt?: string): Entry {
  const practice = dailyPractice(result, locale);
  const card = result.cards[0];
  return {
    // The account privacy ledger never permits a deleted record ID to be reused.
    id: `daily-${result.daily.date}-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    kind: 'tarot',
    result,
    question:
      locale === 'zh'
        ? `${result.daily.date} 日签 · ${card.zh}`
        : `${result.daily.date} daily card · ${card.en}`,
    note: '',
    context:
      locale === 'zh'
        ? `日签是每日自我觉察练习，不是运势预测。今日小行动：${practice.action} 回看问题：${practice.question}`
        : `This daily card is a reflection practice, not a forecast. A small action: ${practice.action} Question for later: ${practice.question}`,
    ...(receipt ? { receipt } : {}),
  };
}
