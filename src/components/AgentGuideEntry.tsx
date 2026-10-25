import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import { guideEntryFromIndex, type GuideEntry } from '../lib/guide-entry';
import type { Locale } from '../lib/schema';
import type { ConversationChoice } from '../lib/agent-guidance';

export default function AgentGuideEntry({
  locale,
  disabled,
  onStart,
  fallback,
}: {
  locale: Locale;
  disabled: boolean;
  onStart: (choice: ConversationChoice) => void;
  fallback: ReactNode;
}) {
  const [entry, setEntry] = useState<GuideEntry | null>(null);
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('guide');
    if (!slug || !/^[a-z0-9-]{1,100}$/.test(slug)) return;
    const controller = new AbortController();
    fetch('/knowledge/index.json', { signal: controller.signal, redirect: 'error' })
      .then((response) => (response.ok ? response.json() : null))
      .then((index) => {
        if (!controller.signal.aborted) setEntry(guideEntryFromIndex(index, slug, locale));
      })
      .catch(() => {
        /* Normal onboarding remains usable if the public catalogue is unavailable. */
      });
    return () => controller.abort();
  }, [locale]);
  if (!entry) return fallback;
  const labels = {
    example: t('用一个例子，帮我看懂这篇指南。', 'Help me understand this guide with an example.'),
    sources: t('这篇指南里，哪些说法有依据？', 'What supports the claims in this guide?'),
  };
  const choose = (intent: 'example' | 'sources') =>
    onStart({
      text: labels[intent],
      sourceIds: [entry.id],
      freshContext: true,
      action: 'guided',
      mode: intent === 'sources' ? 'research' : 'explore',
    });
  return (
    <div className="agent-welcome agent-guide-entry">
      <div className="agent-onboarding-heading">
        <BookOpen size={18} />
        <span>{t('从刚读到的地方，继续', 'Continue where you left off')}</span>
        <button
          type="button"
          className="agent-icon-button"
          aria-label={t('取消文章上下文', 'Remove guide context')}
          onClick={() => {
            setEntry(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('guide');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
          }}
        >
          <X size={17} />
        </button>
      </div>
      <h1>{t('把读到的，变成自己的理解。', 'Make the idea your own.')}</h1>
      <a className="agent-entry-guide" href={entry.url}>
        {entry.title}
        <ArrowUpRight size={16} />
      </a>
      <p>
        {t(
          '点选会发送显示的问题，并带上这篇公开指南。你正在写的草稿会保留，也可以直接写自己的问题。',
          'A choice sends the displayed question with this public guide. Your draft stays here. You can also write your own question below.',
        )}
      </p>
      <div className="agent-guide-choices">
        <button type="button" disabled={disabled} onClick={() => choose('example')}>
          {labels.example}
          <ArrowUpRight size={17} />
        </button>
        <button type="button" disabled={disabled} onClick={() => choose('sources')}>
          {labels.sources}
          <ArrowUpRight size={17} />
        </button>
      </div>
      <p className="agent-guide-scope">
        {t(
          '仅使用这篇公开指南。发送后使用 1 回合，无需注册。',
          'Uses this public guide only. Sending uses one turn. No account needed.',
        )}
      </p>
    </div>
  );
}
