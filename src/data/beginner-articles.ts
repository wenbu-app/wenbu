import type { Article } from './articles';

const productSource = (path: string, title: string) => ({
  title: `Wenbu · ${title}`,
  url: `https://github.com/wenbu-app/wenbu/blob/main/${path}`,
});
const guidance = productSource('src/lib/agent-guidance.ts', 'guided conversation');
const agent = productSource('worker/agent.ts', 'Agent modes and source handling');
const bazi = productSource('src/lib/bazi.ts', 'BaZi calculation conventions');
const journal = productSource('src/lib/journal.ts', 'local journal and context export');
const waite = {
  title: 'A. E. Waite · The Pictorial Key to the Tarot, Part I',
  url: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_1',
};

export const beginnerArticles: Article[] = [
  {
    slug: 'first-reading',
    updated: '2026-10-05',
    category: 'learn',
    symbol: '始',
    minutes: 4,
    tool: 'agent',
    sources: [guidance, agent, journal],
    zh: {
      title: '第一次用问卜：从一个小问题开始',
      description: '不懂术语，也没有准备出生资料？先用几个选择说清困惑，完成一次能留下实际收获的探索。',
      sections: [
        {
          heading: '先选一件最近在意的事',
          paragraphs: [
            '第一次不必回答“我这一生会怎样”。挑一件范围小、最近需要面对的事就够了，比如准备和朋友谈一次分歧，或者比较继续当前工作与接受新机会。',
            '打开问卜 Agent，选择一句贴近当下的开场白，或直接写自己的问题。点击示例就会开始对话；Agent 会在需要时给出选项或询问背景。还没想好也可以开始，不需要先完成一份问卷。',
          ],
        },
        {
          heading: '不知道用什么，先把问题说出来',
          paragraphs: [
            '普通对话可以先整理问题，不需要出生资料，也不会因为进入对话就自动抽牌。你可以直接写：“请先问我一个容易回答的问题，帮我弄清我在犹豫什么。”',
            '想借图像找一个观察角度，可以选三张塔罗；想学习干支或宫位，再选择八字或紫微。若目的是核对一个概念，选查阅资料。开始之前不必把四种体系都学会。',
          ],
        },
        {
          heading: '补充两句背景，比写很长的自述更有用',
          paragraphs: [
            '例如：“我有一份需要频繁出差的新工作邀请。我喜欢现在的同事，但希望学到更多；我还不知道新团队的工作节奏。”这段话已经交代了选择、在意的条件和缺少的信息。公司名、同事姓名、住址都可以省略。',
            '选择 Agent 给出的回答，或在输入框补充自己的情况。如果回答没有理解你，可以直接纠正：“我最担心的是出差对家庭的影响，请围绕这个重新整理。”',
          ],
        },
        {
          heading: '读完后，带走一件可以做的事',
          paragraphs: [
            '看到图表或报告时，先分清计算结果、传统说法和结合你背景作出的推测。你不需要接受所有解释，也可以追问某一句的依据。',
            '这次的收获可以很小：列出两个待确认的问题、约一次沟通，或查一份出生记录。保留原问题和结果，再补一句“我准备做什么”。游客对话保存在当前浏览器；工具结果需主动保存。可用邮箱登录保存到账号，旧记录由你选择导入，也可分别导出备份。',
          ],
          bullets: [
            '还没有具体问题：从“还没想好”开始。',
            '已经知道要做什么：直接输入问题，不必完成引导。',
            '只想看看图表：使用独立工具页，AI 解读可以稍后再选。',
          ],
        },
      ],
    },
    en: {
      title: 'Your first visit: start with one small question',
      description:
        'You do not need specialist vocabulary or birth details. Use a few choices to find a focus, then leave with something you can act on.',
      sections: [
        {
          heading: 'Choose something on your mind',
          paragraphs: [
            'You do not need to begin with a question about your whole life. Pick something you are facing now: a difficult conversation with a friend, or a choice between your current job and a new role.',
            'Open the Wenbu Agent and choose a relevant conversation starter, or type your own question. Selecting an example starts the conversation immediately. The Agent can then ask for missing context through choices or follow-up questions. You do not need to finish a questionnaire first.',
          ],
        },
        {
          heading: 'If you are unsure, start with Conversation',
          paragraphs: [
            'Conversation helps you frame the question. It needs no birth details and does not automatically draw cards. You can add: “Ask me a few straightforward questions to help me understand why I am hesitating.”',
            'Choose three tarot cards if you would like a visual prompt. Choose BaZi or Zi Wei when you want to explore a birth chart. For a concept or a claim you want to check, choose Sourced research. You do not need to learn every system before beginning.',
          ],
        },
        {
          heading: 'A little context goes a long way',
          paragraphs: [
            'For example: “I have an offer that involves frequent travel. I like my current colleagues but want more room to learn. I do not yet know how the new team works.” That gives the Agent a choice, a priority and a gap in your information. You can leave out names, addresses and the company name.',
            'Choose an answer offered by the Agent, or add your own context in the input box. If the answer misses the point, say so: “My main concern is how travel would affect family life. Please focus on that.”',
          ],
        },
        {
          heading: 'Leave with something you can do',
          paragraphs: [
            'When a chart or report appears, distinguish the calculated result from traditional meanings and suggestions based on your context. You can disagree with an interpretation or ask what supports a particular sentence.',
            'A useful outcome might be two questions to ask, a conversation to arrange or a birth record to check. Keep the original question and add what you plan to do. Guest chats stay in this browser; tool results need a save action. Sign in by email to save to your account, choose which older records to import, or use the separate exports for a backup.',
          ],
          bullets: [
            'No clear question yet? Choose “Not sure yet.”',
            'Already know what you need? Type your question directly.',
            'Only want a chart or a draw? Open a standalone tool and decide about AI interpretation later.',
          ],
        },
      ],
    },
  },
  {
    slug: 'ask-a-better-question',
    category: 'learn',
    symbol: '问',
    minutes: 4,
    tool: 'agent',
    sources: [guidance, agent],
    zh: {
      title: '不会提问也没关系：把困惑说清楚',
      description: '用工作、关系与学习的例子，把一句模糊的“帮我看看”变成有背景、有重点、能继续讨论的问题。',
      sections: [
        {
          heading: '从“发生了什么”说起',
          paragraphs: [
            '不必一开始就写得完整。先说一件已经发生的事，再说你卡在哪里。“最近工作很烦”可以接着补成：“项目经常临时改需求，我不知道该继续配合，还是和负责人谈清边界。”',
            '如果不知道怎么补充，直接告诉 Agent：“我还说不清，请一次问我一个问题，给几个选项，也让我自己补充。”引导是为了帮助你表达，任何选项都可以被你改写。',
          ],
        },
        {
          heading: '一个可以直接套用的句式',
          paragraphs: [
            '“我正在面对【具体情况】；我最在意【条件或顾虑】；目前已知【事实】，还不确定【缺少的信息】；这次希望你帮我【一个任务】。”不需要每一格都填满，真实比完整更重要。',
            '例如：“我准备和室友谈作息差异，最在意晚上能休息。目前知道对方经常晚归，但还没认真聊过。帮我准备一段不指责对方的开场白。”这类问题可以通过对话处理，不必先抽牌。',
          ],
        },
        {
          heading: '换一种问法，回答会更有用',
          paragraphs: ['保留你真正关心的事，把无法确认的结局改成能观察、能核对或能行动的部分。'],
          bullets: [
            '工作：“我一定能成功吗？” → “接受这个机会前，我还需要确认哪些条件？”',
            '关系：“他到底在想什么？” → “哪些是我观察到的行为，哪些只是猜测？我可以怎样开口确认？”',
            '自我认识：“我的命是不是不好？” → “我反复遇到的困难是什么？请结合一个真实例子帮我拆开看。”',
            '学习：“哪个流派最准？” → “这两种方法在哪条计算规则上不同，依据分别是什么？”',
          ],
        },
        {
          heading: '给下一轮对话留一个明确方向',
          paragraphs: [
            '如果你想用塔罗或易经，可以加一句：“请把象征当作观察角度，同时列出还需要现实核对的事。”想研究资料，则补充具体概念、你已看过的说法，以及希望比较的范围。',
            '收到回答后，选其中一处继续：“第二点最接近我的困惑，请给一个例子。”或“这条建议不符合我的预算，请按每周两小时重新考虑。”这样比反复发送“再详细一点”更容易推进。现在可以先写下自己的第一句，不用等到问题完美。',
          ],
        },
      ],
    },
    en: {
      title: 'How to turn a vague worry into a useful question',
      description:
        'Examples for work, relationships and learning, plus a simple way to give the Agent enough context without writing your life story.',
      sections: [
        {
          heading: 'Start with what happened',
          paragraphs: [
            'Your first message does not need to be polished. Describe an event, then where you feel stuck. “Work has been frustrating” might become: “Requirements keep changing at short notice. I am unsure whether to keep adapting or discuss boundaries with the project lead.”',
            'If finding the words is difficult, ask: “Help me narrow this down. Ask one question at a time, with a few options and space for my own answer.” The choices are suggestions you can change, not a test you have to pass.',
          ],
        },
        {
          heading: 'Try this starting point',
          paragraphs: [
            '“I am dealing with [situation]. What matters most is [priority or concern]. I know [fact], but I am unsure about [missing information]. Please help me [one task].” Fill in only the parts you know.',
            'For example: “I want to talk to my housemate about our different schedules. I need more quiet at night. They often come home late, but we have not discussed it properly. Help me find an opening that does not sound accusatory.” A conversation can help with this directly; you do not need a card draw first.',
          ],
        },
        {
          heading: 'Keep the concern; make the question answerable',
          paragraphs: [
            'Focus on something you can observe, check or act on, while keeping the issue that matters to you.',
          ],
          bullets: [
            'Work: “Will I definitely succeed?” → “What do I need to find out before accepting this opportunity?”',
            'Relationships: “What are they really thinking?” → “What have I observed, what am I assuming, and how could I ask?”',
            'Self-reflection: “Am I just unlucky?” → “Help me examine a recurring difficulty using a recent example.”',
            'Learning: “Which school is most accurate?” → “Which calculation rules differ, and what sources describe them?”',
          ],
        },
        {
          heading: 'Give the next reply a clear direction',
          paragraphs: [
            'If you want to use tarot or I Ching, add: “Use the symbols as prompts, and keep track of what I still need to check in real life.” For research, name the concept, the claim you have encountered and the comparison you want.',
            'Then follow up on a specific point: “Your second point is closest to my concern. Can you give an example?” Or: “That suggestion is beyond my budget. What could I try in two hours a week?” You can start with one sentence now and refine it through the conversation.',
          ],
        },
      ],
    },
  },
  {
    slug: 'prepare-birth-details',
    category: 'learn',
    symbol: '备',
    minutes: 5,
    tool: 'bazi',
    sources: [
      bazi,
      productSource('src/lib/ziwei.ts', 'Zi Wei input and clock conventions'),
      {
        title: 'Hong Kong Observatory · calendar conversion tables',
        url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm',
      },
    ],
    zh: {
      title: '排盘前准备什么？一张出生资料清单',
      description: '分清公历与农历、出生地时间与当前时区，知道哪些资料必填，哪些不确定就应该留空。',
      sections: [
        {
          heading: '先确认生日是哪一种历法',
          paragraphs: [
            '问卜的八字和紫微工具接收公历日期。家里说的“五月初五”通常是农历说法，不能直接写成公历 5 月 5 日。先核实年份、日期属于公历还是农历，以及是否为闰月，再用可靠的历法资料换算。',
            '只知道生肖或大致年龄，还不足以排出个人命盘。练习时可以使用页面的示例资料，但请把它当作演示，不要保存成自己的出生记录。',
          ],
        },
        {
          heading: '按工具准备必需的信息',
          paragraphs: ['八字和紫微对资料的要求不同。先选好工具，再填与这次计算有关的内容。'],
          bullets: [
            '八字：公历日期、出生地使用的时区；知道出生时刻就填，不知道可勾选“不确定出生时间”。',
            '八字可选项：换日规则；只有开启近似真太阳时校正时才需要经度和已知时刻。',
            '紫微：公历日期、已知当地出生时刻，以及当前传统算法要求的男/女性别参数。这个参数不用于定义你的性别认同。',
            '易经与塔罗：无需出生日期、姓名或性别；可以从眼前的问题开始。',
          ],
        },
        {
          heading: '填写出生地当时的钟表时间',
          paragraphs: [
            '假设出生记录写着上海上午 8:30，而你现在住在伦敦。八字输入仍然是出生记录上的当地时间，并选择 Asia/Shanghai，不能改用手机现在所在的时区。历史夏令时也要按出生当天处理。',
            '紫微入口使用输入的当地日期与钟表时间，不套用八字的时区或真太阳时设置。若拿两种工具做比较，请先读各自结果中的计算约定。不要假设所有命盘共享同一套时间规则。',
          ],
        },
        {
          heading: '把“不确定”也作为资料的一部分',
          paragraphs: [
            '“家人记得在清晨”与“出生证明写 06:20”是不同精度的信息。可以先去查出生证明、医院记录或原始笔记。八字时刻未知时会省略时柱，并提示交节日附近的年、月柱仍可能需要确认；紫微目前需要已知时刻，不能把默认时间当成已经确定。',
            '接近 23 点、零点、时辰或节气边界时，保留候选输入和差异，不要只留下最符合期待的一盘。下一步先核对日期与时区；普通入门不必为了填满表格而开启所有高级选项。',
          ],
        },
      ],
    },
    en: {
      title: 'What to prepare before creating a birth chart',
      description:
        'Check the calendar, birth time and location before you begin, and know which details can remain unknown.',
      sections: [
        {
          heading: 'Check which calendar the date uses',
          paragraphs: [
            'Wenbu’s BaZi and Zi Wei tools accept Gregorian dates. A birthday remembered as the fifth day of the fifth lunar month is not necessarily May 5. Confirm the year, calendar and whether a leap lunar month is involved before converting it with a reliable calendar reference.',
            'A zodiac animal or an approximate age is not enough to produce a personal chart. You can use the example details to learn the interface, but keep that demonstration separate from your own birth record.',
          ],
        },
        {
          heading: 'Bring the details your chosen tool needs',
          paragraphs: [
            'BaZi and Zi Wei have different input requirements. Choose the tool first, then prepare the relevant details.',
          ],
          bullets: [
            'BaZi: Gregorian date and the time zone at the birthplace. Add the birth time if known; otherwise use the unknown-time option.',
            'Optional BaZi settings: the day boundary, and approximate solar-time correction. Solar correction requires a longitude and a known time.',
            'Zi Wei: Gregorian date, known local birth time and the male/female parameter required by the current traditional algorithm. This setting does not define your gender identity.',
            'I Ching and tarot: no birth date, name or sex parameter is needed. Begin with the question you have now.',
          ],
        },
        {
          heading: 'Use the clock time recorded at the birthplace',
          paragraphs: [
            'Suppose your birth record says 08:30 in Shanghai and you now live in London. For BaZi, enter that recorded local time with Asia/Shanghai, rather than your device’s current time zone. Historical daylight-saving rules depend on the birth date.',
            'The Zi Wei tool uses the local date and clock time you enter. It does not inherit the BaZi time-zone or solar-time settings. Check each result’s calculation notes before comparing charts across tools.',
          ],
        },
        {
          heading: 'Record uncertainty instead of filling the gap',
          paragraphs: [
            '“My family remembers early morning” and “the birth certificate says 06:20” provide different levels of detail. Look for a certificate, hospital record or original note. BaZi can omit an unknown hour, with a warning that solar-term boundary dates may still leave a year or month pillar uncertain. Zi Wei currently needs a known time.',
            'Near 23:00, midnight, an hour boundary or a solar term, keep the possible inputs and the differences between them. Do not select a chart solely because its interpretation feels familiar. Start by confirming the date and time zone; you do not need every advanced setting for a first visit.',
          ],
        },
      ],
    },
  },
  {
    slug: 'read-ai-with-sources',
    category: 'learn',
    symbol: '证',
    minutes: 5,
    tool: 'agent',
    sources: [agent, productSource('worker/agent-library.ts', 'research catalogue and read limits')],
    zh: {
      title: '怎样读一份 AI 解读：看结果，也看依据',
      description: '看懂计算、传统解释、个人联想与资料引用的区别，知道该追问什么，以及哪些结论仍需核对。',
      sections: [
        {
          heading: '先找出这句话属于哪一层',
          paragraphs: [
            '“这次抽到三张不同的牌”是可核对的抽取结果；“某张牌常被用于讨论等待”是解释传统；“你可能在等待别人许可”则是结合背景作出的推测。三句话的依据不同，不能因为它们出现在同一份报告里，就拥有同样的确定性。',
            '读命盘也是如此：干支、爻值和宫位先看输入与规则；涉及性格、关系或未来的句子，再看解释从哪里来、有没有超出资料。图表算得清楚，并不能替后面的推测作保证。',
          ],
        },
        {
          heading: '有链接，还要看链接支持了什么',
          paragraphs: [
            '点击来源，确认标题、章节和原文是否真的讨论了那条结论。计算库文档可以说明算法约定；传统著作可以说明某个象征如何被使用；它们都不能单凭存在就证明对个人未来的预测。',
            '“我读了来源摘要”“我读了网页中的一段”和“我读完一本书”也不是一回事。需要更细的核对时，可以让 Agent 把结论和对应依据分别列出，并把无法打开或尚未核实的资料写清楚。',
          ],
        },
        {
          heading: '问卜的资料研究覆盖到哪里',
          paragraphs: [
            '研究模式可搜索问卜的原创手册、牌与卦的说明，以及精选参考目录；对于目录中的外部网页，会尝试读取公开片段。它不是任意网址浏览器，也不等于已经搜索全网。',
            '网络阻拦、页面格式或读取长度可能限制结果。来源读取失败时，完整的回答应保留这个缺口，不能把“找到标题”写成“已读全文”。如果问题超出目录范围，可以请它说明目前能确认的部分和还需要哪类资料。',
          ],
        },
        {
          heading: '用一个具体追问检查回答',
          paragraphs: [
            '例如报告说“真太阳时会改变所有四柱”，可以追问：“请按问卜当前实现分别说明年、月、日、时的判断方式，给出计算依据，不要泛化到所有流派。”问题范围越清楚，越容易发现哪一步混淆了规则。',
            '保存前，选一条你最在意的结论核对。找不到依据时，可以把它标为待确认；不需要为了让报告看起来完整而接受一个说得很肯定的答案。',
          ],
          bullets: [
            '“这句话是计算结果、传统说法，还是你结合背景的推测？”',
            '“请指出直接支持这一点的来源；来源没有说到的部分请单独标注。”',
            '“如果我的这项背景不成立，结论会怎样变化？”',
          ],
        },
      ],
    },
    en: {
      title: 'How to read an AI interpretation and check its sources',
      description:
        'Separate a calculated result from a traditional meaning and a personal inference, then check what the cited sources actually support.',
      sections: [
        {
          heading: 'Identify what kind of claim you are reading',
          paragraphs: [
            '“Three different cards were drawn” is a result you can check. “This card is often associated with waiting” describes an interpretive tradition. “You may be waiting for someone’s permission” is an inference about your situation. Appearing in one report does not give these claims the same status.',
            'For a birth chart, check the inputs and conventions behind the stems, branches and palaces first. Then examine where statements about personality, relationships or future events come from. A reproducible calculation does not validate every interpretation attached to it.',
          ],
        },
        {
          heading: 'A citation should support the particular claim',
          paragraphs: [
            'Open the source and check whether its relevant section addresses the statement. Software documentation can explain an algorithm. A traditional text can document a symbolic association. Neither establishes a prediction about your future simply by being cited.',
            'Reading a search summary, reading an excerpt and reading a whole book are different things. Ask the Agent to match conclusions to their supporting passages and identify any source it could not open or verify.',
          ],
        },
        {
          heading: 'Know the scope of Wenbu research',
          paragraphs: [
            'Research mode searches Wenbu’s guides, card and hexagram notes, and a curated reference catalogue. It can attempt to read public excerpts from external pages in that catalogue. It does not browse arbitrary URLs or search the entire web.',
            'Access restrictions, page formats and reading limits can leave gaps. Finding a title is not the same as reading the text. A useful report should say what remains unchecked. If your question is outside the catalogue, ask what can currently be established and what additional source would be needed.',
          ],
        },
        {
          heading: 'Check one claim that matters to you',
          paragraphs: [
            'Suppose a report says solar-time correction changes all four BaZi pillars. Ask: “For Wenbu’s current implementation, explain separately how the year, month, day and hour are determined. Show the calculation basis and do not generalize to every school.” This gives the reply a specific rule to verify.',
            'Before saving a report, choose one important conclusion and check its basis. If the support is missing, mark it as unresolved. A confident sentence is not a reason to close the question.',
          ],
          bullets: [
            '“Is this a calculated result, a traditional interpretation or an inference from my context?”',
            '“Which source directly supports this point? Separate anything the source does not establish.”',
            '“How would the conclusion change if this detail about my situation were wrong?”',
          ],
        },
      ],
    },
  },
  {
    slug: 'review-a-reading',
    updated: '2026-10-05',
    category: 'learn',
    symbol: '记',
    minutes: 4,
    tool: 'journal',
    sources: [journal, productSource('src/components/Journal.tsx', 'journal actions')],
    zh: {
      title: '读完以后做什么：一次简单的复盘练习',
      description: '用一个完整例子，把牌面或命盘留下的联想变成小行动，再记录后来发生的事。',
      sections: [
        {
          heading: '先把原来的问题留住',
          paragraphs: [
            '假设这次的问题是“是否报名一门课程”。读完后先保存原始结果，记下日期，以及你当时最在意的是学费、时间，还是担心坚持不下来。不要只保存一句让你高兴的解读。',
            '独立工具的结果保存到手记后可以补写笔记；Agent 的对话与报告在会话列表中回看。两处记录的入口不同，都支持浏览器留存、可选账号云端保存和导出。',
          ],
        },
        {
          heading: '把联想改写成一个小行动',
          paragraphs: [
            '比如牌面让你想到“先练习，再承诺”。你可以写：“周六先做一节免费试听，记录实际花费的时间，再决定要不要报名。”这句话能安排进日程，也能在事后核对。',
            '如果一段话只说“相信自己”或“顺其自然”，可以继续问：“在我的条件下，这周能做的一件具体小事是什么？”具体行动应当符合你的预算、时间和责任。',
          ],
        },
        {
          heading: '回看时，把发生的事与原先解释分开',
          paragraphs: [
            '到了自己约定的日期，再读原问题。假设试听比预期花费更多时间，你最后没有报名：值得记录的是新的时间信息怎样影响了决定，而不是把所有结果都解释成牌已经预告。',
            '也可以诚实写：“这次解读没提供新的线索。”没有帮助的记录同样值得保留。复盘不是给每一次探索找一个正确结局。',
          ],
          bullets: [
            '当时理解：我把哪句话理解成了什么？',
            '采取的行动：我实际做了什么，哪些没有做？',
            '新增事实：后来知道了什么，原先哪些判断不成立？',
            '接下来：保持、调整还是停止这件事？',
          ],
        },
        {
          heading: '保留一份你能找回的记录',
          paragraphs: [
            '游客手记只在当前浏览器。需要换设备继续时，可用邮箱登录保存到账号；旧记录不会默认上传，由你选择导入。清理网站数据会移除尚未上传的本地记录。重要内容仍建议导出 JSON 备份。',
            '导出文件也可能包含出生资料和私人问题。分享给别人之前先查看内容；交给 Agent 时，只选与当前问题有关的上下文。现在可以给最近一条记录补上“下一步”和一个回看日期。',
          ],
        },
      ],
    },
    en: {
      title: 'After the reading: a simple way to reflect and follow up',
      description:
        'Turn an association into a small action, then return to record what happened without rewriting your original interpretation.',
      sections: [
        {
          heading: 'Keep the question you actually asked',
          paragraphs: [
            'Suppose you asked whether to enroll in a course. Save the original result and note what concerned you at the time: the fee, the time commitment or whether you would keep going. Keep more than the sentence you found reassuring.',
            'Save standalone tool results to the journal to add notes; find Agent conversations and reports in the conversation list. Both support browser storage, optional account history and separate exports.',
          ],
        },
        {
          heading: 'Turn an association into something you can try',
          paragraphs: [
            'Perhaps the reading suggests trying a routine before making a commitment. You could write: “On Saturday I will try a free lesson, note how long it takes and then reconsider the course.” That is something you can schedule and check later.',
            'If the advice is only “trust yourself” or “go with the flow,” ask for one specific action that fits your circumstances this week. The action should respect your time, budget and existing commitments.',
          ],
        },
        {
          heading: 'Compare what happened with what you expected',
          paragraphs: [
            'On your chosen review date, read the original question. Perhaps the trial lesson took longer than expected and you decided not to enroll. Record how that new information shaped your decision, rather than treating either outcome as something the cards had predicted.',
            'It is also fine to write: “This reading did not give me a useful lead.” Keeping an unhelpful reading is part of an honest record. You do not need to find a successful ending for every session.',
          ],
          bullets: [
            'Initial interpretation: what did I think the reading meant?',
            'Action: what did I actually do, and what did I leave undone?',
            'New information: what did I learn, and which assumptions were wrong?',
            'Next decision: continue, adjust or stop?',
          ],
        },
        {
          heading: 'Keep a copy you can find again',
          paragraphs: [
            'Guest journal entries stay in the current browser. Sign in by email to save to your account and continue elsewhere. Older records are uploaded only when selected. Clearing site data removes browser records that have not been saved to your account. Export important entries as a backup.',
            'An export may contain birth details and private questions. Read it before sharing it. When bringing context into an Agent conversation, select only what is relevant. To begin, add a next action and a review date to one recent entry.',
          ],
        },
      ],
    },
  },
  {
    slug: 'bazi-ten-gods',
    category: 'learn',
    symbol: '十',
    minutes: 6,
    tool: 'bazi',
    sources: [
      bazi,
      {
        title: 'lunar-typescript · Ten Gods mapping',
        url: 'https://github.com/6tail/lunar-typescript/blob/master/src/lib/LunarUtil.ts',
      },
    ],
    zh: {
      title: '十神是什么？用甲木日主读懂十种关系',
      description: '从日主、五行生克与阴阳同异入手，分清比劫、食伤、财、官杀、印的名称与计算含义。',
      sections: [
        {
          heading: '“神”在这里是关系名称',
          paragraphs: [
            '十神是八字中给天干关系命名的一套规则。以日主为参照，先判断另一干与它是同类、我生、我克、克我还是生我，再看两者阴阳是否相同，得到十种名称。这里的“我”指日主，不是在给现实中的你定性。',
            '比如甲是阳木，乙是阴木。以甲为日主，另一个甲是比肩，乙是劫财。名称听上去不同，第一步只是在区分同一五行中的阴阳关系。',
          ],
        },
        {
          heading: '以甲木为例，把十个名称对上',
          paragraphs: ['下面的“同、异”都指对方与甲的阴阳是否相同；换了日主，必须重新比较。'],
          bullets: [
            '同我者为比劫：甲为比肩，乙为劫财。',
            '我生者为食伤：木生火，丙为食神，丁为伤官。',
            '我克者为财：木克土，戊为偏财，己为正财。',
            '克我者为官杀：金克木，庚为七杀，辛为正官。',
            '生我者为印：水生木，壬为偏印，癸为正印。',
          ],
        },
        {
          heading: '传统名称不能直接换成生活结论',
          paragraphs: [
            '“正财”不表示工资一定高，“伤官”不说明会伤害谁，“七杀”也不是一条灾祸通知。这些名称在传统解释中有更多延伸，但关系分类本身没有告诉我们收入、品格或某件事发生的概率。',
            '讨论十神时还会涉及月令、藏干、位置和组合等条件；不同解释体系的取法不完全一致。仅凭出现了哪一个词，就给整张命盘打分，会跳过大量前提。',
          ],
        },
        {
          heading: '在问卜里怎样练习',
          paragraphs: [
            '先在四柱中找到日主，再挑一个可见天干。按五行关系与阴阳算一次，和页面标注核对。地支旁的藏干是另一层信息，不能把整支当作只对应一个十神。当前五行图统计的是可见干支数量，不是十神强弱评分。英文界面使用简短的反思标签，例如正官标为 Responsibility，七杀标为 Challenge；这些词不等同于所有资料采用的术语译名。',
            '练习题：甲日主遇到辛，金克木且阴阳不同，对应正官；乙日主遇到同一个辛，阴阳相同，则对应七杀。若想继续讨论含义，可以请 Agent 先解释计算关系，再列出传统解读所需要的其他条件。',
          ],
        },
      ],
    },
    en: {
      title: 'The Ten Gods in BaZi: a worked example with Jia Wood',
      description:
        'Learn how element relationships and yin-yang polarity produce the Ten Gods, and why names such as Wealth and Seven Killings need context.',
      sections: [
        {
          heading: 'These are relationship labels',
          paragraphs: [
            'The Ten Gods classify the relationship between a heavenly stem and the Day Master. First identify the element relationship: the same element, what it produces, what it controls, what controls it, or what produces it. Matching or differing yin-yang polarity divides those five groups into ten.',
            'For example, Jia is yang Wood and Yi is yin Wood. With Jia as the Day Master, another Jia is 比肩 (Peer), while Yi is 劫财 (Rob Wealth). English translations vary, so the Chinese terms help when comparing references.',
          ],
        },
        {
          heading: 'Work through a Jia Wood example',
          paragraphs: [
            'Each pair below compares the other stem with Jia. Recalculate the relationship when the Day Master changes.',
          ],
          bullets: [
            'Same element: Jia is 比肩 (Peer); Yi is 劫财 (Rob Wealth).',
            'Wood produces Fire: Bing is 食神 (Eating God); Ding is 伤官 (Hurting Officer).',
            'Wood controls Earth: Wu is 偏财 (Indirect Wealth); Ji is 正财 (Direct Wealth).',
            'Metal controls Wood: Geng is 七杀 (Seven Killings); Xin is 正官 (Direct Officer).',
            'Water produces Wood: Ren is 偏印 (Indirect Resource); Gui is 正印 (Direct Resource).',
          ],
        },
        {
          heading: 'A traditional name is not a literal outcome',
          paragraphs: [
            'Direct Wealth does not guarantee a high salary. Hurting Officer does not accuse someone of harmful behavior, and Seven Killings is not a prediction of disaster. These are inherited category names with further traditional interpretations, not measured probabilities or judgments of character.',
            'A fuller reading may consider season, hidden stems, positions and combinations. Interpretive schools do not all treat those factors in the same way. Rating a whole chart from one label skips the assumptions that the interpretation depends on.',
          ],
        },
        {
          heading: 'Try checking one relationship yourself',
          paragraphs: [
            'Find the Day Master, choose another visible stem, and work out its element relationship and polarity. Wenbu’s English chart uses short reflection labels: Responsibility corresponds to 正官 (Direct Officer), and Challenge to 七杀 (Seven Killings). These differ from the traditional English names above. A branch can contain several hidden stems; the element diagram counts visible characters rather than scoring the Ten Gods.',
            'For practice, compare Xin with Jia: Metal controls Wood and the polarities differ, giving Direct Officer. Compare the same Xin with Yi and the polarities match, giving Seven Killings. To go further, ask the Agent to explain the calculation first, then the additional assumptions behind an interpretation.',
          ],
        },
      ],
    },
  },
  {
    slug: 'iching-trigrams',
    category: 'learn',
    symbol: '卦',
    minutes: 5,
    tool: 'iching',
    sources: [
      { title: '《易传·说卦》 / Shuo Gua', url: 'https://zh.wikisource.org/wiki/易傳/說卦' },
      productSource('src/lib/iching.ts', 'hexagram construction'),
      productSource('src/data/hexagrams.ts', 'trigrams and King Wen sequence'),
    ],
    zh: {
      title: '八卦与六十四卦：先认上下，再读变化',
      description: '认识乾坤震巽坎离艮兑，用水火既济与火水未济的例子，读懂上卦、下卦、卦序和爻位。',
      sections: [
        {
          heading: '三条爻组成经卦，六条爻组成重卦',
          paragraphs: [
            '每条爻有阴、阳两种基本线形，三条爻一共有八种组合，称为八卦。把一个三爻卦放在下面，再把一个放在上面，就得到六爻卦；八乘八，共六十四种。',
            '六爻的下三爻叫下卦或内卦，上三爻叫上卦或外卦。记录爻位时从下向上数：初爻、二爻、三爻、四爻、五爻、上爻。页面最上方那条，是第六条而不是第一条。',
          ],
        },
        {
          heading: '先认识八个名称和基本卦象',
          paragraphs: [
            '《说卦》用自然意象说明卦象之间的关联。下面这些词有助于认图，不是看到一个卦就能直接推断现实事件的规则。',
          ],
          bullets: [
            '乾 ☰：天；坤 ☷：地。',
            '震 ☳：雷；巽 ☴：风。',
            '坎 ☵：水；离 ☲：火。',
            '艮 ☶：山；兑 ☱：泽。',
          ],
        },
        {
          heading: '上下交换，卦就不同',
          paragraphs: [
            '水在上、火在下，是水火既济，文王卦序第 63 卦；火在上、水在下，则是火水未济，第 64 卦。组成它们的两个经卦相同，位置不同，不能当作同一卦。中文“水火既济”通常先说上卦，再说下卦。',
            '文王卦序是排列次序，不是吉凶排名。第 1 卦并不代表最高分，第 64 卦也不表示最差。卦名的古今含义、卦辞与具体爻辞，需要分别阅读。',
          ],
        },
        {
          heading: '把结构核对和文字解释分开',
          paragraphs: [
            '起卦之后，先找下三爻和上三爻，核对卦名，再看有哪些动爻。只有动爻会翻转为另一种线形，形成之卦。之卦是规则转换的结果，不等于已经确定的未来。',
            '入门可以手工录入从下到上 7、8、7、8、7、8：下卦离、上卦坎，得到既济，且没有动爻。然后仅把最下方的 7 改为 9，观察之卦如何变化。问卜的简短提示是原创反思文字；想读经典时，请要求具体篇章与出处。',
          ],
        },
      ],
    },
    en: {
      title: 'Trigrams and hexagrams: read the structure first',
      description:
        'Learn the eight trigrams, bottom-to-top line order and the difference between upper and lower trigrams with a simple worked example.',
      sections: [
        {
          heading: 'Three lines form a trigram; six form a hexagram',
          paragraphs: [
            'Each line has a yin or yang form, so three lines have eight possible combinations: the eight trigrams. Placing one trigram above another gives eight times eight, or 64 hexagrams.',
            'Lines one to three form the lower trigram; lines four to six form the upper trigram. Count from the bottom. The first line is at the foot of the figure and the sixth is at the top.',
          ],
        },
        {
          heading: 'Learn the names and their basic images',
          paragraphs: [
            'The Shuo Gua associates the trigrams with natural images. These help you recognize a figure; they are not rules for inferring a real event from a symbol.',
          ],
          bullets: [
            'Qian 乾 ☰: Heaven; Kun 坤 ☷: Earth.',
            'Zhen 震 ☳: Thunder; Xun 巽 ☴: Wind.',
            'Kan 坎 ☵: Water; Li 离 ☲: Fire.',
            'Gen 艮 ☶: Mountain; Dui 兑 ☱: Lake.',
          ],
        },
        {
          heading: 'Changing the order changes the hexagram',
          paragraphs: [
            'Water above Fire is Ji Ji 既济, number 63 in the King Wen sequence, commonly translated as After Completion. Fire above Water is Wei Ji 未济, number 64, Before Completion. The same two trigrams in different positions produce different hexagrams.',
            'In Chinese compound descriptions, the upper trigram is usually named first: 水火既济 means Water over Fire. King Wen numbers identify a sequence, not a ranking of good and bad outcomes. Read the name, hexagram text and individual line texts as distinct parts of the material.',
          ],
        },
        {
          heading: 'Check the figure before interpreting it',
          paragraphs: [
            'After a cast, identify the lower and upper trigrams, then find the changing lines. Only those lines flip to create the resulting hexagram. That second figure follows a clear transformation rule; it is not a confirmed account of the future.',
            'Try entering 7, 8, 7, 8, 7, 8 from bottom to top. The result is Fire below Water, Ji Ji, with no changing lines. Then change only the first 7 to 9 and observe the resulting hexagram. Wenbu’s short themes are original reflection prompts; ask for a named passage and source when you want to study the classical text.',
          ],
        },
      ],
    },
  },
  {
    slug: 'tarot-suits-and-court-cards',
    category: 'learn',
    symbol: '牌',
    minutes: 5,
    tool: 'tarot',
    sources: [waite, productSource('src/data/tarot.ts', 'card names and original prompts')],
    zh: {
      title: '塔罗四种花色与宫廷牌，怎样记才不乱？',
      description: '认识权杖、圣杯、宝剑、星币和侍从到国王，用一个项目例子练习读牌，避免死背孤立关键词。',
      sections: [
        {
          heading: '先记牌组结构，再学具体牌义',
          paragraphs: [
            '常见的韦特体系塔罗有 22 张大阿尔卡那和 56 张小阿尔卡那。小牌分成四种花色，每组都有 Ace（通常写作王牌或一）到十，以及侍从、骑士、王后、国王四张宫廷牌。',
            '花色给你一个起点，具体牌面、牌阵位置和问题会继续缩小范围。看到“圣杯”就直接断言恋爱，或看到“星币”就只谈收入，都会漏掉其他可能的观察角度。',
          ],
        },
        {
          heading: '用四个观察角度认识花色',
          paragraphs: ['下面是问卜用于入门的现代反思提纲。它帮助你提问，不是所有历史牌义的完整归纳。'],
          bullets: [
            '权杖 Wands：行动、意愿与投入。这个项目为什么值得开始？我能持续投入多少？',
            '圣杯 Cups：感受、关系与回应。谁的需要还没有被听见？我对合作有什么期待？',
            '宝剑 Swords：想法、判断与沟通。哪些事实已经确认？分歧究竟在哪里？',
            '星币 Pentacles：资源、实践与日常。时间、技能和预算能不能支持计划？',
          ],
        },
        {
          heading: '宫廷牌可以先读作做事姿态',
          paragraphs: [
            '宫廷牌不一定指某个具体人物，也不要求按牌名把人分成固定年龄或性别。初学时，可以暂把侍从当作学习与试探的姿态，骑士当作推进与行动，王后当作照料与内在掌握，国王当作组织与承担。这个提纲需要结合花色与实际牌面再看。',
            '例如抽到星币侍从，可以试着问“这个计划最值得先练哪项基础技能？”不必据此认定身边一定会出现一个年轻人。若联想到某个人，也应把这当作你的联想，不能说牌已经确认了对方的身份或动机。',
          ],
        },
        {
          heading: '做一次不用背牌义的小练习',
          paragraphs: [
            '假设问题是“怎样开始一个个人项目”。挑一张牌，先写花色，再写看到的动作或意象，最后联系一个现实条件。例如“星币 → 学习与练习 → 本周安排两小时完成一个小样”。',
            '之后再读提示文字，比较它增加了什么，也记下不符合的部分。问卜使用原创 AI 插画，因此图中的每一个装饰细节都不必强行套用经典韦特牌图的含义。想研究历史图像时，应另外查看对应版本的原牌与原书。',
          ],
        },
      ],
    },
    en: {
      title: 'Tarot suits and court cards without the memorization',
      description:
        'Get to know Wands, Cups, Swords and Pentacles, then try a practical way to read Pages, Knights, Queens and Kings.',
      sections: [
        {
          heading: 'Learn the deck’s structure first',
          paragraphs: [
            'A typical Rider-Waite-Smith-style deck has 22 Major Arcana and 56 Minor Arcana. The minor cards have four suits. Each contains Ace through Ten, followed by Page, Knight, Queen and King.',
            'A suit gives you a starting point. The particular card, its spread position and your question add context. Treating every Cup as romance or every Pentacle as income leaves out other useful ways to read the image.',
          ],
        },
        {
          heading: 'Use the suits to ask different questions',
          paragraphs: [
            'These are Wenbu’s modern reflection prompts for beginners, rather than an exhaustive account of historical card meanings.',
          ],
          bullets: [
            'Wands: action, motivation and effort. Why begin this project, and how much energy can I give it?',
            'Cups: feelings, relationships and responses. Whose needs have not been heard? What do I expect from a collaboration?',
            'Swords: thought, judgment and communication. Which facts are established, and where is the disagreement?',
            'Pentacles: resources, practice and everyday work. Do my time, skills and budget support the plan?',
          ],
        },
        {
          heading: 'Try reading a court card as an approach',
          paragraphs: [
            'A court card need not represent a particular person, age or gender. For a first exercise, read a Page as learning or trying, a Knight as pursuing or acting, a Queen as tending or developing a practice, and a King as organizing or taking responsibility. Refine that starting point with the suit and the particular image.',
            'For example, the Page of Pentacles could prompt: “What basic skill would help this project most?” You do not need to conclude that a young person is about to appear. If someone comes to mind, record that as your association rather than a confirmed identity or motive.',
          ],
        },
        {
          heading: 'Try an exercise before checking the card meaning',
          paragraphs: [
            'Suppose your question is how to begin a personal project. Pick a card, name its suit, note an action or image that catches your attention, and connect it to one practical condition. For instance: “Pentacles → learning through practice → two hours this week to make a small prototype.”',
            'Then read the prompt and note what it adds, including anything that does not fit. Wenbu uses original AI illustrations, so every decorative detail need not carry a meaning from a historical Rider-Waite-Smith image. Consult the relevant original deck and text when studying that imagery.',
          ],
        },
      ],
    },
  },
  {
    slug: 'tarot-reversals',
    category: 'learn',
    symbol: '转',
    minutes: 4,
    tool: 'tarot',
    sources: [
      {
        title: 'A. E. Waite · The Pictorial Key to the Tarot, Part III',
        url: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3',
      },
      productSource('src/lib/tarot.ts', 'draw and reversal rules'),
    ],
    zh: {
      title: '塔罗逆位一定不好吗？先选好阅读规则',
      description: '了解逆位怎样产生、为什么不等于“坏结果”，以及初学者可以怎样固定规则、记录和练习。',
      sections: [
        {
          heading: '逆位首先是牌的朝向',
          paragraphs: [
            '逆位指牌面相对阅读方向倒置。问卜开启逆位时，每张抽出的牌独立有一半概率逆位；关闭时则都按正位呈现。这个设置改变的是抽取与阅读约定，不会测量你的运气。',
            '三张牌中出现多张逆位，是这套随机规则可能产生的结果。它不说明你的状态被系统判为更差，也不要求你马上重新抽一次。',
          ],
        },
        {
          heading: '不同读法，需要分别说明',
          paragraphs: [
            '有些传统为每张牌分别列正逆位含义；现代反思读法也会用受阻、过度、内化或尚未完成等角度。它们是解释选择，不能随时换成最迎合期待的那一种。逆位也不是把正位每个词都机械取反。',
            '初学可以先关闭逆位，熟悉牌名、花色与位置；也可以保留逆位，但一次只采用一种清楚的阅读思路。两种方式都不需要被包装成更准确。',
          ],
        },
        {
          heading: '一个例子：把“受阻”问具体',
          paragraphs: [
            '假设你准备推进一个项目，而逆位让你想到“行动受阻”。先问阻碍是什么：任务太大、时间不够，还是缺少别人的确认？每个答案都应该回到真实情况，而不是从倒置的牌面直接推断出来。',
            '可以记录：“我把逆位读作推进困难；现实依据是还没拿到必要资料；下一步先确认资料何时到位。”如果没有发现实际阻碍，也可以写“这个角度目前不符合”。',
          ],
        },
        {
          heading: '抽牌之前定规则，抽完以后保留记录',
          paragraphs: [
            '先选一张或三张牌，确定是否使用逆位，再写问题。问卜三张牌的位置是当下、牵引、下一步；牌的位置与正逆位都应在解读前确认，不能看见结果后再交换。',
            '下一次练习可以只看一张牌，写下正位与逆位各能引出什么问题，再保留与你现实最有关的一条。练习比较的是提问角度，不是在决定哪一种牌面更吉利。',
          ],
        },
      ],
    },
    en: {
      title: 'Are reversed tarot cards bad? Start with a clear rule',
      description:
        'Understand what a reversal is, how Wenbu generates it and how to use a consistent reading approach without treating it as bad news.',
      sections: [
        {
          heading: 'A reversal begins as an orientation',
          paragraphs: [
            'A reversed card appears upside down relative to the reading direction. With reversals enabled in Wenbu, each drawn card independently has a one-in-two chance of being reversed. With the setting off, all cards appear upright. This is a draw convention, not a measurement of your luck.',
            'Several reversed cards in a spread are a possible result of that random process. They do not mean the system has rated your situation poorly or that you need another draw immediately.',
          ],
        },
        {
          heading: 'Choose an approach and name it',
          paragraphs: [
            'Some sources give specific upright and reversed meanings for each card. Modern reflective approaches may consider a blockage, excess, an inward focus or something unfinished. These are interpretive choices. A reversal does not mechanically turn every upright meaning into its opposite.',
            'You can turn reversals off while learning names, suits and spread positions. Or keep them on and use one clearly stated approach for the session. Neither setting needs to be presented as more accurate.',
          ],
        },
        {
          heading: 'Make an idea such as “blocked” specific',
          paragraphs: [
            'Suppose you are trying to start a project and a reversal suggests stalled action. Ask what might be getting in the way: an oversized task, limited time or a missing confirmation. Check each possibility against your situation rather than inferring it from the card’s orientation.',
            'You could write: “I read this reversal as difficulty getting started. I am still waiting for essential information, so I will ask when it is available.” If you find no relevant obstacle, “This angle does not fit right now” is an equally useful note.',
          ],
        },
        {
          heading: 'Set the rules before drawing',
          paragraphs: [
            'Choose one or three cards, decide whether to include reversals, and write your question. Wenbu’s three positions are Situation, Tension and Next Step. Keep those positions and orientations as drawn rather than rearranging them after seeing the result.',
            'For your next practice, take one card and write a question its upright meaning might prompt, then one its reversed meaning might prompt. Keep the question most relevant to your circumstances. You are comparing ways to reflect, not deciding which orientation brings better luck.',
          ],
        },
      ],
    },
  },
  {
    slug: 'ziwei-four-transformations',
    category: 'learn',
    symbol: '化',
    minutes: 5,
    tool: 'ziwei',
    sources: [
      { title: 'iztro · 四化 / Four Transformations', url: 'https://iztro.com/learn/mutagen' },
      {
        title: 'iztro · heavenly-stem transformation table',
        url: 'https://github.com/SylarLong/iztro/blob/main/src/data/heavenlyStems.ts',
      },
      productSource('src/lib/ziwei.ts', 'Zi Wei chart fields and conventions'),
    ],
    zh: {
      title: '紫微四化入门：禄、权、科、忌该怎么看',
      description: '先理解四化标记附着在哪颗星、哪一个宫位，再分清生年规则、流派差异与个人解释。',
      sections: [
        {
          heading: '先找到星，再看它旁边的标记',
          paragraphs: [
            '四化指化禄、化权、化科、化忌。在紫微斗数的规则里，它们附着于特定星曜，不能脱离星和宫位单独阅读。初学时先问“哪颗星、在哪个宫、标了哪一种化”，比直接给整张盘判好坏更清楚。',
            '生年四化根据出生年的天干对应表产生。其他讨论还可能涉及大限、流年或宫干四化，所用参照不同。看到一个“忌”字时，先确认它属于哪一层盘，别把本命标记直接说成今年发生的事。',
          ],
        },
        {
          heading: '四个名称，先了解常见讨论方向',
          paragraphs: ['下列是帮助辨认术语的简短概括。具体含义仍取决于星曜、宫位和采用的解释体系。'],
          bullets: [
            '化禄：传统讨论常涉及增加、所得或较容易投入的部分。',
            '化权：常涉及掌握、推动、责任或主导。',
            '化科：常涉及声誉、表达、条理或被看见的部分。',
            '化忌：常涉及牵挂、阻碍、执着或需要处理的问题。',
          ],
        },
        {
          heading: '一组可以核对的例子',
          paragraphs: [
            '按问卜所用 iztro 默认四化表，甲年对应廉贞化禄、破军化权、武曲化科、太阳化忌。这是一项规则映射；其他流派的表可能不同，所以比较结果前要先核对所用表。',
            '“太阳化忌”这一标签本身没有提供某人会遭遇什么事件的证据。若解读进一步说到某段关系或具体年份，请要求说明还用了哪些盘面条件，以及哪部分只是推测。',
          ],
        },
        {
          heading: '问卜当前展示到哪里',
          paragraphs: [
            '在紫微工具中点选宫位，可以查看所列主星、亮度和已有四化标记。当前简版结果只在主星字段中保留四化；辅星区显示名称，不是完整的所有星曜四化清单。因此某个标记没有在画面出现，不足以证明整盘没有那一化。',
            '页面的大限年龄区间也不等于完成了某一年的流年分析。下一步可以选一个有标记的主星，请 Agent 先解释标签的来源，再解释这一宫的传统语境，最后把与你真实经历有关、仍需确认的部分分别列出。',
          ],
        },
      ],
    },
    en: {
      title: 'Zi Wei’s Four Transformations: Lu, Quan, Ke and Ji',
      description:
        'Understand the transformation labels beside stars, check which chart layer they belong to and learn what Wenbu currently displays.',
      sections: [
        {
          heading: 'Find the star before reading the label',
          paragraphs: [
            'The Four Transformations are 化禄 (Hua Lu), 化权 (Hua Quan), 化科 (Hua Ke) and 化忌 (Hua Ji). In Zi Wei Dou Shu, these labels attach to particular stars. Start by identifying the star, its palace and its transformation rather than rating the whole chart from one word.',
            'Natal transformations follow a table keyed to the birth year’s heavenly stem. Other readings may discuss decade, year or palace-stem transformations. Identify the chart layer before interpreting a label; a natal Ji marker is not itself a claim about an event this year.',
          ],
        },
        {
          heading: 'Recognize the usual discussion themes',
          paragraphs: [
            'These brief descriptions are starting points for terminology. Their interpretation depends on the star, palace and school.',
          ],
          bullets: [
            'Lu 禄: often discussed in terms of increase, gain or an area of willing involvement.',
            'Quan 权: control, initiative, responsibility or taking the lead.',
            'Ke 科: reputation, expression, order or visibility.',
            'Ji 忌: attachment, difficulty, a preoccupation or something requiring attention.',
          ],
        },
        {
          heading: 'A rule you can check',
          paragraphs: [
            'In the default iztro table used by Wenbu, a Jia year maps Lu to Lian Zhen 廉贞, Quan to Po Jun 破军, Ke to Wu Qu 武曲 and Ji to Tai Yang 太阳. This is a rule-based mapping. Tables can differ between schools, so compare the convention before comparing results.',
            'The label “Tai Yang transforms to Ji” alone is not evidence that a particular event will occur. If a reading makes a claim about a relationship or a specific year, ask which additional chart conditions it uses and where it moves from a rule into inference.',
          ],
        },
        {
          heading: 'What the current Wenbu chart displays',
          paragraphs: [
            'Select a palace to inspect its listed major stars, brightness labels and available transformation markers. The current compact result preserves transformation fields for major stars; the supporting-star list contains names only. An absent marker on this screen does not establish that the full chart lacks that transformation.',
            'Likewise, a displayed decadal age range is not a completed annual reading. Choose one marked major star and ask the Agent to explain the label’s calculation basis, then its traditional palace context. Keep any connection to your own experience separate and open to checking.',
          ],
        },
      ],
    },
  },
];
