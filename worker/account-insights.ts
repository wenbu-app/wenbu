import { AccountError, DAY, accountsReady, shanghaiDay } from './account-security';
import type { Env } from './types';
export async function accountInsights(url: URL, env: Env) {
  if (!accountsReady(env)) return { available: false };
  const days = Number(url.searchParams.get('days') || 7),
    locale = url.searchParams.get('locale') || 'all',
    test = url.searchParams.get('test') === 'include';
  if (![1, 3, 7, 14, 30].includes(days) || !['all', 'zh', 'en'].includes(locale))
    throw new AccountError(422, 'invalid_filter');
  const now = Date.now(),
    from = now - days * DAY,
    db = env.USERDATA!;
  const filters = "created_at>=? AND created_at<=? AND (?='all' OR locale=?) AND (?=1 OR is_test=0)";
  const args = [from, now, locale, locale, Number(test)];
  const totals = await db
    .prepare(
      `SELECT COUNT(*) registered,COALESCE(SUM(analytics_enabled),0) measured,COALESCE(SUM(CASE WHEN analytics_enabled=1 AND activated_at IS NOT NULL THEN 1 ELSE 0 END),0) activated FROM wb_accounts WHERE ${filters}`,
    )
    .bind(...args)
    .first();
  const cohorts = [];
  const today = Date.parse(shanghaiDay(now) + 'T00:00:00+08:00');
  const activatedFilters = filters.replaceAll('created_at', 'a.activated_at').replace('<=?', '<?');
  const cohortStart = '(CAST((a.activated_at+28800000)/86400000 AS INTEGER)*86400000-28800000)';
  for (const day of [1, 7]) {
    // Select a complete activation-day window, ending before the observation day.
    const cohortTo = today - day * DAY;
    const cohortFrom = cohortTo - days * DAY;
    const row = await db
      .prepare(
        `SELECT COUNT(*) eligible,COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM wb_operations o WHERE o.owner=a.user_id AND o.completed_at>=${cohortStart}+? AND o.completed_at<${cohortStart}+?) THEN 1 ELSE 0 END),0) returned FROM wb_accounts a WHERE ${activatedFilters} AND analytics_enabled=1 AND ${cohortStart}+?<=?`,
      )
      .bind(
        day * DAY,
        (day + 1) * DAY,
        cohortFrom,
        cohortTo,
        locale,
        locale,
        Number(test),
        (day + 1) * DAY,
        now,
      )
      .first();
    cohorts.push({ day, from: cohortFrom, to: cohortTo, ...row });
  }
  const dailyRows = (
    await db
      .prepare(
        `SELECT date(created_at/1000,'unixepoch','+8 hours') day,COUNT(*) registered,COALESCE(SUM(CASE WHEN analytics_enabled=1 AND activated_at IS NOT NULL THEN 1 ELSE 0 END),0) activated FROM wb_accounts WHERE ${filters} GROUP BY day ORDER BY day`,
      )
      .bind(...args)
      .all()
  ).results;
  const daily = [];
  for (let at = Date.parse(shanghaiDay(from) + 'T00:00:00+08:00'); at <= now; at += DAY) {
    const day = shanghaiDay(at),
      row = dailyRows.find((r) => r.day === day);
    daily.push(row || { day, registered: 0, activated: 0 });
  }
  const trial = await db
    .prepare(
      "SELECT COUNT(*) completed,COALESCE(SUM(CASE WHEN registered_at IS NOT NULL THEN 1 ELSE 0 END),0) registered,COALESCE(SUM(CASE WHEN saved_at IS NOT NULL THEN 1 ELSE 0 END),0) saved,COALESCE(SUM(CASE WHEN first_completed_at+?<=? THEN 1 ELSE 0 END),0) mature FROM wb_trial_cohorts WHERE first_completed_at>=? AND first_completed_at<=? AND (?='all' OR locale=?) AND (?=1 OR is_test=0)",
    )
    .bind(7 * DAY, now, ...args)
    .first();
  const matureTo = now - 7 * DAY;
  const matureFrom = matureTo - days * DAY;
  const matureCounts = await db
    .prepare(
      "SELECT COUNT(*) completed,COALESCE(SUM(CASE WHEN registered_at>=first_completed_at AND registered_at<=first_completed_at+? THEN 1 ELSE 0 END),0) registered,COALESCE(SUM(CASE WHEN saved_at>=first_completed_at AND saved_at<=first_completed_at+? THEN 1 ELSE 0 END),0) saved FROM wb_trial_cohorts WHERE first_completed_at>=? AND first_completed_at<? AND (?='all' OR locale=?) AND (?=1 OR is_test=0)",
    )
    .bind(7 * DAY, 7 * DAY, matureFrom, matureTo, locale, locale, Number(test))
    .first();
  const matureTrial = { from: matureFrom, to: matureTo, ...matureCounts };
  const continued = await db
    .prepare(
      `SELECT COUNT(DISTINCT CASE WHEN o.completed_at>a.activated_at THEN a.user_id END) repeat_value,COUNT(DISTINCT CASE WHEN o.cross_instance=1 THEN a.user_id END) cross_instance FROM wb_accounts a LEFT JOIN wb_operations o ON o.owner=a.user_id WHERE a.analytics_enabled=1 AND ${filters.replaceAll('created_at', 'a.created_at')}`,
    )
    .bind(...args)
    .first();
  const exclusions = await db
    .prepare(
      "SELECT COUNT(*) tests FROM wb_accounts WHERE created_at>=? AND created_at<=? AND is_test=1 AND (?='all' OR locale=?)",
    )
    .bind(from, now, locale, locale)
    .first();
  const delivery = (
    await db
      .prepare(
        "SELECT event,SUM(count) count FROM wb_auth_daily WHERE day>=? AND day<=? AND (?='all' OR locale=?) AND (?=1 OR is_test=0) GROUP BY event",
      )
      .bind(shanghaiDay(from), shanghaiDay(now), locale, locale, Number(test))
      .all()
  ).results;
  const imports =
    (
      await db
        .prepare(
          `SELECT COUNT(DISTINCT r.owner) accounts FROM wb_records r JOIN wb_accounts a ON a.user_id=r.owner WHERE r.provenance='legacy_import' AND r.deleted_at IS NULL AND a.analytics_enabled=1 AND ${filters.replaceAll('created_at', 'a.created_at')}`,
        )
        .bind(...args)
        .first()
    )?.accounts || 0;
  return {
    available: true,
    version: 'account-v3',
    timezone: 'Asia/Shanghai',
    trial,
    matureTrial,
    continued,
    exclusions,
    from,
    to: now,
    days,
    locale,
    includeTest: test,
    totals,
    cohorts,
    daily,
    delivery,
    legacyImportAccounts: imports,
    definitions: {
      registration:
        'Verified email identities created in the selected rolling window. Includes measurement opt-outs.',
      activation:
        'Among opted-in new accounts: a verified current result saved within 24 hours of signup. Signed guest results from the preceding 7 days qualify; legacy imports do not.',
      retention:
        'Separate fully observed activation-day windows, each spanning the selected number of days and ending before the day-1/day-7 observation period. Each row exposes its exact from/to timestamps. Requires a new completed operation, not a page view or history import.',
      delivery:
        'Provider acceptance is not inbox delivery. Daily send counters use Asia/Shanghai calendar days; cohort metrics use rolling timestamps.',
      trial:
        'Consenting guests with a first server-verified completion in the rolling window. Registration and saving must happen within 7 days. The denominator stays fixed; maturity is reported separately.',
      matureTrial:
        'A separate rolling entry window of the selected duration ending 7 days ago. Numerator and denominator both come from this fully observed cohort; conversion timestamps must be within 7 days of first completion.',
      instances:
        'A new random first-party browser installation identifier reads an older cloud record and completes an operation within 24 hours. This is not proof of a distinct physical device or person.',
      coverage:
        'No joining email, birth details, chat text, or anonymous browser identifiers. Deleted accounts are excluded; historical cohorts can therefore decrease.',
    },
  };
}
