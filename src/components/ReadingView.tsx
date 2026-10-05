import { useState } from 'react';
import { MousePointer2, ZoomIn } from 'lucide-react';
import TarotCard from './TarotCard';
import type { Reading } from '../lib/tools';
import type { Locale } from '../lib/schema';
import { choose } from '../lib/i18n';

export default function ReadingView({ result, locale }: { result: Reading; locale: Locale }) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const [activeElement, setActiveElement] = useState(0);
  const [palace, setPalace] = useState(0);
  if (result.kind === 'bazi') {
    const total = result.elements.reduce((n, e) => n + e.count, 0);
    let offset = 0;
    return (
      <div className="chart-result">
        <div className="result-heading">
          <span className="eyebrow">YOUR FOUR PILLARS</span>
          <span className="small-label">{result.calendar.lunar}</span>
        </div>
        <div className="pillars">
          {result.pillars.map((p, i) => (
            <div key={p.key} className={`pillar ${i === 2 ? 'day-pillar' : ''}`}>
              <span className="pillar-label">
                {t(['年柱', '月柱', '日柱', '时柱'][i], ['YEAR', 'MONTH', 'DAY', 'HOUR'][i])}
              </span>
              <span className="pillar-role">
                {p.value ? (locale === 'zh' ? p.role : p.roleEn) : t('时刻未知', 'Unknown time')}
              </span>
              <strong style={{ color: result.elements.find((e) => e.zh === p.stemElement)?.color }}>
                {p.stem ?? '—'}
              </strong>
              <strong style={{ color: result.elements.find((e) => e.zh === p.branchElement)?.color }}>
                {p.branch ?? '—'}
              </strong>
              <span className="pillar-pinyin">{p.pinyin ?? '—'}</span>
              <span className="pillar-element">
                {p.value
                  ? [p.stemElement, p.branchElement]
                      .map((element) => {
                        const label = result.elements.find((item) => item.zh === element);
                        return locale === 'en' ? (label?.en ?? element) : element;
                      })
                      .join(' · ')
                  : t('不推定时柱', 'Not inferred')}
              </span>
              <span className="pillar-hidden">
                {t('藏干', 'Hidden')} {p.hidden?.join(' ') || '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="element-section">
          <div className="element-donut">
            <svg
              viewBox="0 0 160 160"
              role="img"
              aria-label={t('五行可见字分布', 'Visible five-element distribution')}
            >
              <circle cx="80" cy="80" r="60" fill="none" stroke="#e7e2d8" strokeWidth="10" />
              {result.elements.map((e, i) => {
                const length = (e.count / total) * 377;
                const start = offset;
                offset += length;
                return (
                  <circle
                    key={e.zh}
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke={e.color}
                    strokeWidth={activeElement === i ? 14 : 10}
                    strokeDasharray={`${Math.max(0, length - 3)} ${377 - Math.max(0, length - 3)}`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 80 80)"
                    opacity={e.count ? 1 : 0}
                  />
                );
              })}
              <text x="80" y="78" textAnchor="middle" className="donut-main">
                {result.dayMaster.stem}
              </text>
              <text x="80" y="102" textAnchor="middle" className="donut-caption">
                {t('日主', 'DAY MASTER')}
              </text>
            </svg>
          </div>
          <div className="element-detail">
            <p className="reading-hint">
              <MousePointer2 size={13} aria-hidden="true" />
              {t('点选五行，查看构成', 'Select an element to explore')}
            </p>
            <h3>{t('你的五行底色', 'Your elemental palette')}</h3>
            <div className="element-buttons">
              {result.elements.map((e, i) => (
                <button
                  type="button"
                  key={e.zh}
                  onClick={() => setActiveElement(i)}
                  aria-pressed={activeElement === i}
                  style={{ '--element': e.color } as React.CSSProperties}
                >
                  <i />
                  {t(e.zh, e.en)}
                  <b>{e.count}</b>
                </button>
              ))}
            </div>
            <p className="element-note">
              {t(
                `${result.elements[activeElement].zh}：${result.elements[activeElement].count} / ${total} 个可见字。这里呈现的是构成，不代表旺衰、喜用神或吉凶。`,
                `${result.elements[activeElement].en}: ${result.elements[activeElement].count} of ${total} visible characters. Composition is not a measure of strength, favorable elements or fortune.`,
              )}
            </p>
          </div>
        </div>
        {result.warnings.map((w) => (
          <p className="calculation-note" key={w}>
            {locale === 'zh' ? w.split(' / ')[1] : w.split(' / ')[0]}
          </p>
        ))}
        <details className="method-details">
          <summary>{t('查看计算约定与来源', 'Calculation conventions & source')}</summary>
          <p>
            {t(
              '年、月柱按绝对交节时刻；日、时柱使用所选当地时钟。',
              'Year/month follow absolute solar terms; day/hour use the selected local clock.',
            )}
          </p>
          <p>
            {result.input.timezone} · {result.calendar.offset} · {result.input.dayBoundary} ·{' '}
            {result.calendar.correctionMinutes} min
          </p>
          <p>{result.method.engine}</p>
          <a href={result.method.source} target="_blank" rel="noreferrer">
            {t('查看算法来源', 'View calculation source')} ↗
          </a>
        </details>
      </div>
    );
  }
  if (result.kind === 'iching')
    return (
      <div className="iching-result">
        <div className="hexagram-pair">
          {[result.original, result.changed].map((hex, i) => (
            <div className="hexagram-block" key={i}>
              <span className="eyebrow">
                {t(i === 0 ? '本卦' : '之卦', i === 0 ? 'PRESENT PATTERN' : 'CHANGING PATTERN')}
              </span>
              <div className="hexagram-lines" aria-label={t(`${hex.zh}卦`, hex.en)}>
                {[...hex.bits].reverse().map((bit, j) => (
                  <div
                    key={j}
                    className={`hex-line ${bit === '0' ? 'yin' : 'yang'} ${i === 0 && result.moving.includes(6 - j) ? 'moving' : ''}`}
                  >
                    <i />
                    <i />
                    <span>{6 - j}</span>
                  </div>
                ))}
              </div>
              <h3>
                {hex.zh} <em>{String(hex.number).padStart(2, '0')}</em>
              </h3>
              <p>{hex.en}</p>
              <span className="small-label">
                {t(`上${hex.upper} · 下${hex.lower}`, `${hex.upper} above · ${hex.lower} below`)}
              </span>
            </div>
          ))}
        </div>
        <div className="reflection-callout">
          <span>{t('此刻的一个视角', 'A PERSPECTIVE TO TRY')}</span>
          <p>{t(result.original.promptZh, result.original.promptEn)}</p>
        </div>
        <p className="calculation-note">
          {result.moving.length
            ? t(
                `动爻：第 ${result.moving.join('、')} 爻（自下而上）。朱砂色标记变化的位置。`,
                `Changing lines: ${result.moving.join(', ')} (bottom to top). Vermilion marks the changing lines.`,
              )
            : t('本次没有动爻，本卦与之卦相同。', 'No changing lines: both hexagrams are the same.')}
        </p>
        <details className="method-details">
          <summary>{t('起卦记录', 'Casting record')}</summary>
          <p>
            {result.lines.join(' · ')} · {t('从初爻到上爻', 'Bottom to top')}
          </p>
          <p>
            {t(
              '三枚铜钱法：6、7、8、9 的概率分别为 1/8、3/8、3/8、1/8。主题提示为问卜原创，不冒充经典原文。',
              'Three-coin probabilities for 6, 7, 8, 9: 1/8, 3/8, 3/8, 1/8. Themes are original Wenbu prompts, not classical quotations.',
            )}
          </p>
        </details>
      </div>
    );
  if (result.kind === 'tarot')
    return (
      <div className="tarot-result">
        <p className="reading-hint">
          <ZoomIn size={13} aria-hidden="true" />
          {t('轻点牌面，放大看细节', 'Open a card to see the details')}
        </p>
        <div className={`drawn-cards count-${result.cards.length}`}>
          {result.cards.map((card, i) => (
            <div
              className="drawn-card-wrap"
              key={card.id}
              style={{ '--delay': `${i * 180}ms` } as React.CSSProperties}
            >
              <span className="eyebrow">
                {t(
                  result.cards.length === 1 ? '此刻的映照' : ['当下', '牵引', '下一步'][i],
                  result.cards.length === 1 ? 'REFLECTION' : ['SITUATION', 'TENSION', 'NEXT STEP'][i],
                )}
              </span>
              <TarotCard card={card} locale={locale} />
              <h3>{t(card.zh, card.en)}</h3>
              <span className="card-orientation">
                {t(card.reversed ? '逆位' : '正位', card.reversed ? 'Reversed' : 'Upright')}
              </span>
              <p>
                {locale === 'zh'
                  ? card.reversed
                    ? card.reversedZh
                    : card.keywordsZh
                  : card.reversed
                    ? card.reversedEn
                    : card.keywordsEn}
              </p>
            </div>
          ))}
        </div>
        <div className="reflection-callout">
          <span>{t('留给自己的问题', 'A QUESTION FOR YOU')}</span>
          <p>
            {t(
              '哪张牌最让你在意？是牌面的意思，还是它让你想起的某件事？',
              'Which card holds your attention? Is it the symbol, or something it brings to mind?',
            )}
          </p>
        </div>
        <details className="method-details">
          <summary>{t('抽牌方法与牌义', 'Draw method & card notes')}</summary>
          <p>
            {t(
              '78 张完整牌组，不放回随机抽取。逆位开启时，每张牌独立以 50% 概率逆位。牌面为问卜原创 AI 插画。',
              'A full 78-card deck, drawn without replacement. When enabled, each card independently has a 50% chance of reversal. Original AI illustrations by Wenbu.',
            )}
          </p>
          {result.cards.map((c) => (
            <p key={c.id}>
              <b>{t(c.zh, c.en)}</b> — {t(c.promptZh, c.promptEn)}
            </p>
          ))}
        </details>
      </div>
    );
  const current = result.palaces[palace];
  const positions: Record<string, [number, number]> = {
    寅: [4, 1],
    卯: [3, 1],
    辰: [2, 1],
    巳: [1, 1],
    午: [1, 2],
    未: [1, 3],
    申: [1, 4],
    酉: [2, 4],
    戌: [3, 4],
    亥: [4, 4],
    子: [4, 3],
    丑: [4, 2],
  };
  return (
    <div className="ziwei-result">
      <div className="ziwei-summary">
        <span>
          {result.lunarDate} · {result.time}
        </span>
        <strong>{result.fiveElementsClass}</strong>
      </div>
      <div className="palace-grid palace-ring">
        <div className="palace-center">
          <span className="eyebrow">ZI WEI DOU SHU</span>
          <strong>紫微</strong>
          <i />
          <p>
            {t('命主', 'Soul')} · {result.soul}
            <br />
            {t('身主', 'Body')} · {result.body}
          </p>
          <span>{t('点选宫位，展开星曜', 'Select a palace to explore')}</span>
        </div>
        {result.palaces.map((p, i) => (
          <button
            type="button"
            className={palace === i ? 'active' : ''}
            key={p.name}
            style={{ gridRow: positions[p.branch]?.[0], gridColumn: positions[p.branch]?.[1] }}
            onClick={() => setPalace(i)}
            aria-pressed={palace === i}
          >
            <span>
              {p.stem}
              {p.branch}
            </span>
            <h3>
              {p.name}
              {p.isBody ? ' · 身' : ''}
            </h3>
            <p>{p.stars.map((s) => s.name).join(' · ') || t('无主星', 'No major star')}</p>
          </button>
        ))}
      </div>
      <div className="palace-detail" aria-live="polite">
        <h3 key={current.name}>
          {current.name}
          {t(current.name.endsWith('宫') ? '' : '宫', ' palace')}
        </h3>
        <p>
          {current.stars.length
            ? current.stars
                .map((s) => `${s.name} ${s.brightness}${s.mutagen ? ` · ${s.mutagen}` : ''}`)
                .join(' / ')
            : t(
                '空宫须结合对宫与三方四正参照，不能直接判断为「没有」或「不好」。',
                'An empty palace is read in relation to other palaces; it does not mean an area of life is absent or bad.',
              )}
        </p>
        <p>
          {t('辅星', 'Supporting stars')}：{current.supporting.join(' · ') || '—'}
        </p>
        {current.ageRange.length === 2 && (
          <p>
            {t('大限年龄区间（按计算库约定）', 'Decadal age range (engine convention)')}：
            {current.ageRange.join('–')}
          </p>
        )}
      </div>
      <p className="calculation-note">
        {t(
          '使用当地钟表日期与时间，未做真太阳时校正。宫位与星曜保留中文名称，避免译名混淆。',
          'Uses the entered local civil date and clock time without solar correction. Palace and star names retain their Chinese labels for precision.',
        )}
      </p>
      <details className="method-details">
        <summary>{t('流派与计算依据', 'School & calculation')}</summary>
        <p>
          iztro 2.6.1 · fixLeap=true ·{' '}
          {t('默认流派配置，晚子时单独处理。', 'default configuration; late Zi handled separately.')}
        </p>
        <a href="https://iztro.com/quick-start" target="_blank" rel="noreferrer">
          iztro ↗
        </a>
      </details>
    </div>
  );
}
