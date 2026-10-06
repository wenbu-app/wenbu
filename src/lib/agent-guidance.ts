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
    prompt: [
      '我在工作选择上有些犹豫，先帮我找出最该核实的三件事。',
      'I’m weighing a work decision. Help me identify three things to check first.',
    ],
  },
  {
    id: 'relationships',
    category: ['关系与沟通', 'Relationships'],
    prompt: [
      '我想理清一段关系，帮我找到沟通的切入点。',
      'Help me find a starting point for a difficult conversation.',
    ],
  },
  {
    id: 'self',
    category: ['认识自己', 'Know yourself'],
    prompt: [
      '我想读懂自己的八字命盘，带我从基础开始。',
      'Help me understand my BaZi chart, starting with the basics.',
    ],
  },
  {
    id: 'learn',
    category: ['从零入门', 'Learn the basics'],
    prompt: [
      '用一个简单例子，讲讲塔罗可以怎样帮助反思。',
      'Show me a simple example of using tarot for reflection.',
    ],
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

// Older reports may contain intake questions addressed to the reader. Sending one
// back as a user message reverses its meaning. Exclude these known intake patterns.
export function reportFollowupQuestions(questions: string[]): string[] {
  const intake =
    /^(?:你(?:想|希望|更|有没有|是否|手上|已经|愿意)|想先(?:了解|深入|看|从)|要不要|是否要|愿不愿意|更想|还想|would you like|do you (?:want|prefer)|which .*(?:would|do) you|what (?:would|do) you|how (?:would you like|do you feel))/i;
  return [...new Set(questions.map((q) => q.trim()).filter(Boolean))].filter(
    (q) => q.length <= 3000 && !intake.test(q),
  );
}

export function followupSuggestions(message: AgentMessage, locale: Locale): { id: string; text: string }[] {
  if (message.role !== 'assistant' || message.status !== 'complete' || message.question) return [];
  const report = [...message.artifacts].reverse().find((a) => a.type === 'report');
  if (report?.type === 'report') {
    const questions = reportFollowupQuestions(report.questions).slice(0, 2);
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
