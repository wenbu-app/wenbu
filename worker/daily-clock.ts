import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import { validDailyTimezone, type DailyClock } from '../src/lib/daily';

export const dailyTimezone = z.string().refine(validDailyTimezone, 'Use a valid IANA timezone.');
export function dailyClock(timezone: string, now = Date.now()): DailyClock {
  const local = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(dailyTimezone.parse(timezone));
  return {
    date: local.toPlainDate().toString(),
    timezone: local.timeZoneId,
    serverNow: now,
    nextAt: local.startOfDay().add({ days: 1 }).epochMilliseconds,
  };
}
