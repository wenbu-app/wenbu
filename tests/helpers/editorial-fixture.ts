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
  for (const edition of [zh, en]) {
    Object.assign(edition, {
      answerSourceIds: ['daily'],
      evidence: [
        {
          claim: 'A practice can be reviewed later.',
          sourceId: 'daily',
          quote: 'Source material',
          kind: 'editorial',
        },
        {
          claim: 'An observation is a starting point.',
          sourceId: 'tarot',
          quote: 'Source material',
          kind: 'editorial',
        },
        {
          claim: 'Review keeps the process useful.',
          sourceId: 'review',
          quote: 'Source material',
          kind: 'editorial',
        },
      ],
    });
    Object.assign(edition.figure, { sourceIds: ['daily'] });
    Object.assign(edition.example, { sourceIds: ['review'] });
    for (const item of [...edition.faq, ...edition.glossary]) Object.assign(item, { sourceIds: ['tarot'] });
  }
  return { zh, en } as EditorialDraft;
}

export function fixtureFocusedDraft(): EditorialDraft {
  const draft = fixtureDraft();
  const paragraphs = {
    en: [
      'A follow-up record begins with the result you already saved and the question you are now trying to answer. Write the original question and its date before adding a narrower question. This keeps a new interpretation from silently replacing the earlier observation. For this hypothetical exercise, a reader is preparing a short conversation about how a shared project is progressing. The record separates the image they noticed from the information their colleague actually supplied.',
      'Use three labelled fields in the record: the original observation, the new information, and the next check. An empty field is useful information. If the colleague has not replied, write that the reply is unknown rather than filling it with an interpretation of a card. This produces a bounded question for the next conversation and gives the reader a visible reason to return to the same saved result instead of treating another random draw as verification.',
      'In the worked example, the reader first writes that the project deadline changed. They then record a possible association with adjusting a plan, explicitly marking it as their own interpretation. Finally they ask the colleague which part of the plan needs a new date. Only the actual reply can fill the evidence field. The example teaches how one record changes after new information, rather than implying that a symbolic image knows what the colleague will say.',
      'Close the follow-up with one observable outcome and retain the earlier version of the record. A clear reply may change the proposed action; no reply leaves the question open. Both outcomes are compatible with a useful reflection. Reviewing the two versions shows whether the reader acted on new information or merely rewrote a story. That distinction is the contribution of this addition and gives the exercise an answer that can be checked without claiming predictive accuracy.',
    ],
    zh: [
      '追问记录先从已经保存的结果开始，而不是把新的解释写成第一次就知道的事。先写原来的问题和日期，再写这一次想问清楚的小问题，这样能看见两次记录之间究竟多了什么信息。这个假设练习里，读者准备和同事讨论共同项目的安排，需要区分画面引起的个人联想与同事实际提供的事实。记录的目的不是替对方作判断，也不是用另一次随机抽取证明第一次解释正确，而是让下一次沟通有一个明确的起点。',
      '记录表分为原先的观察、新得到的信息、下一项核对三个栏位。某一栏暂时没有内容，本身也是需要保留的情况。如果同事还没有回复，就写回复未知，而不是用牌面含义补出对方的想法。读者因此得到一个可以真正询问的问题，也能说明为什么沿用同一份已保存的结果。新解释不能悄悄覆盖最早的观察，后续实际发生的事情也不能被倒写成抽取时已经确认的事实。每一栏都要能看出信息来自哪里，以及还有什么没有核对。',
      '完整示例中，读者先写项目截止日期有变化，再把需要调整计划记为自己的联想，最后询问同事究竟是哪一部分需要改期。只有真实回复能够填进事实栏，联想仍然留在解释栏。如果对方回答某一项已经完成，就只更新对应的信息和行动，不把整段经历改写成象征准确预测了结果。这个步骤展示一份记录如何在新增信息后发生变化，也展示一个原先无法回答的问题怎样变得具体，而不是提供任何人的真实工作资料或计算命盘。',
      '结束追问时写下一项可观察的结果，并保留早先版本。收到清楚的回复，可能需要改变行动；没有收到回复，就继续保留开放的问题。这两种情况都不妨碍反思有用。并排看两次记录，可以检查自己究竟根据新事实调整了计划，还是只换了一套叙事。练习的答案来自信息来源与行动是否对应，不能来自抽到的象征看起来是否贴合。下一次回看时，也应保留不符合原先联想的细节，让记录真正帮助读者理解沟通中的变化。',
    ],
  };
  for (const locale of ['zh', 'en'] as const) {
    const e = draft[locale];
    e.sections = [0, 1].map((i) => ({
      heading:
        locale === 'zh'
          ? ['保留原记录，再写追问', '用新信息核对行动'][i]
          : ['Keep the original record', 'Check the action against new information'][i],
      paragraphs: paragraphs[locale].slice(i * 2, i * 2 + 2),
      sourceIds: ['daily', 'review'],
    }));
    e.table.rows = [
      ['Original observation', 'Keep its date and wording'],
      ['New information', 'Name the actual source or mark unknown'],
      ['Next check', 'Ask one answerable follow-up'],
    ];
    e.example.steps = [
      'Retain the original question and result.',
      'Add a narrower question without inventing a reply.',
      'Update the record only after the actual reply.',
    ];
    e.faq = e.faq.slice(0, 2);
    e.glossary = e.glossary.slice(0, 2);
  }
  return draft;
}
