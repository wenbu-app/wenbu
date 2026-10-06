import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../lib/schema';
import {
  birthDateErrors,
  birthDateValue,
  birthTimeErrors,
  birthTimeValue,
  pastedBirthDate,
  pastedBirthTime,
  birthTimezones,
  validBirthTimezone,
  type DateParts,
  type TimeParts,
} from '../lib/birth-fields';
import '../styles/birth-fields.css';

function splitInput(value: string, date: boolean): DateParts | TimeParts {
  const parts = value.split(date ? '-' : ':');
  return Array.from({ length: date ? 3 : 2 }, (_, i) => parts[i] || '') as DateParts | TimeParts;
}

function SegmentedBirthInput({
  locale,
  kind,
  value,
  disabled = false,
  onChange,
}: {
  locale: Locale;
  kind: 'date' | 'time';
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const date = kind === 'date';
  const [parts, setParts] = useState(() => splitInput(value, date));
  const emitted = useRef(value);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const id = useId();
  const [showError, setShowError] = useState(false);
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const errors = date ? birthDateErrors(parts as DateParts) : birthTimeErrors(parts as TimeParts);
  const messages: Record<string, string> = {
    required: t(
      date ? '请补全出生年月日。' : '请补全小时和分钟。',
      date ? 'Enter the year, month and day.' : 'Enter the hour and minute.',
    ),
    year: t('年份范围为 1901–2099。', 'Enter a year from 1901 to 2099.'),
    month: t('月份应为 1–12。', 'Enter a month from 1 to 12.'),
    day: t('日期应为 1–31。', 'Enter a day from 1 to 31.'),
    calendar: t('这个月没有这一天，请检查日期。', 'That day does not exist in this month. Check the date.'),
    hour: t('请按 24 小时制填写，小时为 0–23。', 'Use a 24-hour clock: hours run from 0 to 23.'),
    minute: t('分钟应为 0–59。', 'Enter minutes from 0 to 59.'),
  };
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setParts(splitInput(value, date));
      setShowError(false);
    }
  }, [value, date]);
  useEffect(() => {
    inputs.current.forEach((input, i) => input?.setCustomValidity(disabled ? '' : messages[errors[i]] || ''));
  });
  function update(next: string[]) {
    setParts(next as DateParts | TimeParts);
    const nextValue = date ? birthDateValue(next as DateParts) : birthTimeValue(next as TimeParts);
    emitted.current = nextValue;
    onChange(nextValue);
  }
  const labels = date
    ? [t('年', 'Year'), t('月', 'Month'), t('日', 'Day')]
    : [t('时', 'Hour'), t('分', 'Minute')];
  return (
    <div className="birth-segments-wrap">
      <div className={`birth-segments birth-segments-${kind}`}>
        {labels.map((label, i) => (
          <label key={label} htmlFor={`${id}-${i}`}>
            <span>{label}</span>
            <input
              ref={(node) => {
                inputs.current[i] = node;
              }}
              id={`${id}-${i}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`${t(date ? '出生日期' : '出生时间', date ? 'Birth date' : 'Birth time')} · ${label}`}
              aria-describedby={`${id}-help${showError && !disabled && errors.some(Boolean) ? ` ${id}-error` : ''}`}
              aria-invalid={(showError && !disabled && !!errors[i]) || undefined}
              maxLength={date && i === 0 ? 4 : 2}
              required
              disabled={disabled}
              placeholder={disabled ? '—' : date ? ['YYYY', 'MM', 'DD'][i] : ['HH', 'mm'][i]}
              value={parts[i] || ''}
              onChange={(e) => {
                const text = e.target.value.normalize('NFKC');
                if (!/^\d*$/.test(text)) return;
                update(parts.map((part, j) => (j === i ? text : part)));
              }}
              onPaste={(e) => {
                const next = date
                  ? pastedBirthDate(e.clipboardData.getData('text'))
                  : pastedBirthTime(e.clipboardData.getData('text'));
                if (next) {
                  e.preventDefault();
                  update(next);
                }
              }}
              onInvalid={() => setShowError(true)}
              onBlur={() => {
                if (parts[i] && errors[i]) setShowError(true);
              }}
            />
          </label>
        ))}
      </div>
      <small id={`${id}-help`} className="birth-input-help">
        {date
          ? t('公历 · 1901–2099，可粘贴 1990-08-16。', 'Gregorian · 1901–2099. You can paste 1990-08-16.')
          : t(
              '出生地当地钟表时间 · 24 小时制，例如下午 3:30 填 15 / 30。',
              'Local time at birth · 24-hour clock. For 3:30 pm, enter 15 / 30.',
            )}
      </small>
      {showError && !disabled && errors.some(Boolean) && (
        <p id={`${id}-error`} className="birth-input-error" role="alert">
          {messages[errors.find(Boolean)!]}
        </p>
      )}
    </div>
  );
}

export function BirthDateTimeFields({
  locale,
  date,
  time,
  allowUnknown,
  onDateChange,
  onTimeChange,
}: {
  locale: Locale;
  date: string;
  time: string | null;
  allowUnknown: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string | null) => void;
}) {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const knownTime = useRef(time ?? '');
  if (time !== null) knownTime.current = time;
  const unknown = allowUnknown && time === null;
  return (
    <div className="birth-input-fields">
      <fieldset className="birth-input-group">
        <legend>{t('公历出生日期', 'Gregorian birth date')}</legend>
        <SegmentedBirthInput locale={locale} kind="date" value={date} onChange={onDateChange} />
      </fieldset>
      <fieldset className="birth-input-group">
        <legend>{t('出生时间', 'Birth time')}</legend>
        {allowUnknown && (
          <label className="birth-time-unknown">
            <input
              type="checkbox"
              checked={unknown}
              onChange={(e) => onTimeChange(e.target.checked ? null : knownTime.current)}
            />
            <span>{t('时间未知，只看年、月、日三柱', 'Time unknown — use three pillars')}</span>
          </label>
        )}
        <SegmentedBirthInput
          locale={locale}
          kind="time"
          value={time ?? ''}
          disabled={unknown}
          onChange={onTimeChange}
        />
        {!allowUnknown && (
          <small className="birth-input-help">
            {t(
              '紫微斗数需要已知时间，不能用默认时刻代替。',
              'Zi Wei requires a known birth time. No default time is assumed.',
            )}
          </small>
        )}
      </fieldset>
    </div>
  );
}

export function BirthTimezoneField({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const id = useId();
  const [custom, setCustom] = useState(!birthTimezones.some(([zone]) => zone === value));
  const input = useRef<HTMLInputElement>(null);
  const [showError, setShowError] = useState(false);
  const invalid = !validBirthTimezone(value);
  const error = t(
    '请填写有效时区（例如 Europe/Berlin）或固定偏移（例如 +08:00）。',
    'Enter a valid timezone (such as Europe/Berlin) or fixed offset (such as +08:00).',
  );
  useEffect(() => {
    input.current?.setCustomValidity(invalid ? error : '');
  }, [invalid, error, custom]);
  const useCustom = custom || !birthTimezones.some(([zone]) => zone === value);
  return (
    <div className="birth-timezone-field">
      <label htmlFor={`${id}-zone`}>{t('出生地当时使用的时区', 'Timezone at the place of birth')}</label>
      <select
        id={`${id}-zone`}
        value={useCustom ? 'custom' : value}
        aria-describedby={`${id}-help`}
        onChange={(e) => {
          const nextCustom = e.target.value === 'custom';
          setCustom(nextCustom);
          setShowError(false);
          onChange(nextCustom ? '' : e.target.value);
        }}
      >
        {birthTimezones.map(([zone, zh, en]) => (
          <option key={zone} value={zone}>
            {t(zh, en)}
          </option>
        ))}
        <option value="custom">{t('其他地区 / 自定义时区', 'Other region / custom timezone')}</option>
      </select>
      {useCustom && (
        <label className="birth-custom-zone">
          {t('时区名称或 UTC 偏移', 'Timezone name or UTC offset')}
          <input
            ref={input}
            value={value}
            required
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            placeholder="Europe/Berlin"
            aria-describedby={`${id}-help`}
            aria-invalid={(showError && invalid) || undefined}
            onChange={(e) => onChange(e.target.value)}
            onInvalid={() => setShowError(true)}
            onBlur={() => setShowError(true)}
          />
        </label>
      )}
      <small id={`${id}-help`} className="birth-input-help">
        {t(
          '请按出生地选择，不一定是你现在的时区。城市时区会按日期处理夏令时；固定偏移不会。',
          'Choose the birth location, which may differ from your current one. Regional timezones follow historical daylight-saving rules; fixed offsets do not.',
        )}
      </small>
      {showError && invalid && (
        <p className="birth-input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
