import { ChevronDown } from 'lucide-react';
import type { AgentBirth } from '../lib/agent-protocol';
import type { Locale } from '../lib/schema';

const zones = [
  ['Asia/Shanghai', '中国标准时间', 'China Standard Time'],
  ['Asia/Hong_Kong', '香港', 'Hong Kong'],
  ['Asia/Taipei', '台北', 'Taipei'],
  ['Asia/Tokyo', '东京', 'Tokyo'],
  ['Asia/Singapore', '新加坡', 'Singapore'],
  ['America/New_York', '纽约', 'New York'],
  ['America/Los_Angeles', '洛杉矶', 'Los Angeles'],
  ['Europe/London', '伦敦', 'London'],
  ['Australia/Sydney', '悉尼', 'Sydney'],
] as const;

export default function AgentBirthFields({
  locale,
  birth,
  kind,
  onKind,
  onChange,
}: {
  locale: Locale;
  birth: AgentBirth;
  kind: 'bazi' | 'ziwei';
  onKind: (kind: 'bazi' | 'ziwei') => void;
  onChange: (change: Partial<AgentBirth>) => void;
}) {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const zoneLabel = zones.find(([zone]) => zone === birth.timezone)?.[locale === 'zh' ? 1 : 2];
  return (
    <section className="agent-birth-fields" aria-label={t('排盘资料', 'Chart details')}>
      <div className="agent-birth-kind" role="group" aria-label={t('排盘方式', 'Chart system')}>
        <button type="button" aria-pressed={kind === 'bazi'} onClick={() => onKind('bazi')}>
          {t('八字', 'BaZi')}
        </button>
        <button type="button" aria-pressed={kind === 'ziwei'} onClick={() => onKind('ziwei')}>
          {t('紫微斗数', 'Zi Wei')}
        </button>
      </div>
      <div className="agent-birth-grid">
        <label>
          {t('公历出生日期', 'Gregorian birth date')}
          <input
            type="date"
            min="1901-01-01"
            max="2099-12-31"
            required
            value={birth.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        <label>
          {kind === 'bazi'
            ? t('出生时间（不知道可留空）', 'Birth time (leave blank if unknown)')
            : t('出生时间（必填）', 'Birth time (required)')}
          <input
            type="time"
            required={kind === 'ziwei'}
            value={birth.time ?? ''}
            onChange={(e) => onChange({ time: e.target.value || null })}
          />
        </label>
        <label>
          {t('出生地当时使用的时区', 'Timezone at the place of birth')}
          <input
            required
            list="agent-timezones"
            value={birth.timezone}
            aria-describedby="agent-zone-help"
            onChange={(e) => {
              try {
                new Intl.DateTimeFormat('en', { timeZone: e.target.value });
                e.target.setCustomValidity('');
              } catch {
                e.target.setCustomValidity(
                  t(
                    '请选择或填写有效时区，例如 Asia/Shanghai。',
                    'Choose or enter a valid timezone, such as Asia/Shanghai.',
                  ),
                );
              }
              onChange({ timezone: e.target.value });
            }}
          />
          <datalist id="agent-timezones">
            {zones.map(([zone, zh, en]) => (
              <option key={zone} value={zone}>
                {t(zh, en)}
              </option>
            ))}
          </datalist>
          <small id="agent-zone-help">
            {zoneLabel ? `${zoneLabel} · ` : ''}
            {t(
              '请确认出生地时区，不一定是你现在的时区。',
              'Check the birth timezone; it may differ from your current one.',
            )}
          </small>
        </label>
        {kind === 'ziwei' && (
          <label>
            {t('传统排盘性别参数（必填）', 'Traditional calculation sex (required)')}
            <select
              required
              value={birth.sex ?? ''}
              onChange={(e) =>
                onChange({ sex: e.target.value ? (e.target.value as 'male' | 'female') : undefined })
              }
            >
              <option value="">{t('请选择', 'Select an option')}</option>
              <option value="female">{t('女', 'Female')}</option>
              <option value="male">{t('男', 'Male')}</option>
            </select>
            <small>
              {t(
                '用于传统运限顺逆规则，不用于推断性格。',
                'Used for traditional cycle direction, not to infer personality.',
              )}
            </small>
          </label>
        )}
        <p>
          {kind === 'bazi'
            ? t(
                '不知道时刻也能先看年、月、日三柱；临近换日或节气时会有不确定性。',
                'Without a birth time, start with three pillars. Day and solar-term boundaries may remain uncertain.',
              )
            : t(
                '紫微需要确切时刻；当前采用出生地民用日期和时间，不作真太阳时换算。时刻不确定时，可以先了解通用结构。',
                'Zi Wei requires a known time. It uses the local civil date and time without solar-time correction. If the time is uncertain, start with a general explanation.',
              )}
        </p>
      </div>
      {kind === 'bazi' && (
        <details className="agent-birth-advanced">
          <summary>
            <span>
              {t('计算约定', 'Calculation conventions')}
              <small>
                {birth.dayBoundary === 'midnight'
                  ? t('零点换日', 'Midnight boundary')
                  : t('23:00 换日', '23:00 boundary')}{' '}
                · {birth.solarTime ? t('真太阳时', 'Solar time') : t('民用时间', 'Civil time')}
              </small>
            </span>
            <ChevronDown size={15} />
          </summary>
          <div className="agent-birth-grid">
            <label>
              {t('换日规则', 'Day boundary')}
              <select
                value={birth.dayBoundary}
                onChange={(e) => onChange({ dayBoundary: e.target.value as 'midnight' | 'zi' })}
              >
                <option value="midnight">{t('零点换日（默认）', 'Midnight (default)')}</option>
                <option value="zi">{t('子初 23:00 换日', 'Zi hour, 23:00')}</option>
              </select>
            </label>
            <label>
              {t('真太阳时经度（选填）', 'Solar-time longitude (optional)')}
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                disabled={!birth.time}
                placeholder={t('留空使用民用时间', 'Empty = civil time')}
                value={birth.solarTime ? (birth.longitude ?? '') : ''}
                onChange={(e) =>
                  onChange({
                    solarTime: e.target.value !== '',
                    longitude: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
              <small>
                {t('仅在已知时刻与出生地经度时启用。', 'Use only with a known birth time and longitude.')}
              </small>
            </label>
          </div>
        </details>
      )}
    </section>
  );
}
