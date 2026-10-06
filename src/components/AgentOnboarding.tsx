import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  Fingerprint,
  MessagesSquare,
} from 'lucide-react';
import type { Locale } from '../lib/schema';
import { choose } from '../lib/i18n';
import {
  conversationStarters,
  guideText,
  toolStarters,
  quickTrialChoice,
  type ConversationChoice,
} from '../lib/agent-guidance';
import InstrumentGlyph from './InstrumentGlyph';

const topicIcons = {
  work: BriefcaseBusiness,
  relationships: MessagesSquare,
  self: Fingerprint,
  learn: BookOpen,
};

export default function AgentOnboarding({
  locale,
  disabled,
  hasDraft,
  onStart,
  onExample,
  onBirth,
}: {
  locale: Locale;
  disabled: boolean;
  hasDraft: boolean;
  onStart: (choice: ConversationChoice) => void;
  onExample: () => void;
  onBirth: () => void;
}) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const unsure = t('还没想好，陪我找个切入点', 'Help me find a starting point');
  return (
    <div className="agent-welcome agent-onboarding">
      <div className="agent-onboarding-heading">
        <span className="agent-guide-mark" aria-hidden="true">
          问
        </span>
        <span>{t('从一个念头开始', 'A little space to think')}</span>
      </div>
      <h1>{t('从你在意的事，聊起。', 'What’s on your mind?')}</h1>
      <p>
        {t(
          '直接聊你的问题，或选一种方式开始。无需注册。',
          'Ask your question, or choose a way in. No account needed.',
        )}
      </p>
      <div className="agent-first-steps">
        <button
          type="button"
          className="agent-quick-trial"
          disabled={disabled}
          onClick={() => onStart(quickTrialChoice(locale))}
        >
          <InstrumentGlyph kind="tarot" size={32} />
          <span>
            <strong>{t('一张牌，轻松开始', 'Try one card')}</strong>
            <small>{t('无需个人资料 · 使用 1 回合', 'No personal details · Uses 1 turn')}</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="agent-birth-start" disabled={disabled} onClick={onBirth}>
          <Fingerprint size={18} aria-hidden="true" />
          <span>{t('看我的八字', 'Explore my BaZi chart')}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="agent-example-link" aria-haspopup="dialog" onClick={onExample}>
        <BookOpen size={16} aria-hidden="true" />
        <span>
          {t('先看一份完整示例', 'See a complete example')}
          <small>{t('不用填写资料，不消耗回合', 'No details needed. No turns used.')}</small>
        </span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
      <details className="agent-topic-starts">
        <summary>
          {t('想从一件具体的事聊起？', 'Have a situation in mind?')}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="agent-starting-points" aria-label={t('开始对话', 'Start a conversation')}>
          {conversationStarters.map((item) => {
            const Icon = topicIcons[item.id];
            const text = guideText(item.prompt, locale);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                aria-label={text}
                onClick={() => onStart({ text, action: 'guided', mode: 'explore' })}
              >
                <span className="agent-starting-category">
                  <Icon size={16} aria-hidden="true" />
                  {guideText(item.category, locale)}
                </span>
                <span className="agent-starting-prompt">
                  {text}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="agent-start-unsure"
          type="button"
          disabled={disabled}
          onClick={() => onStart({ text: unsure, action: 'guided', mode: 'explore' })}
        >
          {unsure}
          <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </details>
      <details className="agent-tool-starts">
        <summary>
          {t('从塔罗、易经或资料研究开始', 'Explore tarot, I Ching or research')}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div>
          {toolStarters.map((item) => {
            const text = guideText(item.prompt, locale);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onStart({ text, mode: item.mode, action: 'example' })}
              >
                <InstrumentGlyph kind={item.id} size={32} />
                <span>{text}</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </details>
      {hasDraft && (
        <p className="agent-guidance-hint">
          {t(
            '点选只发送这一句，你正在写的内容会保留。',
            'Only the selected message is sent. Your draft stays here.',
          )}
        </p>
      )}
    </div>
  );
}
