import { useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import type { TarotResult } from '../lib/tarot';
import type { Locale } from '../lib/schema';
import { tarotArt } from '../data/tarot-art';
import { track } from '../lib/analytics';

export default function TarotCard({
  card,
  locale,
  preview = false,
}: {
  card: TarotResult['cards'][number];
  locale: Locale;
  preview?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const [opened, setOpened] = useState(false);
  const name = locale === 'zh' ? card.zh : card.en;
  const orientation =
    locale === 'zh' ? (card.reversed ? '逆位' : '正位') : card.reversed ? 'Reversed' : 'Upright';
  const keywords =
    locale === 'zh'
      ? card.reversed
        ? card.reversedZh
        : card.keywordsZh
      : card.reversed
        ? card.reversedEn
        : card.keywordsEn;
  const src = tarotArt[card.id];
  return (
    <>
      <button
        type="button"
        className={`tarot-face illustrated ${card.reversed ? 'reversed' : ''}`}
        aria-label={locale === 'zh' ? `放大查看${name} · ${orientation}` : `Inspect ${name} · ${orientation}`}
        onClick={() => {
          setFullFailed(false);
          setOpened(true);
          dialog.current?.showModal();
          track('card_inspected', { tool: 'tarot', action: 'inspect' });
        }}
      >
        {!failed && src ? (
          <img
            src={preview ? src.replace('.webp', '-small.webp') : src}
            alt=""
            width="600"
            height="900"
            decoding="async"
            loading={preview ? 'lazy' : 'eager'}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="card-unavailable">
            {name}
            <small>{locale === 'zh' ? '插画暂未载入' : 'Artwork unavailable'}</small>
          </span>
        )}
        <span className="card-inspect">
          <Maximize2 size={13} />
          <span>{locale === 'zh' ? '细看' : 'Inspect'}</span>
        </span>
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpened(false)}
        className="tarot-lightbox"
        aria-label={`${name} · ${orientation}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="tarot-lightbox-inner">
          <button
            className="tarot-close"
            aria-label={locale === 'zh' ? '关闭卡牌' : 'Close card'}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
          {opened && !fullFailed && src ? (
            <img
              className={card.reversed ? 'is-reversed' : undefined}
              src={src}
              alt={`${name} · ${orientation}`}
              width="600"
              height="900"
              onError={() => setFullFailed(true)}
            />
          ) : opened ? (
            <div className="tarot-art-retry" role="status">
              <span className="card-unavailable">
                {name}
                <small>
                  {locale === 'zh'
                    ? '插画暂未载入，牌义仍可阅读。'
                    : 'Artwork could not load. You can still read the card meaning.'}
                </small>
              </span>
              {src && (
                <button className="button secondary" type="button" onClick={() => setFullFailed(false)}>
                  {locale === 'zh' ? '重新载入插画' : 'Retry artwork'}
                </button>
              )}
            </div>
          ) : null}
          <div className="tarot-lightbox-copy">
            <span className="eyebrow">
              WENBU · {card.arcana === 'major' ? 'MAJOR ARCANA' : card.suit.toUpperCase()}
            </span>
            <h3>
              {name} <small>{orientation}</small>
            </h3>
            <p>{keywords}</p>
            <span className="small-label">
              {locale === 'zh'
                ? '问卜原创 AI 插画 · 以传统意象重新绘制'
                : 'Original AI artwork · a reinterpretation of traditional imagery'}
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
