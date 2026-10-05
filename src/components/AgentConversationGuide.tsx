import { ArrowUpRight, CircleHelp, PenLine, SlidersHorizontal } from 'lucide-react';
import type { AgentMessage } from '../lib/agent-protocol';
import { followupSuggestions, type ConversationChoice } from '../lib/agent-guidance';
import type { Locale } from '../lib/schema';
import { choose } from '../lib/i18n';

export default function AgentConversationGuide({
  message,
  locale,
  disabled,
  hasDraft,
  onReply,
  onCustom,
  onBirth,
}: {
  message: AgentMessage;
  locale: Locale;
  disabled: boolean;
  hasDraft: boolean;
  onReply: (choice: ConversationChoice) => void;
  onCustom: () => void;
  onBirth: () => void;
}) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const question = message.status === 'waiting' ? message.question : undefined;
  const followups = followupSuggestions(message, locale);
  if (!question && !followups.length) return null;
  const unsure = t('暂时不确定', 'I’m not sure');
  const options = question
    ? [...new Set(question.options.map((s) => s.trim()).filter(Boolean))].map((text, i) => ({
        id: String(i),
        text,
      }))
    : followups;
  const reply = (text: string) => onReply({ text, action: question ? 'clarification' : 'followup' });
  return (
    <div className={`agent-conversation-guide ${question ? 'is-clarification' : ''}`}>
      <div className="agent-conversation-guide-heading">
        {question ? (
          <CircleHelp size={15} aria-hidden="true" />
        ) : (
          <ArrowUpRight size={15} aria-hidden="true" />
        )}
        <span>
          {question
            ? t('点选回复，也可以直接输入', 'Choose a reply, or write your own below')
            : t('点选继续聊', 'Choose a follow-up')}
        </span>
      </div>
      {question?.form === 'birth' && (
        <button className="agent-guidance-birth" type="button" onClick={onBirth} disabled={disabled}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span>
            {t('补充出生资料', 'Add birth details')}
            <small>
              {t(
                '已有资料会保留；时刻不确定可如实说明。',
                'Existing details are kept. It’s OK if you don’t know the time.',
              )}
            </small>
          </span>
          <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      )}
      <div className="agent-guidance-options">
        {options.map((option) => (
          <button key={option.id} type="button" disabled={disabled} onClick={() => reply(option.text)}>
            <span>{option.text}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="agent-guidance-other">
        <button type="button" disabled={disabled} onClick={onCustom}>
          <PenLine size={12} aria-hidden="true" />
          {question ? t('我自己说', 'Write my own reply') : t('补充我的情况', 'Add my context')}
        </button>
        {question && (
          <button type="button" disabled={disabled} onClick={() => reply(unsure)}>
            {unsure}
            <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>
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
