import { useState } from 'react';
import { tarotDeck } from '../data/tarot';
import type { Locale } from '../lib/schema';
import TarotCard from './TarotCard';
import { href } from '../lib/i18n';
export default function TarotGallery({ locale }: { locale: Locale }) {
  const [suit, setSuit] = useState('all');
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const groups = [
    ['all', '全部', 'All cards'],
    ['major', '大阿卡纳', 'Major arcana'],
    ['wands', '权杖', 'Wands'],
    ['cups', '圣杯', 'Cups'],
    ['swords', '宝剑', 'Swords'],
    ['pentacles', '星币', 'Pentacles'],
  ];
  const cards = tarotDeck.filter((card) => suit === 'all' || card.suit === suit);
  return (
    <section className="tarot-gallery shell">
      <div className="gallery-heading">
        <span className="eyebrow accent">THE WENBU DECK</span>
        <h1>{t('一副牌，七十八种看法。', 'One deck. Seventy-eight perspectives.')}</h1>
        <p>
          {t(
            '以纸本版画的笔触，重新绘制传统塔罗意象。选一张细看，先认识它的象征，再带着自己的问题去探索。',
            'Original AI illustrations reinterpret traditional tarot imagery as hand-colored engravings. Open a card, learn its theme, then bring your own question.',
          )}
        </p>
        <a className="text-link" data-track="tool-entry" href={href(locale, 'tarot')}>
          {t('带着问题抽牌', 'Draw with a question')} ↗
        </a>
      </div>
      <div className="gallery-filters" aria-label={t('筛选牌组', 'Filter by suit')}>
        {groups.map(([key, zh, en]) => (
          <button key={key} aria-pressed={suit === key} onClick={() => setSuit(key)}>
            {t(zh, en)}
            <span>{key === 'all' ? 78 : key === 'major' ? 22 : 14}</span>
          </button>
        ))}
      </div>
      <p className="gallery-count" role="status" aria-live="polite" aria-atomic="true">
        {t(`显示 ${cards.length} 张牌`, `Showing ${cards.length} cards`)}
      </p>
      <div className="tarot-gallery-grid">
        {cards.map((card) => (
          <article key={card.id}>
            <TarotCard card={{ ...card, reversed: false, position: 'reflection' }} locale={locale} preview />
            <h2>{t(card.zh, card.en)}</h2>
            <p>{t(card.keywordsZh, card.keywordsEn)}</p>
            <small>
              {t('逆位：', 'Reversed: ')}
              {t(card.reversedZh, card.reversedEn)}
            </small>
          </article>
        ))}
      </div>
      <p className="gallery-note">
        {t(
          '插画为问卜原创 AI 图像，属于传统意象的重新演绎，不是历史牌面的复制品；个别意象采用更温和的表达。牌义是反思提示，不是对未来的事实判断。',
          'Original AI artwork reinterprets traditional imagery, with gentler symbolic alternatives in some cards. It is not a historical facsimile. Meanings are prompts for reflection, not verified predictions.',
        )}
      </p>
    </section>
  );
}
