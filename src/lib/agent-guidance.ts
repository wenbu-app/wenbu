import type { AgentMessage, AgentMode } from './agent-protocol';
import type { Locale } from './schema';

type Copy = readonly [string, string];
export const guideText = (copy: Copy, locale: Locale) => copy[locale === 'zh' ? 0 : 1];

export type ConversationChoice = {
  text: string;
  action: 'guided' | 'clarification' | 'followup' | 'example';
  mode?: AgentMode;
};

// A shortcut is a complete message. It never incorporates or replaces unsent writing.
export function prepareAgentSubmission(draft: string, choice?: ConversationChoice) {
  const text = (choice ? choice.text : draft).trim();
  if (!text || text.length > 3000) return null;
  return {
    text,
    draft: choice ? draft : '',
    action: choice?.action ?? ('none' as const),
    mode: choice?.mode,
  };
}

export const conversationStarters = [
  {
    id: 'work',
    category: ['工作与选择', 'Work & decisions'],
    prompt: ['我在工作选择上有些犹豫', 'I’m weighing a decision at work'],
  },
  {
    id: 'relationships',
    category: ['关系与沟通', 'Relationships'],
    prompt: ['我想理清一段关系', 'I’d like to think through a relationship'],
  },
  {
    id: 'self',
    category: ['认识自己', 'Know yourself'],
    prompt: ['我想读懂自己的命盘', 'I’d like to understand my birth chart'],
  },
  {
    id: 'learn',
    category: ['从零入门', 'Learn the basics'],
    prompt: ['我想了解命理与占卜', 'I’m curious about divination'],
  },
] as const;

export const toolStarters = [
  {
    id: 'tarot',
    prompt: ['我想试试三张塔罗，怎么开始？', 'How do I start a three-card tarot reading?'],
    mode: 'explore',
  },
  {
    id: 'iching',
    prompt: ['我想用易经起一卦', 'I’d like to cast an I Ching hexagram'],
    mode: 'explore',
  },
  {
    id: 'library',
    prompt: ['真太阳时怎样影响八字？帮我查查依据', 'How does solar time affect BaZi? Find the sources'],
    mode: 'research',
  },
] as const;

export function followupSuggestions(message: AgentMessage, locale: Locale): { id: string; text: string }[] {
  if (message.role !== 'assistant' || message.status !== 'complete' || message.question) return [];
  const report = [...message.artifacts].reverse().find((a) => a.type === 'report');
  if (report?.type === 'report') {
    const questions = [...new Set(report.questions.map((q) => q.trim()).filter(Boolean))].slice(0, 2);
    if (questions.length) return questions.map((text, i) => ({ id: `report-${i}`, text }));
  }
  const hasReading = message.artifacts.some((a) => a.type === 'chart');
  const alreadyHasExample = /例子|案例|示范|example|hypothetical/i.test(message.text);
  const items: { id: string; text: Copy }[] = hasReading
    ? [
        { id: 'explain', text: ['用白话讲讲这个结果', 'Explain this result simply'] },
        { id: 'next', text: ['接下来可以尝试什么？', 'What could I try next?'] },
      ]
    : [
        {
          id: 'example',
          text: alreadyHasExample
            ? ['整理成简明清单', 'Make a short checklist']
            : ['举个具体例子', 'Give me an example'],
        },
        { id: 'evidence', text: ['说说依据与局限', 'Explain the evidence and limits'] },
      ];
  return items.map((item) => ({ id: item.id, text: guideText(item.text, locale) }));
}
