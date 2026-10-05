import { integrationArticles } from './integration-articles';
import { beginnerArticles } from './beginner-articles';

export type Copy = {
  title: string;
  description: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};
export type Article = {
  published?: string;
  updated?: string;
  slug: string;
  category: 'learn' | 'blog';
  symbol: string;
  minutes: number;
  tool: string;
  sources: { title: string; url: string }[];
  zh: Copy;
  en: Copy;
};
const lunar = {
  title: 'lunar-typescript · calculation source and examples',
  url: 'https://github.com/6tail/lunar-typescript',
};
const hko = {
  title: 'Hong Kong Observatory · Gregorian–Lunar conversion tables',
  url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm',
};
const iching = { title: 'Chinese Text Project · Book of Changes', url: 'https://ctext.org/book-of-changes' };
const iztro = {
  title: 'iztro · documentation and calculation conventions',
  url: 'https://iztro.com/quick-start',
};
const tarot = {
  title: 'Project Gutenberg · The Illustrated Key to the Tarot',
  url: 'https://www.gutenberg.org/ebooks/43548',
};
export const articles: Article[] = [
  ...integrationArticles,
  ...beginnerArticles,
  {
    slug: 'bazi-basics',
    category: 'learn',
    symbol: '命',
    minutes: 6,
    tool: 'bazi',
    sources: [
      lunar,
      hko,
      {
        title: '三命通会 · 卷七：子平说辨',
        url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷07',
      },
    ],
    zh: {
      title: '八字入门：先读懂四柱，再谈解读',
      description: '八字是什么？从年、月、日、时四柱，到日主、藏干与十神，建立一套能看懂命盘的阅读顺序。',
      sections: [
        {
          heading: '八个字，记录的是怎样的时间？',
          paragraphs: [
            '八字，也叫四柱，是把出生的年、月、日、时分别写成一组天干和地支。四组、每组两个字，所以叫八字。它属于中国传统命理的符号系统，和只看出生年份的生肖不同。',
            '先把「历法是否算对」与「解释是否有道理」分开。前者可以用日期、时区、节气和规则复核；后者属于传统解释与个人反思，不能因为排盘准确，就自动获得预测现实的可靠性。',
          ],
        },
        {
          heading: '从日主开始，而不是从吉凶开始',
          paragraphs: [
            '日柱的天干称为日主，是比较其他符号关系的参照。例如甲属于阳木，辛属于阴金。日主不是性格测验的最终结果，也不意味着一个人的身份只能由某种元素定义。',
            '你可以先找日主，再看月柱及其季节背景，然后查看其他天干与地支。十神描述其他天干与日主的五行、阴阳关系；「财」「官」等传统名称不等于现实里必然发生的财务或职业事件。',
          ],
        },
        {
          heading: '命盘上哪些信息值得核对？',
          paragraphs: [
            '第一遍阅读时，先核对公历日期、当地出生时间、出生地时区和换日规则。传统八字通常用立春划分年柱，用「节」划分月柱，而不是直接套农历初一。接近交节或晚上 23 点的出生时刻，尤其需要注明采用的规则。',
          ],
          bullets: [
            '时刻未知：保留三柱，明确不生成时柱。',
            '藏干：地支中按传统规则对应的天干，不等于可见字计数。',
            '五行图：先确认图表是在计数，还是使用了某种强弱权重。',
            '不同工具不一致：先比较时区和流派，再比较解读文字。',
          ],
        },
        {
          heading: '带着一个例子读命盘',
          paragraphs: [
            '与其问「我是不是注定适合某职业」，不如记录「这种解释让我想到哪段具体经历？又有哪些经历与它相反？」把相符与不符的例子一起保留，会比只寻找印证更有帮助。',
            '问卜先呈现可复核的命盘，再给出明确标记的 AI 解读。你始终可以只使用排盘，不请求解读，也不保存任何资料。',
          ],
        },
        {
          heading: '现在试一次：只读一根柱',
          paragraphs: [
            '用页面示例生成一张盘，先找到日柱中的天干，再在五行图上点选它所属的元素。把你看到的结果写成一句话：“这张示例盘的日主是……，图中的数量采用可见字计数。”',
            '这一步练习的是识别结构。想继续学习，可以读十神入门，或请 Agent 用一个天干关系举例，不必一次解释整个人生。',
          ],
        },
      ],
    },
    en: {
      title: 'How to read a BaZi chart, one pillar at a time',
      description:
        'A practical introduction to the four pillars, Day Master, hidden stems and Ten Gods, with a clear distinction between calculation and interpretation.',
      sections: [
        {
          heading: 'What do the eight characters record?',
          paragraphs: [
            'BaZi, or the Four Pillars, represents a birth year, month, day and hour as four pairs of heavenly stems and earthly branches. The eight characters belong to a traditional Chinese symbolic system. A chart contains more information than a birth-year zodiac animal.',
            'Keep two questions separate: was the calendar calculated correctly, and is an interpretation useful? Calendar mechanics can be checked against dates, time zones and conventions. A correct calculation does not establish that a symbolic interpretation predicts real events.',
          ],
        },
        {
          heading: 'Start with the Day Master',
          paragraphs: [
            'The heavenly stem of the day pillar is called the Day Master. It provides a reference for relationships among the other symbols. Jia, for example, is yang Wood; Xin is yin Metal. Neither label is a complete description of a person.',
            'Find the Day Master, then look at the month pillar and seasonal context. The Ten Gods describe relationships to the Day Master through element and polarity. Names such as Wealth and Officer are traditional categories, not promises about money or employment.',
          ],
        },
        {
          heading: 'Check the inputs before reading the story',
          paragraphs: [
            'Confirm the Gregorian date, recorded local time, birth time zone and day boundary. BaZi typically changes the year at the beginning-of-spring solar term and changes months at the relevant jie terms. It does not simply change every pillar at Lunar New Year.',
          ],
          bullets: [
            'Unknown time: omit the hour pillar instead of guessing.',
            'Hidden stems: distinguish the branch associations from visible-character counts.',
            'Element diagrams: ask whether a chart counts symbols or applies a weighting model.',
            'Different results: compare time zones and conventions before comparing prose.',
          ],
        },
        {
          heading: 'Compare the reading with a real example',
          paragraphs: [
            'Instead of asking whether a career is destined, ask which concrete experiences a reading brings to mind, and which experiences contradict it. Keeping both kinds of examples is more informative than looking only for confirmation.',
            'Wenbu displays the calculation first and labels optional AI reflections separately. You can use the chart without requesting a reading or saving personal details.',
          ],
        },
        {
          heading: 'Try it: read one pillar',
          paragraphs: [
            'Generate a chart with the example details. Find the day pillar’s stem, then select its element in the diagram. Describe only what you can see: “This example has … as its Day Master; the diagram counts visible characters.”',
            'Once that is clear, move on to the Ten Gods guide or ask the Agent to explain one stem relationship. You do not need to interpret the entire chart at once.',
          ],
        },
      ],
    },
  },
  {
    slug: 'five-elements',
    category: 'learn',
    symbol: '五',
    minutes: 5,
    tool: 'bazi',
    sources: [
      lunar,
      { title: 'Chinese Text Project · Shang Shu, Hong Fan', url: 'https://ctext.org/shang-shu/great-plan' },
    ],
    zh: {
      title: '五行缺什么，就一定要补什么吗？',
      description: '理解木火土金水的关系，分清可见字数量、季节旺衰与喜用神，避免把漂亮的五行图误当成诊断。',
      sections: [
        {
          heading: '先看五行之间的关系',
          paragraphs: [
            '木、火、土、金、水，在传统思想中用于组织生长、转化、承载、收敛与流动等关系。它们不是身体里五种可以化验的物质，也不是人格的五个科学维度。',
            '相生与相克是系统内的关系。木生火、火生土、土生金、金生水、水生木构成相生循环；相克也不是简单的「不好」，而是另一类制约关系。',
          ],
        },
        {
          heading: '计数不等于强弱',
          paragraphs: [
            '一张四柱命盘有八个可见字。把每个天干、地支的五行各计一次，可以得到清楚易读的构成图，但这种图没有纳入藏干比例、季节、通根、透干与合化条件。',
            '因此，「水是 0」只能说明在这个计数口径下没有可见水字，不能直接推导出需要改名、购买饰品或作出人生决定。所谓喜用神判断涉及流派和解释规则，不能由饼图里最小的一块自动决定。',
          ],
        },
        {
          heading: '怎样阅读问卜的图表',
          paragraphs: [
            '问卜把计数口径写在图旁：每个可见天干和地支各计 1 次，已知时辰合计 8，未知时辰合计 6。点击图例可以查看各元素数量。这里不输出伪精确的旺衰百分比。',
            '这张图可以作为学习结构的入口。若你进一步讨论季节和藏干，先明确新的解释口径，避免把不同层次的数据混在一起。',
          ],
        },
        {
          heading: '让象征帮助观察，而非替你决定',
          paragraphs: [
            '如果「木」让你想到生长，不妨写下一件想慢慢培养的事。如果「金」让你想到边界，可以检视最近哪些承诺过多。这是借助象征提问，不是从元素反推出事实。',
            '真正决定职业、关系、健康和财务选择的，仍然需要现实信息、沟通与专业判断。',
          ],
        },
        {
          heading: '一个不会越界的读图例子',
          paragraphs: [
            '假设一张已知时辰的示例盘显示木 2、火 1、土 3、金 2、水 0，总数是 8。你可以确认“可见字里水为 0，土出现最多”，但不能据此说“命里缺水”或“土最旺”。',
            '下一步在图例中逐项点选，把数量与四柱中的字对上。若想问季节或藏干，请把它写成新的问题，而不是让计数图替你回答。',
          ],
        },
      ],
    },
    en: {
      title: 'Does a missing element need to be “fixed”?',
      description:
        'Understand the five elements without confusing visible counts, seasonal strength and favorable-element interpretation.',
      sections: [
        {
          heading: 'Start with the relationships between elements',
          paragraphs: [
            'Wood, Fire, Earth, Metal and Water organize relationships such as growth, transformation, support, refinement and movement in traditional Chinese thought. They are not five substances that a medical test can measure, or five scientifically validated personality scores.',
            'The generating cycle follows Wood, Fire, Earth, Metal and Water, then returns to Wood. The controlling cycle describes another set of relationships. A controlling relationship is not automatically a bad outcome.',
          ],
        },
        {
          heading: 'A count is not a strength assessment',
          paragraphs: [
            'Four complete pillars contain eight visible characters. Counting the element of each stem and branch produces a readable composition chart. It leaves out hidden-stem weighting, season, roots and other interpretive conventions.',
            'A count of zero for Water therefore means no visible Water character under this specific counting method. It does not establish a need to change a name, buy an object or change a life plan. Favorable-element interpretations require more assumptions than selecting the smallest slice of a diagram.',
          ],
        },
        {
          heading: 'What the Wenbu diagram actually measures',
          paragraphs: [
            'Wenbu counts each visible stem and branch once: eight observations with a known hour, six when the hour is unknown. Select an element to inspect its count. The chart does not claim to measure strength or prescribe a remedy.',
            'Use the diagram to learn the structure. If you later discuss hidden stems or season, state the new method explicitly rather than mixing several measures into one unexplained score.',
          ],
        },
        {
          heading: 'Use the image to ask a useful question',
          paragraphs: [
            'If Wood suggests growth, name something you want to cultivate. If Metal suggests boundaries, review whether you have overcommitted. These are prompts for observation, not facts inferred from an element.',
            'Decisions about work, relationships, health and money still need real information, conversation and appropriate professional judgment.',
          ],
        },
        {
          heading: 'A worked example of reading the counts',
          paragraphs: [
            'Suppose a complete example chart shows Wood 2, Fire 1, Earth 3, Metal 2 and Water 0. The total is eight. You can say that no visible character is assigned to Water and that Earth occurs most often. The count alone does not establish a deficiency or rank seasonal strength.',
            'Select each element and match the count to the visible pillars. Treat questions about season or hidden stems as a separate step with its own method.',
          ],
        },
      ],
    },
  },
  {
    slug: 'birth-time-timezone',
    category: 'learn',
    symbol: '时',
    minutes: 7,
    tool: 'bazi',
    sources: [
      hko,
      { title: 'US Naval Observatory · The equation of time', url: 'https://aa.usno.navy.mil/faq/eqtime' },
      lunar,
    ],
    zh: {
      title: '出生时间、时区与真太阳时，怎样选才清楚？',
      description:
        '从夏令时、经度到子初换日，解释为什么同一出生资料可能排出不同命盘，以及如何留下可复核的计算约定。',
      sections: [
        {
          heading: '钟表上的时间还不够',
          paragraphs: [
            '1990 年某地的「下午三点」，需要结合当时使用的时区与夏令时，才能对应一个明确的世界时刻。今天的 UTC 偏移不一定等于出生那天的偏移。中国大陆也曾在部分年份实行夏令时。',
            '问卜接受 IANA 时区，例如 Asia/Shanghai 或 America/New_York，由时间库处理历史偏移。使用手机当前时区替代出生地时区，会造成错误，尤其是移居后排盘。',
          ],
        },
        {
          heading: '遇到夏令时重复或缺失的时间',
          paragraphs: [
            '夏令时前拨会跳过一段钟表时间；后拨可能让同一个时间出现两次。遇到这种输入，问卜的八字工具会提示补充明确偏移，而不会默默替用户选择一个时刻。',
            '例如纽约 2024 年 3 月 10 日的 02:30 并不存在于当地民用时钟；11 月 3 日的 01:30 则有两种可能。此时应查出生记录，再用明确 UTC 偏移表达所指时刻。',
          ],
        },
        {
          heading: '真太阳时做了什么？',
          paragraphs: [
            '地方平太阳时考虑经度：每一经度约对应四分钟。视太阳时还加入均时差，反映太阳视运动与平均时钟的差异。时区经线、出生地经度和历史夏令时都不能混为一谈。',
            '问卜提供近似视太阳时校正，需要用户输入经度，并在结果中保留分钟修正量。它不是高精度天文历表；接近时辰或换日边界时，应比较校正前后结果，不能把近似数字当作绝对答案。',
          ],
        },
        {
          heading: '把规则与结果一起保存',
          paragraphs: [
            '问卜默认零点换日，同时提供 23:00 子初换日。lunar-typescript 在默认规则下，晚子时的日柱保留当日、时干按次日计算；这一约定会在命盘里注明。',
            '年柱和月柱按绝对交节时刻判定；日柱和时柱采用选定的当地时钟。保存或导出时，会携带这些约定，方便你和其他工具逐项核对。',
          ],
        },
        {
          heading: '拿到两张不同命盘时，按顺序排查',
          paragraphs: [
            '先比较输入的公历日期与当地时刻，再比较时区和夏令时处理，然后核对交节、换日与真太阳时设置。一次只改一项，记录究竟是哪根柱发生了变化。',
            '提问时可以写：“两盘的年、月柱相同，日柱不同；输入都接近当地 23 点。请先比较换日规则。”如果只是希望学习流程，可以用明确标为示例的日期，不必公开自己的出生记录。',
          ],
        },
      ],
    },
    en: {
      title: 'Birth time, time zones and apparent solar time',
      description:
        'Why daylight saving, longitude and the late-Zi convention can change a chart, and how to make the calculation reproducible.',
      sections: [
        {
          heading: 'A clock time needs a place and a date',
          paragraphs: [
            '“Three in the afternoon” only identifies an instant when paired with the time zone and daylight-saving rules in effect on that date. Today’s UTC offset may differ from the historical offset at birth. Mainland China also observed daylight saving in some years.',
            'Wenbu accepts IANA zones such as Asia/Shanghai and America/New_York. Do not substitute your current device zone for the zone where you were born, especially after moving countries.',
          ],
        },
        {
          heading: 'Some clock times are missing or repeated',
          paragraphs: [
            'A spring clock change can skip a time; an autumn change can repeat it. Wenbu’s BaZi calculator rejects these ambiguous or nonexistent inputs instead of silently picking an instant. Resolve the recorded time and supply an explicit UTC offset when necessary.',
            'In New York, 02:30 on March 10, 2024 did not occur on the local civil clock. At the autumn transition, 01:30 on November 3, 2024 has two possible offsets. A birth record or other reliable historical information is needed to choose.',
          ],
        },
        {
          heading: 'What does solar-time correction change?',
          paragraphs: [
            'Local mean solar time follows longitude, at approximately four minutes per degree. Apparent solar time also accounts for the equation of time. Longitude, a time-zone meridian and daylight saving are different inputs.',
            'Wenbu offers an approximate apparent-solar-time correction, requires a longitude and shows the correction in minutes. It is not a high-precision ephemeris. Near a pillar boundary, compare the corrected and uncorrected results rather than treating an approximate correction as definitive.',
          ],
        },
        {
          heading: 'Save the convention with the result',
          paragraphs: [
            'The default day boundary is midnight; a 23:00 Zi boundary is also available. In the library’s midnight convention, a late-Zi day pillar stays on the civil day while the hour stem advances. The chart discloses that choice.',
            'Year and month pillars follow absolute solar-term boundaries. Day and hour pillars use the selected local clock. Exports preserve the settings so a discrepancy with another calculator can be investigated rather than explained away.',
          ],
        },
        {
          heading: 'Compare disagreeing charts one setting at a time',
          paragraphs: [
            'Check the Gregorian date and local clock time first, then the time zone and daylight-saving treatment. Next compare solar-term boundaries, the day boundary and solar-time correction. Change one setting at a time and note which pillar changes.',
            'For example: “The year and month pillars agree, but the day pillar differs for a time near 23:00. Please compare the day-boundary rules first.” Use clearly labeled example details when you only need to demonstrate the issue.',
          ],
        },
      ],
    },
  },
  {
    slug: 'iching-three-coins',
    category: 'learn',
    symbol: '易',
    minutes: 6,
    tool: 'iching',
    sources: [
      iching,
      { title: 'Book of Changes · Xi Ci I', url: 'https://ctext.org/book-of-changes/xi-ci-shang' },
    ],
    zh: {
      title: '三枚铜钱怎样组成一卦？',
      description: '一步步理解易经三钱法：6、7、8、9 的含义、六爻顺序、本卦与之卦，以及多动爻时的阅读边界。',
      sections: [
        {
          heading: '先固定规则，再开始投掷',
          paragraphs: [
            '准备三枚可区分正反的硬币，为一面记 2、另一面记 3。每次投掷把三个数相加，得到 6、7、8 或 9。采用哪一面记 2 并不重要，但一次记录中不要中途更换约定。',
            '投掷六次，第一次的结果放在最下方，依次向上排列。卦的顺序不是从页面顶部向下写；很多手工录入错误就出在这里。',
          ],
        },
        {
          heading: '四种数字，两种线形',
          paragraphs: [
            '7 是少阳，画实线；8 是少阴，画断线。9 是老阳，原本是实线，并会变化为断线；6 是老阴，原本是断线，并会变化为实线。6 与 9 都是动爻。',
            '公平的三钱法有八种等可能组合，6 和 9 各占一种，7 和 8 各占三种，因此概率分别是 1/8、3/8、3/8、1/8。三钱法与蓍草法的动爻分布不同，不应混称为同一种算法。',
          ],
        },
        {
          heading: '本卦与之卦怎样产生？',
          paragraphs: [
            '先按六个数字的阴阳画出本卦；只翻转动爻，再得到之卦。没有动爻时，两卦相同。这是一个明确的转换过程，可以独立核对，不需要模型推算。',
            '问卜用密码学随机数模拟硬币结果，也支持录入真实硬币结果。系统保留六个原始数值，展示变化位置和文王卦序，方便复盘。',
          ],
        },
        {
          heading: '多条动爻，怎样开始读？',
          paragraphs: [
            '多条动爻怎样取用，存在不同解读传统。问卜把所有动爻呈现出来，不把某一套选爻规则伪装成普遍共识。首页提示语为原创反思文字，不冒充《周易》原文。',
            '先写下一个具体、开放的问题，再记录卦象让你联想到什么。过些时候回来看，你当时忽略了哪些事实、采取了什么行动，会比反复求一个满意的答案更值得留存。',
          ],
        },
        {
          heading: '用六个数字练习一次',
          paragraphs: [
            '把 6、7、8、9、7、8 按从下到上的顺序记录。第一爻的 6 与第四爻的 9 是动爻：前者由阴变阳，后者由阳变阴，其余四爻保持不变。',
            '在问卜选择“录入铜钱结果”，按这个顺序输入，核对动爻位置，再读卦名。这个例子只用来检查转换规则，没有替任何现实问题起卦。',
          ],
        },
      ],
    },
    en: {
      title: 'How three coins become an I Ching hexagram',
      description:
        'A clear guide to 6, 7, 8 and 9, bottom-to-top line order, changing lines and the difference between a cast and an interpretation.',
      sections: [
        {
          heading: 'Choose a convention before casting',
          paragraphs: [
            'Assign 2 to one side of a coin and 3 to the other. Toss three coins and add their values: the total is 6, 7, 8 or 9. Which side receives which value matters less than keeping the convention consistent.',
            'Repeat six times. The first line belongs at the bottom of the hexagram; later lines are placed above it. Reversing this order changes the hexagram, so label a manual record clearly.',
          ],
        },
        {
          heading: 'Four numbers, two line shapes',
          paragraphs: [
            'Seven is young yang, a solid line. Eight is young yin, a broken line. Nine is old yang: solid, changing to broken. Six is old yin: broken, changing to solid. Six and nine are changing lines.',
            'Three fair coins have eight equally likely combinations. The probabilities of 6, 7, 8 and 9 are 1/8, 3/8, 3/8 and 1/8. The traditional yarrow procedure has a different changing-line distribution and should not be presented as the same method.',
          ],
        },
        {
          heading: 'The original and resulting hexagrams',
          paragraphs: [
            'Draw the original hexagram from the six line values. Flip only the changing lines to construct the resulting hexagram. If none change, the two are identical. This transformation is deterministic and can be checked independently of an AI interpretation.',
            'Wenbu simulates coin outcomes with cryptographic randomness and also accepts physical coin results. The six values, changing positions and King Wen numbers remain visible for review.',
          ],
        },
        {
          heading: 'Where to begin when several lines change',
          paragraphs: [
            'Traditions differ on how to read multiple changing lines. Wenbu shows every changing position rather than claiming a universal selection rule. The short themes are original reflection prompts, not quotations from a classical edition.',
            'Begin with an open, concrete question. Record what the imagery brings to mind and revisit the note later. What you overlooked and what you actually did can be more useful than repeatedly casting until an answer feels comfortable.',
          ],
        },
        {
          heading: 'Check the process with six numbers',
          paragraphs: [
            'Write 6, 7, 8, 9, 7, 8 in bottom-to-top order. Lines one and four change: the first changes from yin to yang, the fourth from yang to yin. The other four stay as they are.',
            'Enter these as manual coin results in Wenbu and check the changing positions before reading the names. This is a worked example of the transformation, not a cast for a real-life question.',
          ],
        },
      ],
    },
  },
  {
    slug: 'tarot-beginner',
    category: 'learn',
    symbol: '象',
    minutes: 5,
    tool: 'tarot',
    sources: [tarot, { title: 'Labyrinthos · Tarot learning and journal', url: 'https://labyrinthos.co/' }],
    zh: {
      title: '第一次读塔罗：从一个好问题开始',
      description: '了解 78 张牌、大小阿尔卡那、正逆位与三张牌阵，用清楚的问题和记录方式开始塔罗练习。',
      sections: [
        {
          heading: '牌组的结构',
          paragraphs: [
            '常见的韦特体系塔罗有 78 张牌：22 张大阿尔卡那，以及权杖、圣杯、宝剑、星币四组各 14 张的小阿尔卡那。小牌各有一至十和四张宫廷牌。',
            '大牌常用来讨论较大的经验主题，小牌可以帮助观察具体情境。这是阅读惯例，不表示抽到大牌就一定会发生重大事件。问卜使用完整牌组，配有原创 AI 插画和简短提示；具体插画不等同于经典韦特原牌图。',
          ],
        },
        {
          heading: '把「会不会」改成「我可以看见什么」',
          paragraphs: [
            '「对方一定喜欢我吗」要求牌面替别人表达未经确认的心意。「我在这段关系中忽略了哪些需求」则把注意力放回可以观察与沟通的地方。',
            '好问题可以有具体背景，但不预先要求肯定答案。比如：我在考虑新工作时，除了薪资还应检查哪些条件？抽牌能提供联想起点，事实核查仍由现实资料完成。',
          ],
        },
        {
          heading: '三张牌，三个观察位置',
          paragraphs: [
            '问卜的三张牌阵分别代表「当下」「牵引」「下一步」。位置为阅读提供结构，不用于宣告过去、现在、未来的确定事件。三张牌从完整牌组中不放回抽取，因此不会重复。',
            '开启逆位时，每张牌独立有一半概率逆位。逆位可作为受阻、内化或失衡的观察角度，不自动等于坏事。关闭逆位同样可以完成有意义的反思。',
          ],
        },
        {
          heading: '先记录，再解释',
          paragraphs: [
            '先写下牌名、位置、正逆位，以及第一眼注意到的词。然后补一句「这让我想到……」和一个你能做的小行动。这样可以看见联想从何而来，而不是把一段流畅的文字当成事实。',
            '保存后隔一段时间再看，同时记录没有对应上的部分。塔罗可以陪伴思考，但不替代与当事人的沟通，也不替代医疗、法律或财务专业建议。',
          ],
        },
        {
          heading: '第一次可以只抽一张',
          paragraphs: [
            '例如用“这周准备一次沟通时，我还需要考虑什么？”作为问题。选一张牌，记下一个联想，再列一个需要向当事人确认的问题。没有联想也没关系，不必硬凑。',
            '想继续学习，可以先看四种花色与宫廷牌，再比较正位与逆位的阅读方式。同一个问题不必连续重抽到满意为止；新的事实或新的问题出现后，再决定是否开始下一次探索。',
          ],
        },
      ],
    },
    en: {
      title: 'Your first tarot reading starts with a better question',
      description:
        'Learn the 78-card structure, reversals and a simple three-card spread, then turn a reading into a useful reflection practice.',
      sections: [
        {
          heading: 'Know the structure of the deck',
          paragraphs: [
            'A common Rider-Waite-Smith-style deck contains 78 cards: 22 Major Arcana and 56 Minor Arcana. The four minor suits are Wands, Cups, Swords and Pentacles. Each has Ace through Ten and four court cards.',
            'Major cards are often read as broader themes, while minor cards invite attention to everyday situations. This convention does not mean a major event is guaranteed. Wenbu uses the full deck with original AI illustrations and short reading prompts. Its artwork is not a reproduction of the historical Rider-Waite-Smith deck.',
          ],
        },
        {
          heading: 'Ask what you can notice, not what must happen',
          paragraphs: [
            '“Does this person definitely love me?” asks cards to reveal someone else’s unconfirmed feelings. “What needs am I overlooking in this relationship?” points toward something you can observe and discuss.',
            'A useful question can include real context without demanding a reassuring answer. When considering a job, for example, ask which conditions beyond salary deserve attention. The cards can start an association; evidence still comes from real information.',
          ],
        },
        {
          heading: 'Three cards, three perspectives',
          paragraphs: [
            'Wenbu’s spread uses Situation, Tension and Next Step. These positions organize reflection rather than claim fixed knowledge of past, present or future events. Cards are drawn without replacement, so a spread cannot contain duplicates.',
            'With reversals enabled, each card independently has a 50 percent chance of appearing reversed. Read reversal as a possible blockage, internal focus or imbalance, not automatically as something bad. A reading without reversals is also a valid reflective practice.',
          ],
        },
        {
          heading: 'Record before elaborating',
          paragraphs: [
            'Write down the card names, positions and orientations before interpreting them. Add “This reminds me of…” and one small action. The distinction makes it easier to see where an association came from.',
            'Return later and record what did not fit as well as what did. Tarot may support reflection, but it cannot replace conversation with the people involved or qualified advice about health, law and money.',
          ],
        },
        {
          heading: 'A first reading can be one card',
          paragraphs: [
            'Try a question such as: “What should I consider before a conversation this week?” Draw one card, note an association, and write one question you still need to ask the person involved. If nothing comes to mind, you do not need to force a connection.',
            'Next, learn the suits and court cards, then compare approaches to reversals. Keep the first result rather than redrawing until you like it. New information or a changed question can give a later session a clearer purpose.',
          ],
        },
      ],
    },
  },
  {
    slug: 'ziwei-twelve-palaces',
    category: 'learn',
    symbol: '星',
    minutes: 6,
    tool: 'ziwei',
    sources: [iztro, { title: 'iztro · palace concepts', url: 'https://iztro.com/learn/palace' }],
    zh: {
      title: '紫微斗数十二宫：怎样读一张星盘',
      description: '从命宫、身宫和十二宫位开始，了解主星、辅星、空宫与流派约定，不把单颗星当成人生结论。',
      sections: [
        {
          heading: '先看结构，再看星名',
          paragraphs: [
            '紫微斗数以出生资料安排十二宫及其星曜。命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母，是常见的宫位名称。名称来自传统分类，并不意味着每一宫都是对现实的事实陈述。',
            '命宫与身宫是阅读时经常关注的位置。主星、辅星和其他标记构成关系网络，所以只看一颗星就概括一个人的性格或遭遇，会丢失大量前提。',
          ],
        },
        {
          heading: '空宫不是「没有」，也不是「不好」',
          paragraphs: [
            '某宫没有主星，称为空宫。传统解读通常会结合对宫及相关宫位参照，而不是直接得出该生活领域缺失或失败的结论。',
            '同样，星名里的「杀」「破」等字属于术语，不是伤害或灾祸的预告。问卜的可视化先展示结构，让你知道解释在引用哪一宫、哪一颗星。',
          ],
        },
        {
          heading: '出生时辰和闰月规则会影响结果',
          paragraphs: [
            '紫微排盘需要明确时辰。问卜不会在时辰未知时随机选一个命盘。输入采用当地民用日期与钟表时间，并明确不自动做真太阳时校正。',
            '当前工具使用 iztro 的默认配置和 fixLeap=true，晚子时与早子时分别处理。不同流派的闰月、四化、换日等规则可能有差异；比较两张盘时，先核对这些设置。',
          ],
        },
        {
          heading: '把宫位转成现实中的观察',
          paragraphs: [
            '例如，看到交友宫时，可以回顾哪些合作关系让沟通顺畅；看到官禄宫时，可以列出工作中真正喜欢与抗拒的任务。这些是你自己的观察，不是星曜证明的事实。',
            '尤其不要用疾厄宫诊断疾病，或用夫妻宫断言他人的忠诚。真实的问题要回到真实的资料、沟通和专业帮助。',
          ],
        },
        {
          heading: '第一次点开哪些地方',
          paragraphs: [
            '先在宫位图中找到命宫，再点一个与你本次问题有关的宫位，分别记录宫名、列出的主星和页面显示的标记。当前页面保留中文宫名和星名，便于与资料逐字核对。',
            '例如研究工作相关术语，可以请 Agent 说明官禄宫的传统含义，再指出这张盘实际列出了哪些星。先完成“认图”，再决定是否讨论它与你现实经历的联系。',
          ],
        },
      ],
    },
    en: {
      title: 'Reading the twelve palaces of Zi Wei Dou Shu',
      description:
        'An introduction to the palace structure, major and supporting stars, empty palaces and the conventions that affect a Zi Wei chart.',
      sections: [
        {
          heading: 'Read the structure before the star names',
          paragraphs: [
            'Zi Wei Dou Shu arranges stars within twelve palaces using birth information. Traditional names organize themes such as self, siblings, partnership, children, resources, health, movement, friendships, work, home, inner life and parents. A palace label is a symbolic category, not a factual statement about that part of your life.',
            'The Life palace and Body palace are common reference points. Major stars, supporting stars and other markers form a network. Isolating one star and using it to define a person leaves out the rest of that network.',
          ],
        },
        {
          heading: 'An empty palace is not an empty life',
          paragraphs: [
            'A palace without a major star is commonly called empty. Traditional readings consider relationships with other palaces; they do not simply conclude that a life area is absent or doomed.',
            'Likewise, dramatic words in star names are technical labels, not forecasts of harm. Wenbu displays the structure first so you can identify which palace or star a reflection refers to.',
          ],
        },
        {
          heading: 'Time and school conventions matter',
          paragraphs: [
            'A known birth time is needed for this tool. Wenbu does not generate a guessed chart when the hour is unknown. It uses the entered local civil date and clock time, without an automatic solar-time correction.',
            'The current engine uses iztro’s default configuration with fixLeap=true and distinguishes early from late Zi. Schools may differ on leap months, transformations and day boundaries. Compare settings before deciding that one chart is simply wrong.',
          ],
        },
        {
          heading: 'Bring the symbolism back to observation',
          paragraphs: [
            'A friendship palace can prompt you to review which collaborations communicate well. A work palace can prompt a list of tasks you enjoy or resist. Those observations belong to you; the stars have not independently verified them.',
            'Do not use a health palace to diagnose illness or a partnership palace to assert another person’s loyalty. Real questions still need real evidence, conversation and qualified support.',
          ],
        },
        {
          heading: 'What to open on your first visit',
          paragraphs: [
            'Find 命宫, the Life Palace, then select one palace relevant to your question. Note its name, listed major stars and visible markers. Wenbu retains the Chinese palace and star names so you can match them directly with references.',
            'For a question about work, ask the Agent to explain the traditional context of 官禄宫, the Career Palace, then identify the stars actually listed. Learn to read the chart’s labels before connecting them to your circumstances.',
          ],
        },
      ],
    },
  },
  {
    slug: 'unknown-birth-time',
    category: 'learn',
    symbol: '未',
    minutes: 4,
    tool: 'bazi',
    sources: [lunar, hko],
    zh: {
      title: '不知道出生时间，还能排八字吗？',
      description: '可以先查看三柱，但要保留边界。了解未知时辰如何影响时柱、五行图和交节日的年、月柱。',
      sections: [
        {
          heading: '保留不知道的部分',
          paragraphs: [
            '如果你知道出生日期，却不知道时刻，可以先排年、月、日三柱。时柱依赖时辰，不能用一个看起来合理的时间填上后，再把它当成自己的完整八字。',
            '问卜的「不确定出生时间」选项会省略时柱。五行可见字总数变为 6，而不是把中午的两个字算进去。',
          ],
        },
        {
          heading: '日期本身也可能靠近边界',
          paragraphs: [
            '如果生日正好是立春或其他交节日，时刻会影响年柱或月柱。工具用中午作临时参照，并把这一不确定性写明；在这些日期上，结果需要结合实际出生时刻重新确认。',
            '换日流派也会影响晚上 23 点附近的日柱。时刻未知时，不宜进一步把某个精确时柱、某个起运时刻或一条细密时间线当成已经确定。',
          ],
        },
        {
          heading: '怎样补充更可靠的信息',
          paragraphs: [
            '可以先查出生证明、医院记录或家人的原始笔记。家庭回忆有时只精确到清晨、上午或夜间，记录这个区间比擅自补成某一分钟更诚实。',
            '用过往事件反推时辰是一种解释实践，容易受到事后归因影响。若尝试不同候选时辰，请保留全部候选和依据，不只保存最让自己认同的一张盘。',
          ],
        },
        {
          heading: '不依赖出生时间的替代入口',
          paragraphs: [
            '如果你的目标是整理眼前的问题，易经问卦和塔罗映照不要求出生资料。它们使用随机符号帮助换一个角度，同样不提供确定的命运预告。',
            '选择能支持当前思考的工具，比填满一张信息不足的表格更重要。',
          ],
        },
        {
          heading: '可以这样告诉 Agent',
          paragraphs: [
            '“我知道公历生日，但只知道出生在上午，具体时刻没有记录。请先保留未知，不要替我选一个时辰；如果某项结论依赖时柱，请单独说明。”这比填入一个看似精确的默认时间更便于后续核对。',
            '下一步先做一次不含时柱的八字排盘，读页面的不确定性提示。若只想谈眼前的选择，也可以直接从对话开始。',
          ],
        },
      ],
    },
    en: {
      title: 'Can you use BaZi without a birth time?',
      description:
        'Yes, with an incomplete chart and explicit uncertainty. Learn what an unknown hour changes and why a guessed noon is not a full birth chart.',
      sections: [
        {
          heading: 'Leave the unknown part unknown',
          paragraphs: [
            'If you know the birth date but not the time, you can begin with year, month and day pillars. The hour pillar depends on the birth hour. A plausible-looking guess does not turn it into known information.',
            'Wenbu’s unknown-time option omits the hour pillar. The visible-element total becomes six rather than eight, so a temporary calculation reference is not disguised as your birth hour.',
          ],
        },
        {
          heading: 'Some dates sit on a boundary',
          paragraphs: [
            'A birth on the beginning-of-spring or another solar-term transition date can have more than one possible year or month pillar. The tool uses noon as a provisional reference and discloses the uncertainty; the actual time is needed to settle a boundary case.',
            'Day-boundary schools also differ around 23:00. Without a known time, do not treat a precise hour pillar or detailed timing sequence as established.',
          ],
        },
        {
          heading: 'Find better information before adding precision',
          paragraphs: [
            'Look for a birth certificate, hospital record or original family note. A recollection such as early morning may define a range, but it does not justify inventing a minute.',
            'Inferring a birth time from past events is an interpretive exercise vulnerable to hindsight. If you compare candidate times, keep the alternatives and the reasons for them instead of saving only the chart that feels most familiar.',
          ],
        },
        {
          heading: 'Choose an approach that needs less personal data',
          paragraphs: [
            'For a present-day question, I Ching and tarot do not require birth information. They use randomly selected symbols to suggest a perspective, without making reliable predictions about destiny.',
            'A tool that supports the question you actually have is more useful than a fully filled form built on uncertain data.',
          ],
        },
        {
          heading: 'Tell the Agent what is known',
          paragraphs: [
            'Try: “I know the Gregorian date and that I was born in the morning, but I have no recorded time. Keep the hour unknown. Please identify anything that would depend on an hour pillar.” This preserves a useful distinction for later checks.',
            'Start with a BaZi chart that omits the hour and read its uncertainty notes. If you only want to discuss a current decision, you can begin with conversation instead.',
          ],
        },
      ],
    },
  },
  {
    slug: 'ai-divination',
    category: 'learn',
    symbol: '辨',
    minutes: 6,
    tool: 'bazi',
    sources: [
      {
        title: 'Carlson (1985) · A double-blind test of astrology',
        url: 'https://www.nature.com/articles/318419a0',
      },
      {
        title: 'Forer (1949) · The fallacy of personal validation',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18110193/',
      },
      {
        title: 'DeepSeek · model update and alias behavior',
        url: 'https://api-docs.deepseek.com/news/news260910/',
      },
      lunar,
    ],
    zh: {
      title: 'AI 算命说得很像我，意味着什么？',
      description:
        '区分算法结果、模型解释与个人联想，识别宽泛描述、确认偏误和伪精确，不把语言流畅当成预测证据。',
      sections: [
        {
          heading: '一句“很像我”的话，能说明多少？',
          paragraphs: [
            '读到一句贴近经历的话，感到被理解，是一种真实的体验。但「这句话让我有共鸣」和「这个系统能预测我的未来」，是两个不同的命题。',
            '宽泛而兼顾两面的描述可能适用于很多人。我们也更容易记住命中的部分，忽略不符合的部分。面对一段顺畅、温柔的 AI 文字，这些倾向不会自动消失。',
          ],
        },
        {
          heading: '分清三层信息',
          paragraphs: [
            '第一层是计算：某日期按什么规则对应哪些干支，或抽到了哪些牌。第二层是传统关联：某符号在特定体系里怎样被理解。第三层是你的联想：这些文字和哪些真实经历产生了联系。',
            '三层都可以讨论，但不能混写成同一种事实。星历或历法精确，并不证明由此延伸的性格、关系和未来预测有效。Carlson 的研究是占星受控检验史中的一个例子，而不是对所有命理流派的一次全面判决。',
          ],
        },
        {
          heading: '一个更可靠的阅读习惯',
          paragraphs: [
            '先看系统能否展示输入、规则、来源与不确定性。再问解读是否包含可核对的依据，是否允许你不同意，是否把选择权留给你。无法反驳的说法，很难作为预测证据。',
          ],
          bullets: [
            '同时记录吻合与不吻合的例子。',
            '区分事实、解释和希望。',
            '不根据恐吓性的预言付款或作重大决定。',
            '涉及真实他人时，优先通过直接沟通了解情况。',
          ],
        },
        {
          heading: '问卜如何使用模型',
          paragraphs: [
            '命盘和随机抽取由程序完成。DeepSeek 接收这份结果，以及你主动填写的问题和背景，再生成明确标注的象征性解读。模型不负责计算日期，也不应凭空引用经典。',
            '页面记录请求模型名与服务返回的实际模型名。流畅的回答仍然可能有解释错误；欢迎通过项目问题页提交具体例子，避免附带他人的私人资料。',
          ],
        },
        {
          heading: '检查一句最有共鸣的话',
          paragraphs: [
            '如果回答说“你重视独立，也渴望被理解”，先想一想这句话能适用于多少人，再找一个具体经历和一个反例。你可以觉得它有帮助，同时不把它视为系统准确识别了你。',
            '下一步请 Agent 把一段回答拆成“实际输入或计算结果”“传统说法”“结合背景的推测”，并标出哪些句子缺少依据。更详细的检查方法见手册中的来源阅读指南。',
          ],
        },
      ],
    },
    en: {
      title: 'Why an AI reading can feel accurate',
      description:
        'Separate calculation, interpretation and personal association, and avoid confusing fluent language with evidence of predictive accuracy.',
      sections: [
        {
          heading: 'Feeling understood and checking a claim',
          paragraphs: [
            'Feeling understood by a sentence is a real experience. It is different from demonstrating that a system can predict future events. A description can be meaningful to you without establishing predictive validity.',
            'Broad statements can fit many people. We also tend to remember matches more readily than misses. Fluent, reassuring AI prose does not remove these ordinary tendencies.',
          ],
        },
        {
          heading: 'Keep three layers separate',
          paragraphs: [
            'The first layer is calculation: which stems and branches follow from a date and convention, or which cards were drawn. The second is a traditional symbolic association. The third is your personal connection between that symbol and an experience.',
            'All three can be discussed, but they are not the same type of evidence. Precise calendar or astronomical data does not validate a personality or future-event prediction. Carlson’s study is one historical example of controlled testing in astrology, not a comprehensive verdict on every tradition.',
          ],
        },
        {
          heading: 'Build a more careful reading habit',
          paragraphs: [
            'Look for visible inputs, conventions, sources and uncertainty. Ask whether a reading identifies its basis, allows disagreement and leaves decisions with you. A claim that cannot be contradicted is difficult to use as predictive evidence.',
          ],
          bullets: [
            'Record misses as well as matches.',
            'Separate what happened, what you infer and what you hope.',
            'Do not pay or make major decisions in response to frightening predictions.',
            'When another person is involved, prefer direct communication to alleged mind-reading.',
          ],
        },
        {
          heading: 'How Wenbu uses a model',
          paragraphs: [
            'Code calculates charts and performs random draws. DeepSeek receives the result with the question and context you choose to submit. It is instructed to use the calculated result and avoid invented classical quotations. Its interpretation and any references still need checking.',
            'The interface records the requested model and the model reported by the service. An articulate answer can still be wrong. Concrete bug reports are welcome, with private information removed.',
          ],
        },
        {
          heading: 'Check the sentence that feels most personal',
          paragraphs: [
            'If an answer says “You value independence but also want to be understood,” consider how many people it could describe. Find a specific example and a counterexample from your experience. A sentence can be useful without demonstrating that the system has identified something uniquely true about you.',
            'Ask the Agent to separate a paragraph into inputs or calculated results, traditional meanings and inferences from your context. Have it identify any unsupported claim. The source-reading guide gives a fuller method.',
          ],
        },
      ],
    },
  },
  {
    slug: 'chinese-zodiac-vs-bazi',
    category: 'learn',
    symbol: '岁',
    minutes: 4,
    tool: 'bazi',
    sources: [hko, lunar],
    zh: {
      title: '生肖与八字：为什么立春和春节不能混用',
      description: '生肖年、农历新年和八字年柱使用不同边界。用一个清楚的例子理解年初出生者常见的排盘差异。',
      sections: [
        {
          heading: '生肖年与八字年柱，先说明用哪条界线',
          paragraphs: [
            '日常生肖常按农历新年理解，而传统八字年柱常以立春交节时刻为界。两者属于不同的约定，并不是把一个年份标签复制到所有场景里。',
            '如果一个人生于公历一月或二月，尤其需要确认问题是在问生肖，还是在计算四柱中的年柱。只根据公历年份做减法，可能忽略真正的边界。',
          ],
        },
        {
          heading: '用 2024 年想一想',
          paragraphs: [
            '以香港时间计，2024 年春节为 2 月 10 日，立春在 2 月 4 日，可对照香港天文台日历。这两个日子之间出生的人，在不同生肖表述与八字年柱规则下，可能看到不同年份标签。',
            '这里最重要的不是争论哪个标签更讨喜，而是显示使用的历法边界。交节当天还需要准确时刻和时区，不能只比较日期。',
          ],
        },
        {
          heading: '八字远不止一个生肖',
          paragraphs: [
            '生肖主要对应年支，而八字还包含年干及月、日、时三柱。日主是日干，不是生肖动物。把某生肖的通用描述直接套到整张八字，会遗漏其他结构。',
            '问卜显示农历日期和四柱，并在计算方法里注明年、月柱的交节规则。讨论民俗生肖与八字年柱时，先说明各自采用的年份界线。',
          ],
        },
        {
          heading: '比较时先写清问题',
          paragraphs: [
            '如果你只问“我属什么”，先说明想采用民俗生肖的春节界线，还是查看八字年柱的立春界线。接近年初的生日可能因此得到不同标签，差异本身不证明某一方把日期算错。',
            '在问卜查看四柱时，以年柱说明为准；不要把按春节划分的民俗生肖直接替代年柱地支。想追问边界，请给出示例日期和时区，并要求保留交节时刻。',
          ],
        },
      ],
    },
    en: {
      title: 'Chinese zodiac and BaZi: which new year counts?',
      description:
        'Understand Lunar New Year, the beginning-of-spring solar term and why births in January or February need a clear year-boundary convention.',
      sections: [
        {
          heading: 'Different questions can use different year boundaries',
          paragraphs: [
            'Everyday Chinese-zodiac descriptions often use Lunar New Year, while BaZi year pillars commonly change at the beginning-of-spring solar term. These are different conventions rather than one year label that can be copied everywhere.',
            'For a January or February birthday, first ask whether you are identifying a zodiac animal or calculating a Four Pillars year pillar. A simple operation on the Gregorian year can miss the relevant boundary.',
          ],
        },
        {
          heading: 'Consider early February 2024',
          paragraphs: [
            'In Hong Kong time, Lunar New Year in 2024 fell on February 10 and the beginning-of-spring term on February 4, as shown in the Hong Kong Observatory calendar. A birth between them may receive different year labels under the two conventions.',
            'The useful response is to show the calendar rule, not to select the label that sounds more appealing. A birth on the transition day also requires the time and time zone, not just the date.',
          ],
        },
        {
          heading: 'A zodiac animal is only one part of a chart',
          paragraphs: [
            'The animal corresponds to the year branch. BaZi also includes the year stem and three more pillars. The Day Master is the day stem, not the zodiac animal. Applying a general animal description to the entire chart omits the rest of its structure.',
            'Wenbu shows the lunar date and four pillars. Its calculation notes explain the solar-term boundaries for the year and month pillars. State the relevant year boundary when comparing a folk-zodiac label with a BaZi year pillar.',
          ],
        },
        {
          heading: 'State which boundary you are comparing',
          paragraphs: [
            'When asking for a zodiac animal, specify whether you mean the Lunar New Year convention or the beginning-of-spring boundary used for the BaZi year pillar. A date near the start of the year can receive different labels without either calendar conversion being wrong.',
            'In Wenbu, follow the year-pillar convention when reading the four pillars. Do not substitute a folk-zodiac label based on Lunar New Year for the BaZi year branch. For a boundary example, provide a sample date and zone and ask for the solar-term instant.',
          ],
        },
      ],
    },
  },
  {
    slug: 'bazi-vs-western-astrology',
    category: 'learn',
    symbol: '观',
    minutes: 5,
    tool: 'bazi',
    sources: [
      lunar,
      {
        title: 'Astrodienst · Swiss Ephemeris documentation',
        url: 'https://www.astro.com/swisseph/swephprg.htm',
      },
    ],
    zh: {
      title: '八字与西方占星：两种地图，不是一套算法',
      description: '比较八字的干支与五行、西方占星的星体与宫位，以及输入、天文计算和解释传统上的差异。',
      sections: [
        {
          heading: '它们分别在计算什么？',
          paragraphs: [
            '八字把出生时刻映射成干支四柱，以五行、阴阳与节气组织符号关系。西方本命占星通常计算出生时刻的星体位置，并结合黄道、相位和宫位阅读。',
            '两者都使用出生信息，但不是同一张地图换一种语言。不能把木直接翻译成某个行星，也不能把日主等同于太阳星座。',
          ],
        },
        {
          heading: '输入差异会影响结果',
          paragraphs: [
            '八字重点核对日期、当地时钟、时区与换日、交节规则；采用太阳时流派时还需要经度。西方宫位与上升点通常需要时间、地理经纬度、时区，以及具体宫制。',
            '问卜目前提供八字、紫微、易经与塔罗工具，不提供完整西方本命盘。学习页面中的比较，不表示产品已实现行星历表或宫位计算。',
          ],
        },
        {
          heading: '精确数据与解释效力是两回事',
          paragraphs: [
            '天文历表可以严谨计算星体位置，历法库可以严谨转换日期。由这些数值延伸出来的性格与事件解释，仍需要单独评价，不能借计算精度为全部解释背书。',
            '比较产品时，优先检查是否明确计算体系、时区与数据来源。单独一句「使用天文数据」不足以证明某段人生预测可靠。',
          ],
        },
        {
          heading: '先选问题，再选工具',
          paragraphs: [
            '如果想学习中国传统时间结构，从四柱开始。如果想理解行星相位，需要真正支持该计算的占星工具。如果只是整理眼前选择，不要求出生资料的反思方式也可能更直接。',
            '不必把多种工具的类似说法当作相互独立的验证。它们可能共享宽泛描述，也可能因为你带入了同一段背景而产生相似文字。',
          ],
        },
        {
          heading: '想比较两种解释，可以先限定一个问题',
          paragraphs: [
            '例如：“请说明两种体系各需要哪些出生资料，哪些结果会受时刻误差影响。”这比把两份完整解读放在一起判断谁更像自己，更容易核对。',
            '问卜目前提供八字、易经、塔罗与紫微工具，不提供西方行星星盘计算。需要行星位置或宫位时，请使用明确列出星历与宫制的相应工具，再分别保留两套计算约定。',
          ],
        },
      ],
    },
    en: {
      title: 'BaZi and Western astrology: what each chart calculates',
      description:
        'Compare stems and branches with planetary charts, including inputs, calculation conventions and the limits of interpreting precise data.',
      sections: [
        {
          heading: 'What does each system calculate?',
          paragraphs: [
            'BaZi maps a birth moment into four stem-branch pairs, organizing relationships through elements, polarity and solar terms. Western natal astrology commonly calculates planetary positions and interprets signs, aspects and houses.',
            'Both use birth information, but one is not a translation of the other. Wood cannot simply be substituted for a planet, and the Day Master is not the same concept as a Sun sign.',
          ],
        },
        {
          heading: 'Inputs and conventions differ',
          paragraphs: [
            'For BaZi, check date, local clock, time zone and day/solar-term boundaries; a solar-time convention also needs longitude. Western house and Ascendant calculations generally require location coordinates, time zone and a chosen house system.',
            'Wenbu currently offers BaZi, Zi Wei, I Ching and tarot. It does not offer a complete Western natal chart. This comparison page does not imply that planetary ephemerides or house calculations are implemented.',
          ],
        },
        {
          heading: 'Precision is not validation of an interpretation',
          paragraphs: [
            'An ephemeris can calculate positions precisely, and a calendar library can convert dates correctly. Personality or event interpretations derived from them need separate evaluation. Calculation precision does not validate every subsequent claim.',
            'When comparing products, look for named systems, time-zone handling and sources. A statement that a product uses astronomical data is not sufficient evidence that its life predictions work.',
          ],
        },
        {
          heading: 'Choose the question before choosing the tool',
          paragraphs: [
            'For a traditional Chinese time structure, begin with the four pillars. For planetary aspects, choose software that actually calculates them. For a present decision, a reflection tool that needs no birth data may be more direct.',
            'Do not treat similar wording across several tools as independent confirmation. They may share broad descriptions or respond similarly to the same personal context.',
          ],
        },
        {
          heading: 'Make a comparison specific enough to check',
          paragraphs: [
            'For example: “What birth details does each system require, and which chart features can change when the recorded time is uncertain?” That is easier to examine than deciding which of two long interpretations sounds more like you.',
            'Wenbu currently offers BaZi, I Ching, tarot and Zi Wei; it does not calculate Western planetary charts. Use a suitable astrology tool that discloses its ephemeris and house system, and keep each system’s conventions with its results.',
          ],
        },
      ],
    },
  },
  {
    slug: 'choose-a-tool',
    updated: '2026-10-05',
    category: 'learn',
    symbol: '问',
    minutes: 4,
    tool: 'iching',
    sources: [lunar, iching, tarot, iztro],
    zh: {
      title: '八字、易经、塔罗、紫微，我该从哪里开始？',
      description: '按你的问题、愿意提供的信息与学习目标选择工具，而不是寻找一个对所有事情都有效的答案。',
      sections: [
        {
          heading: '想认识一套出生符号：八字',
          paragraphs: [
            '如果想了解干支、五行和日主之间的关系，可以从八字入门。需要出生日期，已知时间能补足时柱。好处是结构明确，容易把计算与解释分开。',
            '先准备公历生日和出生地时区；时刻不确定就保留未知。第一次可以打开示例，认出年、月、日、时四柱，再决定是否输入自己的资料。',
          ],
        },
        {
          heading: '有一个当下的问题：易经或塔罗',
          paragraphs: [
            '易经问卦用六条阴阳爻及其变化组织观察；塔罗用牌面主题与牌阵位置提供联想。两者都不需要出生资料，可以从一个具体问题开始。',
            '偏好结构、变化关系和经典脉络，可以先看易经。偏好图像、故事与直观联想，可以尝试塔罗。随机选择的是符号，接下来的思考与行动由你负责。',
          ],
        },
        {
          heading: '愿意深入宫位与星曜：紫微斗数',
          paragraphs: [
            '紫微提供十二宫与星曜的关系图，信息较多，通常需要更长学习时间，也需要明确出生时辰。建议先了解命宫、身宫和空宫，再逐步读宫位之间的联系。',
            '问卜保留中文宫名和星名，方便与资料核对。初次可以先点选两个宫位，配合十二宫入门阅读；若出生时刻仍不确定，可以先用不含时柱的八字，或通过对话整理问题。',
          ],
        },
        {
          heading: '第一次使用，只做一件事',
          paragraphs: [
            '选一种工具，写一个问题，保存一份记录。隔一段时间回看：哪部分有帮助、哪部分不符合、最后采取了什么行动。',
            '问卜让四种工具共用一份手记。可免注册保存在当前浏览器，也可用邮箱登录，把选择的记录保存到账号。',
          ],
        },
        {
          heading: '还是拿不定主意，就从对话开始',
          paragraphs: [
            '如果眼下只是有点困惑，打开 Agent，选择一个贴近当下的示例，或直接写下你想聊的事。示例会开始对话，Agent 会通过选项或补充问题逐步确认背景；不需要先决定工具或填写出生资料。',
            '只想学习术语时，可以直接问“用一个例子解释十神”或“带我认一次上下卦”。先完成这个小目标，再根据兴趣进入对应工具。',
          ],
        },
      ],
    },
    en: {
      title: 'BaZi, I Ching, tarot or Zi Wei: where should you begin?',
      description:
        'Choose a tool by the question you have, the information you want to share and the symbolic system you want to learn.',
      sections: [
        {
          heading: 'To learn stems, branches and elements: BaZi',
          paragraphs: [
            'Begin with BaZi if you want to learn the relationship between stems, branches, elements and the Day Master. A birth date is required, while a known time adds the hour pillar. Its clear structure makes it possible to separate calculation from interpretation.',
            'Prepare a Gregorian birth date and the time zone at the birthplace; leave the hour unknown if necessary. Start with the example chart to recognize the four pillars before deciding whether to enter your own details.',
          ],
        },
        {
          heading: 'For a present question: I Ching or tarot',
          paragraphs: [
            'I Ching organizes a reflection through six yin-yang lines and their changes. Tarot uses card themes and spread positions. Neither needs birth information, so both can begin with a concrete question you have now.',
            'Choose I Ching if you prefer structures and changing relationships. Try tarot if images and narrative associations feel more accessible. Randomness selects the symbols; you remain responsible for what you infer and do.',
          ],
        },
        {
          heading: 'To explore palaces and stars: Zi Wei',
          paragraphs: [
            'Zi Wei Dou Shu offers twelve palaces and their stars. It requires a known birth time and usually takes longer to learn. Begin with the Life and Body palaces and the meaning of an empty palace before reading the relationships between them.',
            'Wenbu keeps palace and star names in Chinese for comparison with source texts. Begin by opening two palaces alongside the introductory guide. If your birth time is unknown, consider BaZi without an hour pillar or start with a conversation.',
          ],
        },
        {
          heading: 'Start with one question and one tool',
          paragraphs: [
            'Choose one tool, write one question and save one entry. Return later to note what helped, what did not fit and which action you took.',
            'Wenbu brings the four tools into a local journal, so you can compare your own reflections without creating an account to keep them.',
          ],
        },
        {
          heading: 'Still unsure? Start with a conversation',
          paragraphs: [
            'Open the Agent and choose a relevant example, or write what is on your mind. Examples start a conversation; the Agent then asks for any missing context through choices or follow-up questions. You do not need to choose a tool or provide birth details first.',
            'For a learning goal, ask directly: “Explain the Ten Gods with one example,” or “Show me how to identify the upper and lower trigrams.” Finish that small task, then decide which tool you want to try.',
          ],
        },
      ],
    },
  },
  {
    slug: 'a-reading-you-can-return-to',
    updated: '2026-10-05',
    category: 'blog',
    symbol: '记',
    minutes: 5,
    tool: 'tarot',
    sources: [{ title: 'Labyrinthos · Tarot app and journal', url: 'https://app.labyrinthos.co/' }],
    zh: {
      title: '一份值得回看的占卜手记，应该写什么？',
      description:
        '用六个简单字段记录问题、符号、理解与后续行动，让占卜成为可回顾的思考，而不是一次性的安慰。',
      sections: [
        {
          heading: '保存结果，还不等于留下思考',
          paragraphs: [
            '一长段解读很容易截图收藏，也很容易再也不看。更值得保存的，往往是当时真实的问题、你注意到的句子，以及后来做了什么。',
            '手记的目标不是积累「说中了」的证据，而是看见自己的理解如何改变。一次没有对应上的阅读，也能留下有用的信息。',
          ],
        },
        {
          heading: '六个足够简单的字段',
          paragraphs: ['不必为每次探索写长文。用几句话把事实和解释分开，就能给未来的自己留下清楚入口。'],
          bullets: [
            '日期与当时的具体问题。',
            '原始结果：牌名与正逆位，或六爻数字与动爻。',
            '计算规则或抽取方法。',
            '第一反应，以及它让你想到的真实经历。',
            '一个可执行的小行动。',
            '回看日期：发生了什么，哪些解释没有对应上。',
          ],
        },
        {
          heading: '保留反例，减少事后改写',
          paragraphs: [
            '人在知道结果后，容易重新解释原先含糊的文字。提前记下自己当时怎样理解，能减少这种事后改写。尤其要保留不相符的细节，而不是只把命中句圈出来。',
            '如果问题涉及另一人，记录自己的感受和已知事实，不替对方写下未经证实的内心活动。',
          ],
        },
        {
          heading: '问卜里的手记怎样工作',
          paragraphs: [
            '选择“保存在此浏览器”可免注册留存；选择“免费保存到账号”后，用邮箱验证码登录即可云端保存。旧的浏览器记录由你选择导入。你可以搜索、补写笔记、移除并撤销，或导出 JSON 备份。',
            '清理浏览器数据会移除尚未保存到账号的本地记录。导出的文件包含个人信息，保存到你信任的位置。需要交给 Agent 时，使用可预览的上下文导出，并重新确认包含哪些信息。',
          ],
        },
        {
          heading: '一条简短的示例手记',
          paragraphs: [
            '问题：是否报名一门周末课程。最初理解：先做小范围尝试。行动：周六试听一节并记录耗时。回看：课程内容有吸引力，但通勤超过预期，先选线上练习。',
            '这条示例留下了决定如何形成的过程，既能保留牌面带来的启发，也能看到现实信息起了什么作用。你可以把这个结构放进笔记，不必等积累很多记录后才开始复盘。',
          ],
        },
      ],
    },
    en: {
      title: 'How to keep a useful reading journal',
      description:
        'A simple journal structure that records questions, symbols, interpretation and later actions without turning every coincidence into confirmation.',
      sections: [
        {
          heading: 'Record what you thought at the time',
          paragraphs: [
            'A long reading is easy to screenshot and forget. What often matters later is the question you actually had, the sentence you noticed and the action you eventually took.',
            'A journal need not become a collection of apparent predictions that came true. Its value can be in showing how your understanding changed, including when a reading did not fit.',
          ],
        },
        {
          heading: 'Six fields are enough',
          paragraphs: [
            'You do not need an essay for every session. A few lines separating events from interpretation give your future self a clearer starting point.',
          ],
          bullets: [
            'Date and a concrete question.',
            'Original result: cards and orientations, or six line values and changing positions.',
            'The calculation or draw convention.',
            'Your initial reaction and the real experience it brought to mind.',
            'One small action you can take.',
            'A later review: what happened and what did not match.',
          ],
        },
        {
          heading: 'Keep counterexamples and the original wording',
          paragraphs: [
            'Once an outcome is known, an ambiguous sentence can seem to have predicted it all along. Recording your initial interpretation helps you notice that hindsight. Keep the details that did not fit, too.',
            'When the question involves another person, record your feelings and the facts you know. Do not turn a symbolic reading into a claim about someone else’s private thoughts.',
          ],
        },
        {
          heading: 'How the Wenbu journal works',
          paragraphs: [
            'Choose Save in this browser to keep a record without an account, or Save to a free account and verify your email to save it to cloud history. Older browser records are imported only when selected. Search, add notes, undo removals or export a JSON backup.',
            'Clearing browser data removes local records that have not been saved to your account. Exports contain personal information and should be stored somewhere you trust. If you want an agent to help, preview the separate context export and choose which birth details to include.',
          ],
        },
        {
          heading: 'A short example entry',
          paragraphs: [
            'Question: should I enroll in a weekend course? Initial interpretation: try a small version first. Action: take a trial lesson on Saturday and note the time involved. Review: the subject appealed to me, but the commute was longer than expected, so I chose online practice for now.',
            'This example records how a decision took shape, including both the initial prompt and the practical information that mattered. You can use the structure in a note today; a useful review does not require a large collection of readings.',
          ],
        },
      ],
    },
  },
  {
    slug: 'why-calculation-comes-first',
    updated: '2026-10-05',
    category: 'blog',
    symbol: '本',
    minutes: 5,
    tool: 'bazi',
    sources: [
      lunar,
      iztro,
      { title: 'DeepSeek · API model update', url: 'https://api-docs.deepseek.com/news/news260910/' },
    ],
    zh: {
      title: '为什么问卜先给你一张盘，再给一段话',
      description:
        '我们如何把排盘算法、传统解释和 AI 对话分开，让一次免费探索留下可查看、可导出、可复核的结果。',
      sections: [
        {
          heading: '一句顺畅的话，容易遮住前面的错误',
          paragraphs: [
            '如果出生时间被错误理解，后面再长、再温柔的解释，也是在讨论另一份输入。设计问卜时，我们把最先要解决的问题放在了解释之前：你输入的资料，究竟怎样变成这张图？',
            '这就是为什么界面先呈现四柱、宫位、原始爻值或实际抽牌结果。你可以停在这里，查看规则、与别的工具核对，也可以把数据交给自己的 Agent。',
          ],
        },
        {
          heading: '让每一层各做一件事',
          paragraphs: [
            '历法计算由固定版本的开源库完成；易经与塔罗用明确的随机过程。可视化只展示实际结果，不根据情绪把图形调整得更好看。',
            'DeepSeek 接收计算结果和用户主动填写的背景，负责组织语言。它的工作是提出一个可供思考的视角，而不是重新编造命盘、估计准确率或替你宣布结局。',
          ],
        },
        {
          heading: 'AI 达到额度后，哪些功能还能用？',
          paragraphs: [
            '排盘、起卦、抽牌和本地手记无需付费。AI 解读有公开的每日请求额度，以及全站总额度。达到额度后，已经完成的图表和记录仍然可用。',
            '这样设计是为了让计算与记录不依赖一次模型请求是否成功。模型超时、服务繁忙或预算用完，都不应让用户失去已经看到的结果。',
          ],
        },
        {
          heading: '由你决定保存和分享什么',
          paragraphs: [
            '保存工具手记、请求 AI 和导出上下文，都由你操作。Agent 会随请求使用本会话最近的消息和你选择的上下文；它不能读取其他应用的聊天，也不会自动把个人问题做成公开链接。',
            '问卜还在持续改进。若发现两种计算结果不一致，最有帮助的反馈是明确的输入范围、规则和差异；提交公开问题时，请使用示例资料或去除私人信息。',
          ],
        },
        {
          heading: '看一个具体例子',
          paragraphs: [
            '同一份八字输入如果只修改换日规则，应该能指出改变了哪一柱；同一副已经抽出的塔罗，追问时应该沿用原结果，而不是悄悄换一组牌。用户能看见这些细节，才有办法判断对话是否还在讨论同一件事。',
            '研究模式也遵循类似原则：先说明实际读到哪些资料，再整理结论。你可以要求修改报告的结构或语气，同时保留经过核对的出处和计算约定。',
          ],
        },
      ],
    },
    en: {
      title: 'Why Wenbu shows a chart before it writes a story',
      description:
        'The product choices behind transparent calculations, optional AI interpretation and portable context in a free reflection tool.',
      sections: [
        {
          heading: 'Fluent prose can hide an earlier mistake',
          paragraphs: [
            'If a birth time was interpreted incorrectly, a long and thoughtful-sounding answer may still be discussing the wrong input. Wenbu starts with an earlier question: how did the information you entered become this chart?',
            'The interface therefore presents pillars, palaces, original line values or actual cards first. You can stop there, inspect the convention, compare another calculator or take the structured data to your own agent.',
          ],
        },
        {
          heading: 'Give each layer a clear job',
          paragraphs: [
            'Pinned open-source libraries handle calendar calculations. Explicit random procedures produce I Ching and tarot draws. Visualizations represent the result rather than altering it to look more reassuring.',
            'DeepSeek receives that calculation and the background you choose to share. Its role is to organize a possible reflection, not reinvent a chart, estimate an accuracy percentage or announce a fixed outcome.',
          ],
        },
        {
          heading: 'What stays available when an AI limit is reached',
          paragraphs: [
            'Charts, casts, draws and the local journal do not require payment. Optional AI readings have published guest or account allowances, network abuse controls and a site-wide budget. When a limit is reached, the existing chart and journal remain usable.',
            'The calculation and record should survive a failed model call. A timeout, busy provider or exhausted daily budget should not remove the result you already have.',
          ],
        },
        {
          heading: 'You decide what to save and share',
          paragraphs: [
            'You choose when to save a tool reading, request AI interpretation or export context. Agent requests include recent messages from the current conversation and the context you select. The Agent cannot read chats in other apps and does not automatically publish personal questions.',
            'The product will continue to improve. If two calculations disagree, a useful report identifies the input range, conventions and exact discrepancy. Use synthetic examples or remove personal information before posting publicly.',
          ],
        },
        {
          heading: 'What this looks like in practice',
          paragraphs: [
            'If you change only a BaZi day-boundary setting, you should be able to identify the affected pillar. If you ask a follow-up about a tarot spread, the conversation should keep the original cards rather than silently drawing again. Visible results let you check that you are still discussing the same material.',
            'Research follows the same principle: identify what was actually read before presenting conclusions. You can ask for a different report structure or tone while preserving the verified sources and calculation conventions.',
          ],
        },
      ],
    },
  },
];
