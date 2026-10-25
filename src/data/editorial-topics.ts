export type EditorialTopic = {
  id: string;
  slug: string;
  category: 'learn' | 'compare';
  mode: 'new' | 'extend';
  tool: 'bazi' | 'iching' | 'tarot' | 'ziwei' | 'agent' | 'daily';
  zh: string;
  en: string;
  task: string;
  unique: string;
  sources: string[];
  priority: number;
};

export const editorialSources: Record<string, { title: string; url: string; role: string }> = {
  capabilities: {
    title: 'Wenbu · versioned public capabilities',
    url: 'https://wenbu.app/capabilities.json',
    role: 'First-party current tool, convention and privacy contract; not external endorsement or predictive validation',
  },
  methods: {
    title: 'Wenbu · calculation conventions',
    url: 'https://wenbu.app/methodology/',
    role: 'First-party implementation; not evidence of predictive accuracy',
  },
  bazi: {
    title: 'Wenbu · BaZi guide',
    url: 'https://wenbu.app/knowledge/en/bazi-basics.md',
    role: 'Existing editorial and reproducible chart conventions',
  },
  birth: {
    title: 'Wenbu · birth time and time zones',
    url: 'https://wenbu.app/knowledge/en/birth-time-timezone.md',
    role: 'Existing editorial and boundary examples',
  },
  tarot: {
    title: 'Wenbu · tarot beginner guide',
    url: 'https://wenbu.app/knowledge/en/tarot-beginner.md',
    role: 'Existing editorial and worked reading',
  },
  iching: {
    title: 'Wenbu · three-coin method',
    url: 'https://wenbu.app/knowledge/en/iching-three-coins.md',
    role: 'Existing editorial and worked calculation',
  },
  ziwei: {
    title: 'Wenbu · twelve palaces',
    url: 'https://wenbu.app/knowledge/en/ziwei-twelve-palaces.md',
    role: 'Existing editorial; traditional interpretation',
  },
  questions: {
    title: 'Wenbu · asking a better question',
    url: 'https://wenbu.app/knowledge/en/ask-a-better-question.md',
    role: 'Existing editorial practice',
  },
  review: {
    title: 'Wenbu · reviewing a reading',
    url: 'https://wenbu.app/knowledge/en/review-a-reading.md',
    role: 'Existing editorial practice',
  },
  agents: {
    title: 'Wenbu · agent integrations',
    url: 'https://wenbu.app/agents/',
    role: 'Current first-party product documentation',
  },
  daily: {
    title: 'Wenbu · daily card',
    url: 'https://wenbu.app/daily/',
    role: 'Current first-party product UI; not a personal forecast',
  },
  hko: {
    title: 'Hong Kong Observatory · calendar conversion',
    url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm',
    role: 'Official calendar reference; not evidence of fortune-telling',
  },
  waite: {
    title: 'A. E. Waite · The Pictorial Key to the Tarot, Part III',
    url: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3',
    role: 'Waite primary text on card entries and reversals; historical symbolic interpretations, not evidence of predictive accuracy',
  },
  lunar: {
    title: 'lunar-typescript · official source',
    url: 'https://raw.githubusercontent.com/6tail/lunar-typescript/master/README.md',
    role: 'Calculation implementation and conventions',
  },
  iztro: {
    title: 'iztro · official documentation',
    url: 'https://iztro.com/quick-start',
    role: 'Calculation library documentation',
  },
  fatetell: {
    title: 'FateTell · official overview',
    url: 'https://fatetell.com/',
    role: 'Vendor statements; public page only, no paid account testing',
  },
  fatetellCalculator: {
    title: 'FateTell · official calculator',
    url: 'https://fatetell.com/bazi-calculator',
    role: 'Vendor calculator documentation',
  },
  labyrinthos: {
    title: 'Labyrinthos · official app',
    url: 'https://app.labyrinthos.co/',
    role: 'Vendor statements; current plans require verification',
  },
  labyrinthosLearn: {
    title: 'Labyrinthos · official learning library',
    url: 'https://labyrinthos.co/pages/learn-tarot-for-beginners-with-our-online-tarot-classes',
    role: 'Vendor learning offering; do not reproduce its lessons',
  },
  chani: {
    title: 'CHANI · official app',
    url: 'https://www.chani.com/app',
    role: 'Vendor statements; not a paid-account test',
  },
  costar: {
    title: 'Co–Star · official product',
    url: 'https://www.costarastrology.com/',
    role: 'Vendor statements; not evidence for predictive accuracy',
  },
  astro: {
    title: 'Astrodienst · official horoscope tools',
    url: 'https://www.astro.com/horoscope',
    role: 'Vendor offering and tool descriptions',
  },
  cafe: {
    title: 'Cafe Astrology · official free reports',
    url: 'https://astro.cafeastrology.com/',
    role: 'Vendor offering and calculation input descriptions',
  },
  biddy: {
    title: 'Biddy Tarot · official learning',
    url: 'https://biddytarot.com/learn-tarot/',
    role: 'Vendor course offering; no paid-course evaluation',
  },
  trusted: {
    title: 'Trusted Tarot · official free reading',
    url: 'https://www.trustedtarot.com/free-reading/',
    role: 'Vendor descriptions of spreads and free access; accuracy claims are not verified',
  },
  sage: {
    title: 'Sage · official tarot journal',
    url: 'https://sagetarot.app/',
    role: 'Vendor description of recording physical-deck draws and local storage; no security audit',
  },
  tarotjournal: {
    title: 'Tarot Journal · official product',
    url: 'https://tarotjournal.com/',
    role: 'Vendor features; public journals are not permission to copy personal readings',
  },
  cardloom: {
    title: 'Cardloom · official readings and local journal',
    url: 'https://cardloom.site/',
    role: 'Vendor statements about browser draws, physical-deck logging, local journal export and optional AI; no account, storage or security audit',
  },
  deeporacle: {
    title: 'Deep Oracle · official tarot tools and learning library',
    url: 'https://www.deeporacle.ai/en/tarot',
    role: 'Vendor statements about free card draws and references; distinguish tarot access from separately priced BaZi reports and do not infer undocumented journal features',
  },
  tarotlearninglab: {
    title: 'Tarot Learning Lab · official readings and saved readings',
    url: 'https://tarotlearninglab.com/readings',
    role: 'Vendor statements about online or physical-deck readings, browser or membership saves and a partly free course; no paid membership test',
  },
  learntarot: {
    title: 'Learning the Tarot · Joan Bunning official course',
    url: 'https://learntarot.com/',
    role: 'Course structure and requirements; do not reproduce copyrighted lessons',
  },
  wenbu: {
    title: 'Wenbu · current free access',
    url: 'https://wenbu.app/free/',
    role: 'First-party access and quota documentation',
  },
};

const topic = (
  id: string,
  slug: string,
  tool: EditorialTopic['tool'],
  zh: string,
  en: string,
  task: string,
  unique: string,
  sources: string[],
  mode: EditorialTopic['mode'] = 'new',
  priority = 70,
): EditorialTopic => ({ id, slug, tool, zh, en, task, unique, sources, mode, priority, category: 'learn' });
const comparisonTitles: Record<string, [string, string]> = {
  chani: [
    'CHANI 与问卜：每日占星与塔罗日签，怎样选？',
    'CHANI vs Wenbu: daily astrology or tarot reflection?',
  ],
  costar: [
    'Co–Star 与问卜：星座社交，还是围绕问题展开对话？',
    'Co–Star vs Wenbu: social astrology or a question-led conversation?',
  ],
  'astro-com': [
    'Astro.com 与问卜：西方星盘，还是东方命盘？',
    'Astro.com vs Wenbu: Western charts or Chinese astrology?',
  ],
  'cafe-astrology': [
    'Cafe Astrology 与问卜：免费星盘报告与对话研习',
    'Cafe Astrology vs Wenbu: free reports or a sourced conversation?',
  ],
  'biddy-tarot': [
    'Biddy Tarot 与问卜：系统学塔罗，还是先免费抽牌？',
    'Biddy Tarot vs Wenbu: tarot lessons or a free reading?',
  ],
  'trusted-tarot': [
    'Trusted Tarot 与问卜：塔罗牌阵、逆位与记录怎么选？',
    'Trusted Tarot vs Wenbu: spreads, reversals and saved readings',
  ],
  'sage-tarot': [
    'Sage 与问卜：记录实体牌，还是在网页上抽牌？',
    'Sage vs Wenbu: journal a physical deck or draw online?',
  ],
  'tarot-journal': [
    'Tarot Journal 与问卜：多牌组日志与轻量复盘',
    'Tarot Journal vs Wenbu: a dedicated journal or a simple review?',
  ],
  'learning-the-tarot': [
    'Learning the Tarot 与问卜：自学课程与网页练习如何搭配？',
    'Learning the Tarot and Wenbu: a course, a practice tool, or both?',
  ],
};
const compare = (
  slug: string,
  name: string,
  sources: string[],
  mode: EditorialTopic['mode'] = 'new',
): EditorialTopic => ({
  id: `compare-${slug}`,
  slug,
  category: 'compare',
  mode,
  tool: 'agent',
  zh: comparisonTitles[slug]?.[0] ?? `问卜与 ${name}：按实际需求选择`,
  en: comparisonTitles[slug]?.[1] ?? `Wenbu vs ${name}: choose for the task you have`,
  task: `Help a reader decide between Wenbu and ${name} for a concrete reading, learning or record-keeping task.`,
  unique:
    (
      {
        chani:
          'Compare an astrology-led audio/reflection routine with a browser-based practice across Chinese traditions and tarot. Show what each actually helps the reader do; do not call them interchangeable chart systems.',
        costar:
          'Compare a socially oriented astrology experience with a question-led browser workspace. Explain the different traditions and evaluate which input/context a reader would need; do not infer app privacy or undocumented features.',
        'astro-com':
          'A Western natal-chart calculation and learning workflow versus Chinese chart tools and tarot reflection. Explain system differences before the decision matrix. A five-minute checklist must use the same real task without pretending that Western and BaZi charts are equivalent.',
        'cafe-astrology':
          'Compare self-service Western astrology reports with a sourced multi-tradition conversation. Give three practical reader scenarios and distinguish free report access from paid or untested features.',
        'biddy-tarot':
          'Compare structured tarot learning with a first reading and reflection workflow. Credit the competitor’s educational scope; Wenbu is not a substitute for an entire course.',
        fatetell:
          'Add a fresh decision matrix around BaZi calculators, report products, daily practice and actual agent integrations. Keep existing comparison evidence; do not claim that a missing API description proves an API does not exist.',
        labyrinthos:
          'A serious tarot-learning and spread practice versus a simple multi-tradition browser session. Compare documented journal access and course scope without inventing paid limits.',
        'trusted-tarot':
          'Compare multiple manually selected spreads and configurable reversals with simple upright daily practice and an optional sourced conversation. Give the user a reproducible selection checklist; vendor predictive claims remain vendor claims.',
        'sage-tarot':
          'Distinguish recording cards drawn from a physical deck from drawing cards on a website. Compare local-only journal portability with optional Wenbu account/cloud saving, without claiming that local storage is universally better or worse.',
        'tarot-journal':
          'Compare a dedicated multi-deck/spread journal and client-record workflow with a lightweight reading-to-reflection workspace. Never quote or reuse community members’ personal journal examples.',
        'learning-the-tarot':
          'Compare a self-paced 19-lesson course requiring a deck with a browser tool that helps practice and ask questions. A sensible combined workflow may be the best option; do not pretend every reader must replace the course.',
      } as Record<string, string>
    )[slug] +
    ' Include source-linked trade-offs, three real reader scenarios, one explanatory figure and a concise evaluation worksheet. Never invent pricing, account tests or accuracy rankings.',
  sources: ['wenbu', 'methods', 'agents', ...sources],
  priority: 90,
});

// Stable intent ownership, not automatically generated keyword permutations.
export const editorialTopics: EditorialTopic[] = [
  compare('chani', 'CHANI', ['chani']),
  compare('costar', 'Co–Star', ['costar']),
  compare('astro-com', 'Astrodienst / Astro.com', ['astro']),
  compare('cafe-astrology', 'Cafe Astrology', ['cafe']),
  compare('biddy-tarot', 'Biddy Tarot', ['biddy']),
  compare('fatetell', 'FateTell', ['fatetell', 'fatetellCalculator'], 'extend'),
  compare('labyrinthos', 'Labyrinthos', ['labyrinthos', 'labyrinthosLearn'], 'extend'),
  compare('trusted-tarot', 'Trusted Tarot', ['trusted']),
  compare('sage-tarot', 'Sage Tarot Journal', ['sage']),
  compare('tarot-journal', 'Tarot Journal', ['tarotjournal']),
  compare('learning-the-tarot', 'Learning the Tarot', ['learntarot']),
  topic(
    'daily-reflection',
    'daily-card-reflection',
    'daily',
    '日签怎么用：从一张牌到一个具体行动',
    'Use a daily tarot card without outsourcing your day',
    'Start a daily practice without birth details or predictions.',
    'A morning-to-evening diagram and an observable action/review worksheet; distinguish daily card from Agent quota.',
    ['daily', 'tarot', 'review'],
    'new',
    95,
  ),
  topic(
    'first-reading-update',
    'first-reading',
    'agent',
    '第一次用问卜：先看完整示例，再开始自己的问题',
    'Your first Wenbu session: preview, try and save',
    'Understand the current guest-first flow.',
    'A current flow diagram: independent example, own input, full result, optional account save. Preserve earlier guide.',
    ['wenbu', 'questions', 'agents'],
    'extend',
    93,
  ),
  topic(
    'chart-differences',
    'why-bazi-charts-differ',
    'bazi',
    '为什么两个八字排盘结果不同？按四步核对',
    'Why do two BaZi calculators disagree?',
    'Diagnose different charts before comparing interpretations.',
    'An input/convention/output decision tree, with unknown information explicitly left unknown; no fabricated chart.',
    ['bazi', 'birth', 'lunar', 'methods'],
  ),
  topic(
    'tarot-three-relations',
    'tarot-beginner',
    'tarot',
    '三张牌连读：把三段牌义连成一个问题',
    'Read three tarot cards as a relationship',
    'Go beyond reading three isolated definitions.',
    'A three-position relationship diagram and a worked symbolic reading without predicting other people.',
    ['tarot', 'waite', 'questions'],
    'extend',
  ),
  topic(
    'birth-repeated-hour',
    'birth-time-timezone',
    'bazi',
    '夏令时重复的一小时：怎样记录出生时间',
    'Birth time during a repeated daylight-saving hour',
    'Record an ambiguous local birth time without silently choosing an offset.',
    'A forked UTC timeline; use conceptual offsets, do not invent historical jurisdiction rules.',
    ['birth', 'methods', 'lunar'],
    'extend',
  ),
  topic(
    'tarot-frightening',
    'death-tower-devil-cards',
    'tarot',
    '死神、高塔、恶魔：先看画面，再看牌名',
    'Death, the Tower and the Devil: look before you label',
    'Read intense card images without alarming predictions.',
    'Three image-observation prompts and a what-is-visible/what-is-inferred table.',
    ['tarot', 'waite', 'questions'],
  ),
  topic(
    'relationship-question',
    'relationship-tarot-questions',
    'tarot',
    '关系问题怎么问，才能回到自己的选择',
    'Ask a relationship tarot question you can act on',
    'Reframe mind-reading questions into choices under the reader’s control.',
    'Before/after questions with an action and a checkable outcome for each.',
    ['questions', 'tarot', 'review'],
  ),
  topic(
    'repeat-draw',
    'repeating-a-tarot-question',
    'tarot',
    '同一个问题反复抽牌，会更清楚吗？',
    'Should you draw again for the same question?',
    'Decide whether new information justifies a new reading.',
    'A repeat-or-review decision tree and a seven-day observation example.',
    ['tarot', 'questions', 'review'],
  ),
  topic(
    'unknown-hour',
    'unknown-birth-time',
    'bazi',
    '不知道出生时间：怎样保留不确定性',
    'What a BaZi chart can show without a birth time',
    'Avoid manufacturing an hour pillar.',
    'Known/unknown field map and a clarification checklist; no invented midnight input.',
    ['bazi', 'birth', 'methods'],
    'extend',
  ),
  topic(
    'coin-check',
    'iching-three-coins',
    'iching',
    '三钱法起卦：从每次投掷到本卦与之卦',
    'Check an I Ching coin cast from the bottom up',
    'Catch line-order and moving-line mistakes.',
    'A six-row worksheet with original line, moving status and changed line; verify arithmetic against source.',
    ['iching', 'methods'],
    'extend',
  ),
  topic(
    'ziwei-first-map',
    'ziwei-twelve-palaces',
    'ziwei',
    '紫微十二宫：先看位置，再看名称',
    'Locate the twelve Zi Wei palaces before interpreting',
    'Read chart structure without making deterministic claims.',
    'A labelled palace-reading path and terminology map; do not invent a personal star chart.',
    ['ziwei', 'iztro', 'methods'],
    'extend',
  ),
  topic(
    'review-two-weeks',
    'review-a-reading',
    'agent',
    '两周以后怎样回看一次解读',
    'Review a reading after two weeks',
    'Separate observed facts from interpretations after time has passed.',
    'A dated observation worksheet and an example containing both confirming and disconfirming observations.',
    ['review', 'questions'],
    'extend',
  ),
  topic(
    'agent-reproducible',
    'reproducible-reading-workflow',
    'agent',
    '把一次解读交给 Agent：怎样保留输入、规则与来源',
    'Make a reading reproducible for your agent',
    'Pass only the selected context needed to repeat a result.',
    'A context→tool→evidence→interpretation diagram and a structured handoff checklist; link current API, do not invent flags.',
    ['agents', 'methods', 'review'],
  ),
  topic(
    'daily-vs-draw',
    'daily-card-vs-tarot-draw',
    'daily',
    '日签与重新抽牌：什么时候用哪一个',
    'A daily card or a fresh tarot draw?',
    'Choose a daily practice or a question-specific draw.',
    'A two-path decision map distinguishing stable daily reveal and a fresh intentional reading.',
    ['daily', 'tarot', 'methods'],
  ),
  topic(
    'journal-private',
    'reading-journal-privacy',
    'agent',
    '手记怎么记：留下理解，少存私人资料',
    'Keep a useful reading journal with less personal data',
    'Record useful context and observations without copying sensitive details.',
    'A filled privacy-conscious journal template and save/export choice map; no promise of anonymous cloud storage.',
    ['review', 'wenbu', 'agents'],
  ),
  topic(
    'tarot-observation',
    'tarot-image-observation',
    'tarot',
    '先观察塔罗画面，再打开牌义',
    'Observe a tarot image before opening the meanings',
    'Make observations distinct from associations.',
    'A four-column visible detail/association/question/action worksheet.',
    ['tarot', 'waite', 'questions'],
  ),
  topic(
    'tarot-court',
    'tarot-suits-and-court-cards',
    'tarot',
    '宫廷牌一定代表一个人吗？',
    'Does a court card have to represent a person?',
    'Explore roles and actions without assigning strangers fixed identities.',
    'Compare person, role and behavior interpretations for one hypothetical scene.',
    ['tarot', 'waite'],
    'extend',
  ),
  topic(
    'tarot-reversal-update',
    'tarot-reversals',
    'tarot',
    '正位与逆位：先确认你选择的规则',
    'Upright and reversed tarot: choose a convention first',
    'Use a consistent reversal setting without equating upside-down with bad.',
    'Two reading paths for the same symbolic image and a settings checklist.',
    ['tarot', 'waite', 'methods'],
    'extend',
  ),
  topic(
    'five-elements-update',
    'five-elements',
    'bazi',
    '五行图的数量、季节和解释是三件事',
    'Element counts, seasons and interpretation are different layers',
    'Avoid interpreting a count as strength or prescribing a remedy.',
    'A three-layer figure and a counterexample checklist; no health or financial claims.',
    ['bazi', 'methods', 'lunar'],
    'extend',
  ),
  topic(
    'bazi-ten-gods-update',
    'bazi-ten-gods',
    'bazi',
    '十神不是职业标签：从关系名称开始',
    'Read the Ten Gods as relationships, not job labels',
    'Read traditional labels without turning them into life predictions.',
    'A reference-point relationship diagram and vocabulary exercise.',
    ['bazi', 'methods'],
    'extend',
  ),
  topic(
    'iching-multiple',
    'multiple-moving-lines',
    'iching',
    '多个动爻怎么读：先写清采用哪种规则',
    'Multiple moving lines: state the rule you use',
    'Recognize that interpretations depend on an explicit tradition.',
    'An alternative-conventions table; do not attribute rules to unread classical passages.',
    ['iching', 'methods'],
  ),
  topic(
    'question-repair',
    'ask-a-better-question',
    'agent',
    '把模糊的困惑改成能回答的问题',
    'Turn a vague concern into a workable question',
    'Give enough context without writing a life history.',
    'Five before/after examples with boundaries and one next action.',
    ['questions', 'review', 'agents'],
    'extend',
  ),
  topic(
    'beginner-choice',
    'choose-a-tool',
    'agent',
    '八字、易经、塔罗、紫微：按问题选择入口',
    'Choose BaZi, I Ching, tarot or Zi Wei for your question',
    'Choose a tool based on available inputs and the task.',
    'A question/input/output matrix; no ranking of divinatory accuracy.',
    ['bazi', 'iching', 'tarot', 'ziwei'],
    'extend',
  ),
  topic(
    'ai-citation-repair',
    'read-ai-with-sources',
    'agent',
    'AI 给了出处，怎样核对它真的支持结论',
    'Check whether an AI citation supports its claim',
    'Read a source beyond the presence of a hyperlink.',
    'A claim→source passage→scope worksheet and a failed-citation example.',
    ['agents', 'methods', 'review'],
    'extend',
  ),
  topic(
    'tarot-work-question',
    'tarot-career-reflection',
    'tarot',
    '工作选择怎么问塔罗：先列事实，再谈象征',
    'Use tarot to reflect on a work decision',
    'Explore a career choice without outsourcing the decision.',
    'A facts/constraints/options matrix, symbolic prompts and a real-world information step.',
    ['questions', 'tarot', 'review'],
  ),
  topic(
    'ziwei-transformations-update',
    'ziwei-four-transformations',
    'ziwei',
    '四化怎么连回宫位：不要把一个词当结论',
    'Connect the four transformations to their chart context',
    'Read a traditional relationship within the chart rather than in isolation.',
    'A context chain and missing-input checklist; no invented fate claims.',
    ['ziwei', 'iztro', 'methods'],
    'extend',
  ),
];

export const editorialCadence = {
  timezone: 'Asia/Shanghai',
  targetTopicsPerDay: 3,
  hours: [9, 15, 21],
  minimumDaysBetweenRefreshes: 28,
} as const;
