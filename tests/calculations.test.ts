import { describe, it, expect } from 'vitest';
import { calculateBazi, validateDate } from '../src/lib/bazi';
import { baziRoleEn } from '../src/lib/bazi-labels';
import { identifyHexagram, castIching, randomInt } from '../src/lib/iching';
import { drawTarot } from '../src/lib/tarot';
import { calculateZiwei } from '../src/lib/ziwei';
import { tarotDeck } from '../src/data/tarot';
import { agentContext } from '../src/lib/journal';
const pillars = (v: ReturnType<typeof calculateBazi>) => v.pillars.map((p) => p.value);
describe('calendar contracts', () => {
  it('normalizes legacy saved display labels without recalculating a chart', () => {
    expect(baziRoleEn('偏财', 'Opportunity')).toBe('Indirect Wealth');
    expect(baziRoleEn('偏印', 'Intuition')).toBe('Indirect Resource');
  });
  it('returns conventional relationship names rather than unsupported personality labels in English', () => {
    const result = calculateBazi({ date: '2000-08-16', time: '03:30', timezone: 'Asia/Shanghai' });
    expect(result.pillars.map(({ role, roleEn }) => [role, roleEn])).toEqual([
      ['偏财', 'Indirect Wealth'],
      ['偏印', 'Indirect Resource'],
      ['日主', 'Day Master'],
      ['偏财', 'Indirect Wealth'],
    ]);
    const fixture = calculateBazi({ date: '2005-12-23', time: '08:37', timezone: 'Asia/Shanghai' });
    expect(fixture.pillars.map((pillar) => pillar.roleEn)).toEqual([
      'Indirect Wealth',
      'Direct Resource',
      'Day Master',
      'Hurting Officer',
    ]);
  });
  it('marks an omitted timezone instead of silently treating it as a supplied birthplace', () => {
    const assumed = calculateBazi({ date: '2000-08-16', time: '09:00' });
    const explicit = calculateBazi({ date: '2000-08-16', time: '09:00', timezone: 'Asia/Shanghai' });
    expect(assumed.calendar.timezoneAssumed).toBe(true);
    expect(explicit.calendar.timezoneAssumed).toBe(false);
    expect(pillars(assumed)).toEqual(pillars(explicit));
    expect(assumed.warnings.some((warning) => warning.includes('Timezone was not supplied'))).toBe(true);
  });
  it('distinguishes lunar New Year animals from the Li Chun year-pillar convention', () => {
    const result = calculateBazi({ date: '2024-02-05', time: '12:00', timezone: 'Asia/Shanghai' });
    expect(result.calendar.zodiac).toBe('兔');
    expect(result.calendar.yearPillarZodiac).toBe('龙');
    expect(result.calendar.zodiacEn).toBe('Rabbit');
    expect(result.calendar.yearPillarZodiacEn).toBe('Dragon');
    expect(result.calendar.zodiacConvention).toBe('lunar-new-year');
    expect(result.pillars[0].value).toBe('甲辰');
  });
  it.each([
    ['2005-12-23', '08:37', 'midnight', ['乙酉', '戊子', '辛巳', '壬辰']],
    ['1988-02-15', '23:30', 'midnight', ['戊辰', '甲寅', '庚子', '戊子']],
    ['1988-02-15', '23:30', 'zi', ['戊辰', '甲寅', '辛丑', '戊子']],
    ['1988-02-15', '22:30', 'midnight', ['戊辰', '甲寅', '庚子', '丁亥']],
    ['1988-02-02', '22:30', 'midnight', ['丁卯', '癸丑', '丁亥', '辛亥']],
  ])('matches upstream fixture %s %s %s', (date, time, dayBoundary, expected) =>
    expect(pillars(calculateBazi({ date, time, dayBoundary }))).toEqual(expected),
  );
  it('does not invent unknown time', () => {
    const v = calculateBazi({ date: '2000-08-16' });
    expect(v.pillars[3].value).toBeNull();
    expect(v.calendar.instant).toBeNull();
    expect(v.calendar.solar).toBe('2000-08-16');
    expect(v.elements.reduce((n, e) => n + e.count, 0)).toBe(6);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it.each(['2023-02-29', '2000-13-01', '1900-01-01', '2100-01-01'])(
    'rejects invalid/out-of-scope date %s',
    (date) => expect(() => validateDate(date)).toThrow(),
  );
  it.each([
    ['2024-03-10', '02:30'],
    ['2024-11-03', '01:30'],
  ])('rejects DST gap or overlap %s %s', (date, time) =>
    expect(() => calculateBazi({ date, time, timezone: 'America/New_York' })).toThrow(/daylight/),
  );
  it('accepts explicit offset for repeated hour', () =>
    expect(calculateBazi({ date: '2024-11-03', time: '01:30', timezone: '-04:00' }).calendar.instant).toBe(
      '2024-11-03T05:30:00Z',
    ));
  it('same absolute instant retains solar-term year/month across zones', () => {
    const a = calculateBazi({ date: '2024-02-04', time: '16:28', timezone: 'Asia/Shanghai' });
    const b = calculateBazi({ date: '2024-02-04', time: '08:28', timezone: 'UTC' });
    expect(pillars(a).slice(0, 2)).toEqual(pillars(b).slice(0, 2));
  });
  it('crosses the 2024 Li Chun year boundary in the recorded minute', () => {
    const before = calculateBazi({ date: '2024-02-04', time: '16:26' });
    const after = calculateBazi({ date: '2024-02-04', time: '16:28' });
    expect(before.pillars[0].value).toBe('癸卯');
    expect(after.pillars[0].value).toBe('甲辰');
  });
  it('compares 1988 solar terms in fixed UTC+8, not Shanghai summer time', () => {
    // Upstream ephemeris: 1988 Li Xia = 15:01:43 at UTC+8.
    // Shanghai civil clocks were UTC+9, so 15:30 civil is still BEFORE the term.
    const before = calculateBazi({ date: '1988-05-05', time: '15:30', timezone: 'Asia/Shanghai' });
    const fixed = calculateBazi({ date: '1988-05-05', time: '14:30', timezone: '+08:00' });
    const after = calculateBazi({ date: '1988-05-05', time: '16:02', timezone: 'Asia/Shanghai' });
    expect(before.calendar.offset).toBe('+09:00');
    expect(before.pillars[1].value).toBe('丙辰');
    expect(before.pillars[1].value).toBe(fixed.pillars[1].value);
    expect(after.pillars[1].value).toBe('丁巳');
  });
  it('solar correction does not move year/month across a term instant', () => {
    const args = { date: '2024-02-04', time: '16:28', timezone: 'Asia/Shanghai' };
    const clock = calculateBazi(args);
    const corrected = calculateBazi({ ...args, solarTime: true, longitude: 75 });
    expect(corrected.pillars.slice(0, 2)).toEqual(clock.pillars.slice(0, 2));
    expect(corrected.pillars[3].value).not.toBe(clock.pillars[3].value);
  });
  it('requires longitude for solar correction', () =>
    expect(() => calculateBazi({ date: '2000-08-16', time: '03:30', solarTime: true })).toThrow());
  it('reports approximate correction', () => {
    const v = calculateBazi({ date: '2000-08-16', time: '03:30', solarTime: true, longitude: 75 });
    expect(v.calendar.correctionMinutes).toBeLessThan(-170);
    expect(v.warnings.join('')).toContain('approximate');
  });
});
describe('I Ching', () => {
  it('maps all 64 bit patterns bijectively', () =>
    expect(
      new Set(Array.from({ length: 64 }, (_, n) => identifyHexagram(n.toString(2).padStart(6, '0')).number))
        .size,
    ).toBe(64));
  it('has correct heaven, earth and alternating Water/Fire mappings', () => {
    expect(identifyHexagram('111111').number).toBe(1);
    expect(identifyHexagram('000000').number).toBe(2);
    expect(identifyHexagram('101010').number).toBe(63);
    expect(identifyHexagram('010101').number).toBe(64);
  });
  it('changes only old yin/yang from bottom to top', () => {
    const v = castIching({ lines: [6, 7, 8, 9, 7, 8] });
    expect(v.original.bits).toBe('010110');
    expect(v.changed.bits).toBe('110010');
    expect(v.moving).toEqual([1, 4]);
  });
  it('preserves no-change result', () => {
    const v = castIching({ lines: [7, 7, 7, 7, 7, 7] });
    expect(v.moving).toEqual([]);
    expect(v.original.number).toBe(v.changed.number);
  });
  it('rejects five lines and out-of-range lines', () => {
    expect(() => castIching({ lines: [7, 7, 7, 7, 7] })).toThrow();
    expect(() => castIching({ lines: [5, 7, 7, 7, 7, 7] })).toThrow();
  });
  it('generates six legal random lines', () => {
    for (let i = 0; i < 20; i++) {
      const v = castIching({});
      expect(v.lines).toHaveLength(6);
      expect(v.lines.every((x) => x >= 6 && x <= 9)).toBe(true);
    }
  });
  it('rejects invalid random ranges', () => {
    for (const n of [0, -1, 1.5, Infinity]) expect(() => randomInt(n)).toThrow();
  });
});
describe('tarot and Zi Wei', () => {
  it('contains 78 unique complete cards', () => {
    expect(tarotDeck).toHaveLength(78);
    expect(new Set(tarotDeck.map((x) => x.id)).size).toBe(78);
  });
  it('draws without replacement and respects disabled reversals', () => {
    for (let i = 0; i < 30; i++) {
      const v = drawTarot({ count: 3, reversals: false });
      expect(new Set(v.cards.map((x) => x.id)).size).toBe(3);
      expect(v.cards.every((x) => !x.reversed)).toBe(true);
    }
  });
  it('one-card spread works', () => expect(drawTarot({ count: 1 }).cards[0].position).toBe('reflection'));
  it('rejects unsupported spread', () => expect(() => drawTarot({ count: 2 })).toThrow());
  it('matches documented Zi Wei sample', () => {
    const v = calculateZiwei({ date: '2000-08-16', time: '03:30', sex: 'female' });
    expect(v.palaces).toHaveLength(12);
    expect(v.soul).toBe('破军');
    expect(v.body).toBe('文昌');
    expect(v.fiveElementsClass).toBe('木三局');
  });
  it('omits birth inputs by default from agent export', () => {
    const chart = calculateBazi({ date: '2000-08-16', time: '03:30' });
    const ctx = agentContext(chart, 'Question', 'Chosen context', false);
    expect(ctx.calculation).not.toHaveProperty('input');
    expect(ctx.calculation).not.toHaveProperty('calendar');
    expect(agentContext(chart, '', '', true).calculation).toHaveProperty('input');
  });
});
