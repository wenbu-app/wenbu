export type DateParts = [string, string, string];
export type TimeParts = [string, string];

export function birthDateErrors([year, month, day]: DateParts) {
  const errors = [
    !year ? 'required' : !/^\d{4}$/.test(year) || +year < 1901 || +year > 2099 ? 'year' : '',
    !month ? 'required' : !/^\d{1,2}$/.test(month) || +month < 1 || +month > 12 ? 'month' : '',
    !day ? 'required' : !/^\d{1,2}$/.test(day) || +day < 1 || +day > 31 ? 'day' : '',
  ];
  if (!errors.some(Boolean) && +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate())
    errors[2] = 'calendar';
  return errors;
}

export function birthTimeErrors([hour, minute]: TimeParts) {
  return [
    !hour ? 'required' : !/^\d{1,2}$/.test(hour) || +hour > 23 ? 'hour' : '',
    !minute ? 'required' : !/^\d{1,2}$/.test(minute) || +minute > 59 ? 'minute' : '',
  ];
}

export function birthDateValue(parts: DateParts) {
  return birthDateErrors(parts).some(Boolean)
    ? parts.join('-')
    : parts.map((part, i) => part.padStart(i === 0 ? 4 : 2, '0')).join('-');
}

export function birthTimeValue(parts: TimeParts) {
  return birthTimeErrors(parts).some(Boolean)
    ? parts.join(':')
    : parts.map((s) => s.padStart(2, '0')).join(':');
}

export function pastedBirthDate(text: string): DateParts | undefined {
  const value = text.normalize('NFKC').trim();
  const match =
    value.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/) || value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return [match[1], match[2], match[3]];
}

export function pastedBirthTime(text: string): TimeParts | undefined {
  const match = text
    .normalize('NFKC')
    .trim()
    .match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) return [match[1], match[2]];
}

export function validBirthTimezone(value: string) {
  if (/^[+-]([01]\d|2[0-3]):[0-5]\d$/.test(value)) return true;
  if (!value.trim() || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const birthTimezones = [
  ['Asia/Shanghai', '中国大陆（北京）', 'Mainland China (Beijing)'],
  ['Asia/Hong_Kong', '香港', 'Hong Kong'],
  ['Asia/Taipei', '台北', 'Taipei'],
  ['Asia/Singapore', '新加坡', 'Singapore'],
  ['Asia/Tokyo', '东京', 'Tokyo'],
  ['Asia/Seoul', '首尔', 'Seoul'],
  ['Asia/Kolkata', '印度', 'India'],
  ['Europe/London', '伦敦', 'London'],
  ['Europe/Paris', '巴黎', 'Paris'],
  ['America/New_York', '纽约', 'New York'],
  ['America/Los_Angeles', '洛杉矶', 'Los Angeles'],
  ['Australia/Sydney', '悉尼', 'Sydney'],
  ['UTC', '协调世界时 UTC', 'UTC'],
  ['+08:00', 'UTC+08:00（固定偏移）', 'UTC+08:00 (fixed offset)'],
] as const;
