import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BookmarkPlus, ArrowRight, X } from 'lucide-react';
import { accountSnapshot, subscribeAccount, openAccount, type AccountIntent } from '../lib/account-client';
import { track } from '../lib/analytics';
import type { Locale } from '../lib/schema';

/** An optional affordance after a result. Never opens authentication on its own. */
export default function AccountSavePrompt({ locale, intent }: { locale: Locale; intent: AccountIntent }) {
  const state = useSyncExternalStore(subscribeAccount, accountSnapshot, accountSnapshot);
  const [dismissed, setDismissed] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const zh = locale === 'zh';
  useEffect(() => {
    try {
      setDismissed(
        Number(localStorage.getItem('wenbu.save-prompt.dismissed-until')) > Date.now() ||
          !!sessionStorage.getItem('wenbu.save-prompt.seen'),
      );
    } catch {
      setDismissed(false);
    }
  }, []);
  const visible = state.ready && state.enabled && !state.user && !dismissed;
  useEffect(() => {
    if (!visible || !root.current || seen.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.5 &&
          document.visibilityState === 'visible' &&
          !seen.current
        ) {
          seen.current = true;
          try {
            sessionStorage.setItem('wenbu.save-prompt.seen', '1');
          } catch {
            /* In-memory visibility is still deduplicated. */
          }
          track('registration_offer_viewed', { action: 'account-result' });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="account-save-prompt" ref={root}>
      <BookmarkPlus size={21} aria-hidden="true" />
      <div>
        <strong>{zh ? '留住这次探索' : 'Keep this conversation'}</strong>
        <p>
          {zh
            ? '保存对话和结果，换个设备也能接着看。'
            : 'Save the conversation and its results to return on another device.'}
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            track('registration_offer_clicked', { action: 'account-result' });
            openAccount(intent, 'account-result');
          }}
        >
          {zh ? '免费保存到账号' : 'Save to a free account'} <ArrowRight size={15} />
        </button>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label={zh ? '暂时不用，七天内不再提示' : 'Not now. Hide this reminder for seven days.'}
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem('wenbu.save-prompt.dismissed-until', String(Date.now() + 7 * 86400000));
          } catch {
            /* Optional preference. */
          }
          track('registration_offer_dismissed', { action: 'account-result' });
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
