import type { EditorialDraft } from '../../worker/editorial-schema';
export function fixtureDraft(): EditorialDraft {
  const make = (lang: 'zh' | 'en') => ({
    title: lang === 'zh' ? '把日签变成一次可回看的练习' : 'A daily-card practice you can review',
    description: 'A complete practical guide to observation and reflection, using one stable daily card.',
    answer:
      'Begin by identifying one visible detail in the image. Keep that observation separate from a personal association, then choose one small action whose outcome you can observe without treating the card as a prediction.',
    takeaways: [
      'Observe first, interpret second.',
      'Choose one action you control.',
      'Review what happened later.',
    ],
    sections: Array.from({ length: 4 }, (_, i) => ({
      heading: `${i + 1}. A distinct stage of the practice`,
      paragraphs: [
        `${i}. ${'Observe the illustration and name a concrete detail before using a traditional interpretation. A symbol can help frame a question, but it does not provide evidence about another person or a future event. '.repeat(4)}`,
        `${i}. ${'Review your action at the end of the day and record both matching and conflicting observations. A useful journal preserves uncertainty instead of turning an ambiguous sentence into a confident prediction. '.repeat(4)}`,
      ],
      sourceIds: ['daily', 'tarot'],
    })),
    figure: {
      title: 'From observation to review',
      caption: 'This diagram follows a small action through the day.',
      steps: [
        { label: 'Observe', detail: 'Name a visible detail.' },
        { label: 'Act', detail: 'Choose one small action.' },
        { label: 'Review', detail: 'Record what happened.' },
      ],
    },
    table: {
      title: 'What to record',
      columns: ['Step', 'Record'],
      rows: [
        ['Image', 'Visible detail'],
        ['Association', 'Personal interpretation'],
        ['Action', 'One controllable action'],
        ['Review', 'Observed outcome'],
      ],
      sourceIds: ['review'],
    },
    example: {
      title: 'A bounded practice',
      intro: 'A hypothetical reader has a busy day.',
      steps: [
        'Look at the illustration.',
        'Name one detail without interpreting it.',
        'Choose a short action.',
        'Return later and review the outcome.',
      ],
      conclusion: 'The action and observation remain more useful than a prediction.',
    },
    faq: [
      {
        question: 'Does this predict an event?',
        answer:
          'No. It provides a symbolic starting point for reflection, not evidence about a future event.',
      },
      {
        question: 'Should I draw again?',
        answer:
          'First review the question and the information you have before deciding to start a new reading.',
      },
      {
        question: 'Must I sign in?',
        answer:
          'You can begin the guest experience and decide later whether you want an account for cloud saving.',
      },
    ],
    glossary: [
      { term: 'Observation', definition: 'A detail visible in the illustration.' },
      { term: 'Association', definition: 'A personal connection prompted by a symbol.' },
      { term: 'Review', definition: 'A later comparison with what actually happened.' },
    ],
    cta: { label: 'Try the daily card', reason: 'Begin with a small reflection.' },
  });
  const zh = make('zh'),
    en = make('en');
  zh.sections.forEach(
    (s, i) =>
      (s.paragraphs = s.paragraphs.map(
        (_, j) =>
          `${i}-${j}：${'先观察画面中实际可见的细节，再区分个人联想和传统解释，选择一个能够亲自完成的小行动，并在晚上记录真实发生的情况。不要把象征当作对他人想法或未来事件的事实判断。'.repeat(7)}`,
      )),
  );
  return { zh, en };
}
