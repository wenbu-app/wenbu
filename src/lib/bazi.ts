import { Solar, LunarUtil } from 'lunar-typescript';
import { Temporal } from '@js-temporal/polyfill';
import { birthSchema, InputError, type BirthInput } from './schema';

export const elements = [
  { zh: '木', en: 'Wood', color: '#557363', image: '生长 / Growth' },
  { zh: '火', en: 'Fire', color: '#b4533d', image: '表达 / Expression' },
  { zh: '土', en: 'Earth', color: '#a7864a', image: '安定 / Grounding' },
  { zh: '金', en: 'Metal', color: '#777b80', image: '秩序 / Structure' },
  { zh: '水', en: 'Water', color: '#476b83', image: '流动 / Adaptation' },
];
const stems = '甲乙丙丁戊己庚辛壬癸';
const stemNames = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'];
const branches = '子丑寅卯辰巳午未申酉戌亥';
const branchNames = ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai'];
const zodiacNames: Record<string, string> = {
  鼠: 'Rat',
  牛: 'Ox',
  虎: 'Tiger',
  兔: 'Rabbit',
  龙: 'Dragon',
  蛇: 'Snake',
  马: 'Horse',
  羊: 'Goat',
  猴: 'Monkey',
  鸡: 'Rooster',
  狗: 'Dog',
  猪: 'Pig',
};
const roles: Record<string, string> = {
  比肩: 'Peer',
  劫财: 'Rob Wealth',
  食神: 'Eating God',
  伤官: 'Hurting Officer',
  偏财: 'Indirect Wealth',
  正财: 'Direct Wealth',
  七杀: 'Seven Killings',
  正官: 'Direct Officer',
  偏印: 'Indirect Resource',
  正印: 'Direct Resource',
  日主: 'Day Master',
};

export function validateDate(date: string) {
  try {
    const d = Temporal.PlainDate.from(date, { overflow: 'reject' });
    if (d.year < 1901 || d.year > 2099) throw new Error();
    return d;
  } catch {
    throw new InputError('Use a real date between 1901 and 2099. / 请输入 1901–2099 年间的有效日期。');
  }
}
function fromFields(d: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}) {
  return Solar.fromYmdHms(d.year, d.month, d.day, d.hour, d.minute, d.second);
}
// NOAA-style low-order equation of time. Approximation, never advertised as an ephemeris.
export function equationOfTime(dayOfYear: number, hour = 12) {
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  );
}
export function birthMoment(input: BirthInput) {
  validateDate(input.date);
  const [hour, minute] = (input.time ?? '12:00').split(':').map(Number);
  const date = Temporal.PlainDate.from(input.date);
  try {
    return Temporal.ZonedDateTime.from(
      { timeZone: input.timezone, year: date.year, month: date.month, day: date.day, hour, minute },
      { overflow: 'reject', disambiguation: 'reject' },
    );
  } catch {
    throw new InputError(
      'Unknown time zone, or an ambiguous/nonexistent daylight-saving time. / 时区无效，或该时间位于夏令时跳变、重叠区间。请选择明确的 UTC 偏移。',
    );
  }
}

export function calculateBazi(raw: unknown) {
  const input = birthSchema.parse(raw);
  const moment = birthMoment(input);
  // The ephemeris adds 1/3 day (UTC+8). Shanghai's historic DST must not
  // shift the solar-term comparison by another hour. Local day/hour retain the chosen zone.
  const beijing = moment.withTimeZone('+08:00');
  let local = moment.toPlainDateTime();
  let correctionMinutes = 0;
  if (input.solarTime && input.longitude !== undefined) {
    correctionMinutes =
      input.longitude * 4 - moment.offsetNanoseconds / 60e9 + equationOfTime(moment.dayOfYear, moment.hour);
    local = local.add({ seconds: Math.round(correctionMinutes * 60) });
  }
  const annualLunar = fromFields(beijing).getLunar();
  const annual = annualLunar.getEightChar();
  const lunar = fromFields(local).getLunar();
  const daily = lunar.getEightChar();
  daily.setSect(input.dayBoundary === 'zi' ? 1 : 2);
  const dayStem = daily.getDayGan();
  const labels = ['year', 'month', 'day', 'hour'] as const;
  const values = [annual.getYear(), annual.getMonth(), daily.getDay(), input.time ? daily.getTime() : null];
  const pillars = values.map((value, i) => {
    if (!value)
      return {
        key: labels[i],
        value: null,
        stem: null,
        branch: null,
        stemElement: null,
        branchElement: null,
        hidden: [],
        role: null,
        roleEn: null,
        pinyin: null,
        nayin: null,
      };
    const [stem, branch] = [...value];
    const role = i === 2 ? '日主' : LunarUtil.SHI_SHEN[dayStem + stem];
    return {
      key: labels[i],
      value,
      stem,
      branch,
      stemElement: LunarUtil.WU_XING_GAN[stem],
      branchElement: LunarUtil.WU_XING_ZHI[branch],
      hidden: LunarUtil.ZHI_HIDE_GAN[branch],
      role,
      roleEn: roles[role] ?? role,
      pinyin: `${stemNames[stems.indexOf(stem)]} ${branchNames[branches.indexOf(branch)]}`,
      nayin: LunarUtil.NAYIN[value],
    };
  });
  const distribution = elements.map((e) => ({
    ...e,
    count: pillars.reduce((n, p) => n + Number(p.stemElement === e.zh) + Number(p.branchElement === e.zh), 0),
  }));
  const warnings: string[] = [];
  const timezoneAssumed = !(
    raw &&
    typeof raw === 'object' &&
    'timezone' in raw &&
    raw.timezone !== undefined
  );
  if (timezoneAssumed)
    warnings.push(
      'Timezone was not supplied; Asia/Shanghai was used. Confirm the birthplace clock before interpreting. / 未提供时区，暂按 Asia/Shanghai 排盘；解读前请核对出生地当时的钟表时间。',
    );
  if (!input.time)
    warnings.push(
      'Birth time is unknown: the hour pillar is omitted; year/month use noon and may differ on a solar-term day. / 出生时刻未知：不排时柱；年、月柱以当地中午为暂定值，交节日可能变化。',
    );
  if (input.solarTime)
    warnings.push(
      'Solar-time correction is approximate. Near a day/hour boundary, compare both charts. / 真太阳时为近似校正；临近换日、时辰边界时应对照两盘。',
    );
  if (local.hour === 23)
    warnings.push(
      'Late Zi hour: midnight keeps the civil day pillar while the library advances the hour stem; Zi boundary advances both. / 晚子时：零点换日保留当日日柱，但依库规则时干按次日；子初换日则两者均进位。',
    );
  return {
    kind: 'bazi' as const,
    version: 'wenbu-bazi-1.2',
    input,
    calendar: {
      lunar: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      zodiac: lunar.getYearShengXiao(),
      zodiacEn: zodiacNames[lunar.getYearShengXiao()],
      zodiacConvention: 'lunar-new-year',
      yearPillarZodiac: annualLunar.getYearShengXiaoExact(),
      yearPillarZodiacEn: zodiacNames[annualLunar.getYearShengXiaoExact()],
      yearPillarConvention: 'li-chun-at-absolute-instant',
      timezoneAssumed,
      solar: input.time ? local.toString() : input.date,
      instant: input.time ? moment.toInstant().toString() : null,
      offset: moment.offset,
      correctionMinutes: Math.round(correctionMinutes * 10) / 10,
    },
    dayMaster: {
      stem: dayStem,
      pinyin: stemNames[stems.indexOf(dayStem)],
      element: LunarUtil.WU_XING_GAN[dayStem],
      polarity: stems.indexOf(dayStem) % 2 === 0 ? 'yang' : 'yin',
    },
    pillars,
    elements: distribution,
    warnings,
    method: {
      engine: 'lunar-typescript@1.8.6',
      yearMonth: 'Absolute solar-term boundaries in fixed UTC+08:00',
      dayHour: input.solarTime ? 'Approximate local apparent solar time' : 'Local civil clock',
      dayBoundary: input.dayBoundary,
      elements:
        'One count per visible stem and branch. Hidden stems, season and strength are not weighted. This is NOT a favorable-element diagnosis.',
      source: 'https://github.com/6tail/lunar-typescript',
    },
  };
}
export type BaziResult = ReturnType<typeof calculateBazi>;
