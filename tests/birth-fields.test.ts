import { describe, expect, it } from 'vitest';
import {
  birthDateErrors,
  birthDateValue,
  birthTimeErrors,
  birthTimeValue,
  pastedBirthDate,
  pastedBirthTime,
  validBirthTimezone,
} from '../src/lib/birth-fields';

describe('birth date entry preserves calendar meaning', () => {
  it('accepts a leap day and normalizes one-digit entries without timezone conversion', () => {
    expect(birthDateErrors(['2000', '2', '29'])).toEqual(['', '', '']);
    expect(birthDateValue(['1990', '8', '6'])).toBe('1990-08-06');
    expect(birthDateValue(['2000', '2', '29'])).toBe('2000-02-29');
  });
  it('rejects nonexistent days, unsupported years and missing segments rather than guessing', () => {
    for (const value of [
      ['2001', '2', '29'],
      ['2024', '4', '31'],
    ])
      expect(birthDateErrors(value as [string, string, string])[2]).toBe('calendar');
    for (const year of ['1900', '2100', '90']) expect(birthDateErrors([year, '1', '1'])[0]).toBe('year');
    expect(birthDateErrors(['1990', '', '16'])[1]).toBe('required');
    expect(birthDateValue(['1990', '', '16'])).toBe('1990--16');
    expect(birthDateErrors(['2000', '13', '1'])[1]).toBe('month');
  });
  it('pastes explicit year-first dates and does not guess ambiguous date order', () => {
    for (const text of ['1990-8-16', '1990/8/16', '1990年8月16日', '１９９０／８／１６'])
      expect(pastedBirthDate(text)).toEqual(['1990', '8', '16']);
    expect(pastedBirthDate('19900816')).toEqual(['1990', '08', '16']);
    expect(pastedBirthDate('08/06/1990')).toBeUndefined();
  });
});

describe('time entry never invents a missing time', () => {
  it('preserves midnight, normalizes valid inputs and rejects 24:00 or missing minutes', () => {
    expect(birthTimeValue(['0', '0'])).toBe('00:00');
    expect(birthTimeValue(['3', '5'])).toBe('03:05');
    expect(birthTimeErrors(['24', '00'])).toEqual(['hour', '']);
    expect(birthTimeErrors(['15', '60'])).toEqual(['', 'minute']);
    expect(birthTimeErrors(['15', ''])).toEqual(['', 'required']);
    expect(pastedBirthTime('１５：３０')).toEqual(['15', '30']);
    expect(pastedBirthTime('3:30 pm')).toBeUndefined();
  });
  it('accepts regional timezones and explicit offsets, rejecting invalid identifiers', () => {
    for (const value of ['Asia/Shanghai', 'Europe/Berlin', 'UTC', '+08:00', '-04:00'])
      expect(validBirthTimezone(value)).toBe(true);
    for (const value of ['', '  ', 'Beijing', '+24:00', '+08:60'])
      expect(validBirthTimezone(value)).toBe(false);
  });
});
