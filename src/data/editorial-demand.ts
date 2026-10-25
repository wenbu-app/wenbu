// These are editorial research hypotheses, not measured search volume. Actual
// Search Console queries and product outcomes arrive through observations.
export type SearchBrief = {
  pillar: string;
  intent: 'learn' | 'solve' | 'compare' | 'use';
  zh: string[];
  en: string[];
  basis: 'research_hypothesis' | 'observed_query';
};
export const editorialDemandLanes = [
  {
    pillar: 'bazi-calendar',
    tool: 'bazi',
    intent: 'solve',
    zh: ['八字排盘', '五行查询', '出生时间不确定', '立春和春节', '真太阳时', '公历农历闰月'],
    en: [
      'BaZi calculator',
      'Chinese zodiac year boundary',
      'unknown birth time',
      'solar time BaZi',
      'five elements chart',
    ],
    tasks: [
      'Verify a birth record before choosing a calendar and timezone.',
      'Explain a year-boundary discrepancy using both conventions.',
      'Read what a missing hour can and cannot establish.',
      'Separate visible element counts from seasonal interpretation.',
      'Check a leap-month conversion using an official calendar.',
    ],
    sources: ['methods', 'hko', 'birth', 'bazi', 'lunar'],
  },
  {
    pillar: 'iching-practice',
    tool: 'iching',
    intent: 'use',
    zh: ['易经起卦', '三枚硬币起卦', '变爻怎么看', '本卦变卦', '六爻顺序'],
    en: [
      'I Ching free online reading',
      'I Ching coin calculator',
      'changing lines',
      'hexagram line order',
      'manual I Ching entry',
    ],
    tasks: [
      'Transfer a physical coin record into six lines without reversing the order.',
      'Compare moving-line conventions without claiming one universal answer.',
      'Keep the original casting and distinguish a follow-up question from a redraw.',
      'Check the relationship between upper/lower trigrams and a changed hexagram.',
      'Turn a decision question into observable constraints and a later review.',
    ],
    sources: ['iching', 'methods', 'questions', 'review'],
  },
  {
    pillar: 'tarot-learning',
    tool: 'tarot',
    intent: 'learn',
    zh: ['塔罗牌新手', '塔罗三张牌阵', '塔罗正位逆位', '塔罗关系问题', '塔罗工作选择'],
    en: [
      'free online tarot for beginners',
      'three card tarot spread',
      'tarot reversals',
      'tarot card meanings',
      'tarot questions for reflection',
    ],
    tasks: [
      'Choose positions before drawing and interpret the same cards in that declared spread.',
      'Separate a card’s historical meaning from a present-day personal association.',
      'Write a relationship question about your choices rather than another person’s hidden thoughts.',
      'Use a work decision to compare facts and symbolic prompts.',
      'Learn suits and court cards by testing a concrete reading against source passages.',
    ],
    sources: ['tarot', 'waite', 'questions', 'review'],
  },
  {
    pillar: 'ziwei-reading',
    tool: 'ziwei',
    intent: 'learn',
    zh: ['紫微斗数排盘工具', '紫微命盘怎么看', '命宫身宫', '紫微四化', '紫微空宫'],
    en: [
      'zi wei dou shu calculator',
      'Zi Wei twelve palaces',
      'four transformations',
      'empty palace Zi Wei',
      'birth chart conventions',
    ],
    tasks: [
      'Find the chart conventions before comparing two Zi Wei results.',
      'Distinguish palace labels, stars and four-transformation annotations.',
      'Explain an empty palace without inventing a missing part of someone’s life.',
      'Compare two school conventions with clearly identified inputs.',
      'Translate a palace reading into an evidence-checking question rather than a life prediction.',
    ],
    sources: ['ziwei', 'iztro', 'methods', 'review'],
  },
  {
    pillar: 'daily-journal',
    tool: 'daily',
    intent: 'use',
    zh: ['塔罗日签', '每日一张牌', '塔罗日记模板', '抽牌记录', '塔罗复盘'],
    en: [
      'daily tarot card',
      'tarot journal template',
      'one card reflection',
      'tarot reading history',
      'review a tarot reading',
    ],
    tasks: [
      'Choose one observable action from a daily card and revisit it that evening.',
      'Record an interpretation before reading an automated explanation.',
      'Distinguish personal cloud records, browser records and public daily cards.',
      'Export a meaningful record and verify what it includes before moving devices.',
      'Review repeated cards without inferring a probability or a prediction from a tiny sample.',
    ],
    sources: ['daily', 'review', 'tarot', 'agents', 'capabilities'],
  },
  {
    pillar: 'agent-choice',
    tool: 'agent',
    intent: 'compare',
    zh: ['免费 AI 塔罗', 'AI 算命可信吗', '命理工具对比', '塔罗 MCP', '八字 API'],
    en: [
      'free AI tarot tools',
      'tarot journal comparison',
      'BaZi API',
      'tarot MCP server',
      'sourced AI readings',
    ],
    tasks: [
      'Choose a product for a named learning, journaling or calculation task using official feature evidence.',
      'Connect a public tool and validate its structured response without private account history.',
      'Check whether an exact source passage supports a generated interpretation.',
      'Compare free access conditions without treating an undocumented feature as absent.',
      'Recognize a plausible-sounding interpretation that lacks supporting evidence.',
    ],
    sources: ['agents', 'capabilities', 'methods', 'review', 'questions'],
  },
] as const;

export function defaultSearchBrief(tool: string): SearchBrief {
  const lane = editorialDemandLanes.find((l) => l.tool === tool) ?? editorialDemandLanes[5];
  return {
    pillar: lane.pillar,
    intent: lane.intent,
    zh: [...lane.zh],
    en: [...lane.en],
    basis: 'research_hypothesis',
  };
}
