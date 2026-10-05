import type { GuideExpansion } from './guide-types';

const product = (path: string, title: string, noteZh: string, noteEn: string) => ({
  title: `Wenbu · ${title}`,
  url: `https://github.com/wenbu-app/wenbu/blob/main/${path}`,
  noteZh,
  noteEn,
});

const nist = {
  title: 'NIST AI 600-1 · Generative Artificial Intelligence Profile (2024)',
  url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf',
  noteZh:
    '第 2.2 节说明生成式 AI 可能自信地输出错误内容；MS-2.5-003 建议核验来源与引文。它不是对问卜或任何命理体系准确率的测试。',
  noteEn:
    'Section 2.2 describes confident false output; MS-2.5-003 calls for checking sources and citations. This is not an accuracy evaluation of Wenbu or divination.',
};

export const practiceDepth: Record<string, GuideExpansion> = {
  'first-reading': {
    zh: {
      answer:
        '第一次使用问卜，可以只完成三个小目标：把困惑写成一个问题，核对回答是否理解了你的条件，带走一个能实际执行的下一步。选择一个贴近当下的示例，或直接发送问题即可开始；不需要先填写生日，也不需要先抽牌。',
      takeaways: [
        '示例会直接开始对话。Agent 会在对话中询问缺少的信息；选择回答或输入自己的说法即可继续。',
        '一轮只处理一件事，先说明已知事实与限制，再决定是否使用象征工具。',
        '结束前留下原问题、一个待核实信息和一个行动；重要记录另外导出。',
      ],
      figure: {
        caption: '第一次对话的四个准备与核对要点',
        description:
          '这里选取清单前四项：选一件事、说清目标、补充背景、核对回答。每张卡片配一条室友沟通的示例表达，供你对照自己的问题。下方完整表格还包括“留下下一步”，并说明每项怎样算准备充分。',
      },
      table: {
        title: '第一次对话的完成清单',
        columns: ['环节', '可以这样填写', '怎样知道这一步够了'],
        rows: [
          ['选一件事', '我需要和室友讨论夜间安静的时间。', '范围是一场具体沟通，不是评价整段关系。'],
          [
            '说清目标',
            '帮我准备一个开场白和两个可讨论的方案。',
            '能指出自己想带走什么，而不只是“帮我看看”。',
          ],
          [
            '补充背景',
            '对方常在午夜回来；我七点起床；我们尚未正式谈过。',
            '事实、时间限制和未知信息足够，不需要姓名或住址。',
          ],
          [
            '核对回答',
            '请先确认你理解的是噪声问题，不是在判断对方是否尊重我。',
            '回答没有把对方的动机或你的感受写成未经提供的事实。',
          ],
          [
            '留下下一步',
            '周六白天约十分钟讨论，之后记录双方真正同意的安排。',
            '行动可执行，后续结果可观察；提醒需自行设在日历中。',
          ],
        ],
      },
      example: {
        title: '完整示例：从“室友让我很烦”到一段可以说出口的话',
        intro:
          '这是虚构的练习场景。你想改善晚上的休息，却还不知道该如何开始谈。此时，对话整理比先判断对方性格更贴近任务。',
        steps: [
          '在 Agent 中直接说“我想和室友讨论晚上的噪声，帮我准备沟通”。也可以从相关示例开始，再回答 Agent 的补充问题。',
          '接着补充具体情况：“室友最近常在午夜回来，开门和收拾东西会吵醒我。我七点要起床，还没和对方认真讨论。请帮我写一个不指责人的开场白，再列两个可以协商的安排。”这比“他是不是根本不在乎我”多了事实和可完成的任务。',
          '读回答时，检查它是否替你声称“你总是很生气”，或替室友断言“对方故意打扰”。出现这些句子就纠正：“我没有提供这些信息，请改成可观察的行为。”',
          '从建议中挑一个符合实际情况的版本，例如：“最近我几次被夜里的声音吵醒，第二天有点累。周末我们能聊十分钟，看看怎样让晚归和休息都方便一些吗？”你可以修改后自己去沟通；Agent 不会代你发消息。',
          '导出这段会话，或自行记录原问题与准备采用的表达。约定一周后查看是否谈成、哪些安排有效。若另外抽过牌或排过盘，想放进工具手记，需要对那份结果使用保存操作。',
        ],
        conclusion:
          '这次探索的产物是一段开场白和一个核实安排的机会。对方怎么回应仍需现实沟通，不能由一段解读替代。',
      },
      faq: [
        {
          question: '我只是想体验，必须分享出生资料吗？',
          answer:
            '不必。对话、资料研习、塔罗和易经都可以不提供出生资料。也可以先看工具示例，认清界面后再决定是否输入自己的信息。',
        },
        {
          question: '会话保存在浏览器，是不是意味着问题不会发给模型？',
          answer:
            '不是。发送 Agent 消息会把当前消息、受限的近期会话内容和你选择的资料交给 DeepSeek 处理。本地保存说明历史存放的位置，不能代替模型处理的隐私说明。',
        },
        {
          question: '关掉页面，Agent 还会继续生成吗？',
          answer:
            '不会在后台持续工作。页面关闭会中断任务；已成功保存在浏览器或账号中的内容可以回看。若状态提示未完成，可围绕已得到的内容再发一个具体追问。',
        },
      ],
      glossary: [
        {
          term: '补充问题',
          definition:
            'Agent 为理解当前任务而提出的问题；可选择建议答案，也可用自己的话补充，不必填写无关资料。',
        },
        {
          term: '背景资料',
          definition: '你主动提供、与当前任务有关的信息；可以是限制与已知事实，不必是完整个人档案。',
        },
        { term: '下一步', definition: '自己能完成或安排的一项行动，例如核对记录、询问条件或尝试一次沟通。' },
      ],
    },
    en: {
      answer:
        'For a first visit, aim to leave with one clear question, an answer that respects your circumstances, and one practical next step. Choose Conversation to begin. You do not need birth details, a card draw or a finished view of what the problem means.',
      takeaways: [
        'Examples start a conversation immediately. Answer follow-up questions by choosing an option or adding context in your own words.',
        'Work on one situation at a time. Share relevant facts and limits before choosing a symbolic tool.',
        'Keep the original question, one information gap and one action. Export important records separately.',
      ],
      figure: {
        caption: 'Four things to prepare and check in a first conversation',
        description:
          'These cards select the first four checklist items: a situation, a goal, context and an answer to check. Each pairs the item with an example from a housemate conversation. The complete table below adds a next action and explains what a useful result looks like for each item.',
      },
      table: {
        title: 'A checklist for your first conversation',
        columns: ['Part', 'Example input', 'Ready to move on when…'],
        rows: [
          [
            'Situation',
            'I need to discuss quiet hours with my housemate.',
            'The scope is one conversation, rather than a verdict on the relationship.',
          ],
          [
            'Goal',
            'Help me prepare an opening and two arrangements to discuss.',
            'You can name something useful to take away.',
          ],
          [
            'Context',
            'They return around midnight; I get up at seven; we have not discussed it.',
            'You have shared the relevant facts without names or addresses.',
          ],
          [
            'Check',
            'Focus on the noise. Do not assume they mean to upset me.',
            'The answer separates observed behavior from guesses about motives.',
          ],
          [
            'Next step',
            'Ask for ten minutes on Saturday and record what we agree.',
            'You can act and observe the result. Set any reminder yourself.',
          ],
        ],
      },
      example: {
        title: 'Worked example: finding the words for a housemate conversation',
        intro:
          'In this fictional scenario, late-night noise is interrupting your sleep. You want a workable arrangement but have not raised the issue yet.',
        steps: [
          'Tell the Agent: “Help me prepare a conversation with my housemate about late-night noise.” You can also start from a relevant example and answer its follow-up questions.',
          'Add the details: “My housemate often gets home around midnight. Opening the door and putting things away wakes me up. I get up at seven, and we have not discussed this properly. Help me write a calm opening and suggest two arrangements we could discuss.”',
          'Check the answer for invented motives. If it says your housemate is deliberately inconsiderate, reply: “I have not established that. Please use only the behavior I described.”',
          'Adapt one opening: “I have been waking up when you get home and feeling tired the next morning. Could we take ten minutes this weekend to work out something that suits us both?” You conduct the conversation; the Agent does not send a message for you.',
          'Export the conversation or keep your own note. Review what happened a week later. Any separate chart or draw needs its own save action if you want it in the tool journal.',
        ],
        conclusion:
          'The useful result is a conversation you can initiate and an arrangement you can check. Your housemate’s response remains something to discover directly.',
      },
      faq: [
        {
          question: 'Do I need to share my birth details to try Wenbu?',
          answer:
            'No. Conversation, research, tarot and I Ching can all work without them. Sample charts also let you learn the interface first.',
        },
        {
          question: 'Does browser storage mean my message never reaches a model?',
          answer:
            'No. Sending shares the message, limited recent context and selected details with DeepSeek. Local storage describes where your saved history lives.',
        },
        {
          question: 'Will the Agent continue after I close the page?',
          answer:
            'No. Closing interrupts the task. Successfully saved content remains in this browser or your account; you can return with a focused follow-up.',
        },
      ],
      glossary: [
        {
          term: 'Follow-up question',
          definition:
            'A question that helps the Agent understand your situation. Choose an answer or write your own.',
        },
        {
          term: 'Context',
          definition: 'Relevant information you choose to share, including constraints and known facts.',
        },
        { term: 'Next step', definition: 'An action you can take or arrange and later check.' },
      ],
    },
    sources: [
      product(
        'src/lib/agent-guidance.ts',
        'Conversation guide',
        '支持直接提问、示例开聊和对话中补充资料的描述；室友场景为本文编写的练习。',
        'Supports direct questions, conversation starters and follow-up clarification. The housemate scenario is an original exercise.',
      ),
      product(
        'src/components/AgentWorkspace.tsx',
        'Conversation context and local records',
        '支持发送资料、会话记录、导出与工具结果保存的操作说明。',
        'Supports context sharing, saved conversations, exports and saving a result to the journal.',
      ),
      product(
        'src/data/pages.ts',
        'Privacy explanation',
        '支持模型处理与浏览器保存的区别，以及关闭页面会中断任务的说明。',
        'Supports the distinction between model processing and browser storage, and the limit on work after closing the page.',
      ),
    ],
  },
  'choose-a-tool': {
    zh: {
      answer:
        '按这次要完成的任务选入口：整理问题用对话，核对术语用查阅资料；八字与紫微用于学习出生符号结构，塔罗与易经用于围绕当前问题作象征性探索。工具的信息量和传统不同，不能据此排列预测准确率。',
      takeaways: [
        '先决定要学一个概念、整理一个选择，还是观察一组符号，再选工具。',
        '不愿提供出生资料也能开始；八字时刻可以未知，紫微目前需要已知时刻。',
        '一次先用一种方法。几份解读都让你有共鸣，不等于获得独立验证。',
      ],
      figure: {
        caption: '四个无需出生资料的起点',
        description:
          '卡片选取前四种入口及其示例请求：普通对话、查阅资料、三张塔罗、易经起卦。它们可以不提供出生资料就开始。下方完整表格列出全部六种入口，包括八字与紫微，并补充各自所需资料和结果形式。',
      },
      table: {
        title: '六种入口，分别适合做什么',
        columns: ['入口', '适合的第一句话', '需要准备 / 会得到什么'],
        rows: [
          [
            '普通对话',
            '帮我分清我在担心时间、预算还是沟通。',
            '两三句实际背景；得到问题整理、澄清问题或行动建议。',
          ],
          [
            '查阅资料',
            '解释八字年柱为何不直接按公历元旦换年。',
            '一个明确概念；得到当前资料库和可读取来源支持的说明。',
          ],
          [
            '三张塔罗',
            '借三张牌看看准备这次沟通时有哪些角度。',
            '当前问题，无需生日；得到牌名、方向、牌阵位置和象征联想。',
          ],
          [
            '易经起卦',
            '围绕这个问题，学习怎样从本卦读到变卦。',
            '当前问题，无需生日；得到六爻、本卦及有动爻时的变化结构。',
          ],
          [
            '八字命盘',
            '带我从日主开始认这张四柱表。',
            '公历日期、出生地时区，时间可未知；得到干支与计算约定。',
          ],
          [
            '紫微命盘',
            '帮我找到命宫、身宫与一个相关宫位。',
            '公历日期、已知当地时刻、传统性别参数；得到十二宫星曜结构。',
          ],
        ],
      },
      example: {
        title: '完整示例：考虑换工作，应该先开什么？',
        intro:
          '假设你拿到新职位邀请，已知薪资和职责，却不清楚出差频率，也不想提供生日。这个任务并不需要先做出生排盘。',
        steps: [
          '先定义产物：“帮我列出接受邀请前要确认的三项条件。”直接交代自己最在意稳定作息和学习机会。不要要求系统直接决定去留。',
          '把得到的建议分成已知与待确认。例如薪资已有书面说明；出差安排和带教方式尚未知。先准备给招聘方的问题，比增加第二种占卜更能补足信息。',
          '若还想用图像整理感受，可以明确追加：“请抽三张塔罗，把它们当作观察角度，保留刚才的事实清单。”是否抽牌由这次请求决定，不因话题是工作就自动触发。',
          '如果对某个术语产生兴趣，再切到学习任务：“解释这张牌的常见象征，并列出来源没有证明的部分。”这时需要的是资料说明，不能把传统牌义写成新公司的真实情况。',
        ],
        conclusion:
          '你最终带走的是一份待确认清单，以及可选择保留的象征联想。收到真实答复后再更新判断；不会因为多选一个工具就自动更接近事实。',
      },
      faq: [
        {
          question: '哪个工具最适合小白？',
          answer:
            '尚未说清问题时，对话的输入要求最低。想认图可用工具示例；喜欢图像可学塔罗，喜欢线形与变化可学易经。这里的“适合”指学习方式和资料要求，不是预测能力排名。',
        },
        {
          question: '我可以同时用四种方法互相验证吗？',
          answer:
            '可以比较它们组织问题的方式，但相似结论不构成独立检验：相同背景、宽泛语言或同一模型都可能影响解释。先保留各自原始结果和规则，避免把差异硬合成一条结论。',
        },
        {
          question: '研习能查网上任意文章吗？',
          answer:
            '目前不能。它检索问卜资料库与精选目录，并尝试读取目录里的公开网页片段。超出范围的资料应标为待补充，不应声称已经搜索全网。',
        },
      ],
      glossary: [
        { term: '探索', definition: '围绕实际问题澄清背景，并在明确需要时调用排盘或抽取工具。' },
        { term: '研习', definition: '通过检索、阅读和出处核对，说明一个概念或比较规则。' },
        { term: '象征性解读', definition: '借符号提出观察角度；其作用与外部事实核查、预测检验不同。' },
      ],
    },
    en: {
      answer:
        'Choose by the task you want to complete. Conversation helps frame a question; Sourced research checks concepts. BaZi and Zi Wei let you study birth-chart structures, while tarot and I Ching provide symbolic perspectives on a current question. More symbols or detail do not establish better predictive accuracy.',
      takeaways: [
        'Decide whether you want to clarify a choice, learn a concept or explore a symbolic structure.',
        'Birth details are optional for several approaches. BaZi permits an unknown time; Zi Wei currently requires a known time.',
        'Start with one method. Several readings that resonate do not amount to independent confirmation.',
      ],
      figure: {
        caption: 'Four starting points that need no birth details',
        description:
          'The cards select the first four approaches and an example request for each: Conversation, Sourced research, Three tarot cards and I Ching. None requires birth details. The complete table below includes all six approaches, adding BaZi and Zi Wei with their inputs and results.',
      },
      table: {
        title: 'Six starting points',
        columns: ['Approach', 'A useful first request', 'Input and result'],
        rows: [
          [
            'Conversation',
            'Help me identify whether time, cost or communication is the main issue.',
            'A little context; a clearer question or a practical next step.',
          ],
          [
            'Sourced research',
            'Why does the BaZi year not simply change on January 1?',
            'A focused concept; an explanation within the available source collection.',
          ],
          [
            'Three tarot cards',
            'Draw three cards as perspectives on preparing this conversation.',
            'A current question; cards, orientations, positions and symbolic associations.',
          ],
          [
            'I Ching',
            'Help me understand the original and relating hexagrams for this question.',
            'A question; six lines and the changes produced by moving lines, if any.',
          ],
          [
            'BaZi chart',
            'Show me how to find the Day Master in this chart.',
            'Gregorian date and birthplace time zone; time may be unknown. Stems, branches and conventions.',
          ],
          [
            'Zi Wei chart',
            'Help me locate the Life Palace and Body Palace.',
            'Date, known local time and the traditional sex parameter. A twelve-palace structure.',
          ],
        ],
      },
      example: {
        title: 'Worked example: choosing a starting point for a job offer',
        intro:
          'You know the proposed salary and role but not the travel schedule. You care about regular hours and opportunities to learn, and prefer not to share birth details.',
        steps: [
          'Choose Conversation and ask: “Help me identify three things to confirm before accepting.” State your priorities rather than asking for a verdict on your future.',
          'Separate known terms from open questions. Salary may be documented, while travel frequency and mentoring are not. Drafting questions for the employer can close those gaps.',
          'If you want a visual prompt afterward, explicitly request three tarot cards and ask to keep the factual checklist separate. A work topic does not itself require a draw.',
          'If a card term interests you, turn it into a learning question: “Explain this traditional association and what the source does not establish.” A card meaning cannot verify the employer’s working conditions.',
        ],
        conclusion:
          'Leave with questions to ask the employer and, if useful, symbolic perspectives to reflect on. Update your decision when real information arrives.',
      },
      faq: [
        {
          question: 'Which approach is easiest for a beginner?',
          answer:
            'Conversation needs the least preparation. Sample charts help you learn the layout; tarot suits visual exploration and I Ching introduces line structures. These are learning preferences, not accuracy rankings.',
        },
        {
          question: 'Can four methods validate one another?',
          answer:
            'You can compare them, but shared context, broad wording or one interpreting model can produce similar conclusions. Preserve each result and its assumptions.',
        },
        {
          question: 'Can research read any website?',
          answer:
            'Not currently. It searches Wenbu and a curated reference catalogue, with limited public excerpts from listed external pages.',
        },
      ],
      glossary: [
        {
          term: 'Explore',
          definition: 'Clarify a question and use a calculation or draw when requested and relevant.',
        },
        { term: 'Research', definition: 'Find, read and compare sources for a focused explanation.' },
        {
          term: 'Symbolic interpretation',
          definition: 'An association used for reflection, distinct from external verification.',
        },
      ],
    },
    sources: [
      product(
        'src/lib/agent-guidance.ts',
        'Available starting points',
        '支持六种引导方式、资料要求及默认推荐规则；任务示例由本文编写。',
        'Supports the six approaches, required inputs and default suggestions. Task examples are editorial exercises.',
      ),
      product(
        'worker/agent.ts',
        'Explore and research behavior',
        '支持先澄清问题、按请求调用工具以及研习报告的约束。',
        'Supports question clarification, requested tool use and the rules for research reports.',
      ),
      product(
        'worker/agent-library.ts',
        'Research collection and reference access',
        '支持资料库范围、精选外部网址限制和片段读取的说明。',
        'Supports the collection scope, restricted external URLs and excerpt-based reading.',
      ),
    ],
  },
  'ask-a-better-question': {
    zh: {
      answer:
        '一个有用的问题通常包含四部分：发生了什么、你在意什么、哪些信息还不知道、希望这次得到什么。不用把经历写得很长；把事实与猜测分开、给出一个真实限制，比要求 AI “全面分析我”更容易得到可用的回答。',
      takeaways: [
        '先提供能观察的行为或事件，把对他人动机的判断单独标为猜测。',
        '说出时间、预算或资料不足等限制，让建议有机会贴合真实条件。',
        '明确要一份清单、一段开场白或一个比较；下一轮纠正具体遗漏。',
      ],
      figure: {
        caption: '四个还需要说清楚的问题',
        description:
          '卡片选取工作选择、关系沟通、学习计划和出生资料四种情境，展示尚未补充背景的原始问法，例如“我跳槽会不会后悔”。下方完整表格提供五种情境的改写，另含资料求证情境；卡片中的原问法不是已经写好的完整请求。',
      },
      table: {
        title: '五种常见困惑，怎样补成完整请求',
        columns: ['情境', '原来的问法', '可直接使用的改写'],
        rows: [
          [
            '工作选择',
            '我跳槽会不会后悔？',
            '我在两个岗位间选择，最在意作息稳定。已知薪资，未知出差频率。请列接受前要问的三件事，不替我决定。',
          ],
          [
            '关系沟通',
            '他是不是不重视我？',
            '最近两次约见都临时取消，我有些失落，也不知道原因。请帮我写一段询问安排、又不预设对方动机的话。',
          ],
          [
            '学习计划',
            '我适不适合学设计？',
            '我想试学设计，每周能投入两小时，尚不清楚喜欢哪一类。请给一个两周内能做完的小练习和回顾标准。',
          ],
          [
            '出生资料',
            '帮我算准我的时辰。',
            '家人只记得清晨六点到八点。请先说明这段不确定性会影响哪些字段，以及我应该查找哪些原始记录。',
          ],
          [
            '资料求证',
            '哪种真太阳时算法最准？',
            '请解释经度校正与均时差的区别，注明问卜的计算约定，并把天文定义与流派取法分开。',
          ],
        ],
      },
      example: {
        title: '完整示例：项目总改需求，怎样从抱怨进入讨论',
        intro:
          '最初的问题是：“我的工作是不是不适合我？”你可以先围绕最近一件事补充，而不必马上解释整个职业生涯。',
        steps: [
          '事实：“本周有两次在下班前临时加需求，我都加班完成了。”这句话没有把“负责人不尊重我”当作已经证实的原因。',
          '关切与限制：“我希望减少临时加班，但目前不能推迟周五交付。我还没问过哪些需求真的必须当天完成。”这里同时提供了优先级和信息缺口。',
          '完整请求：“本周两次在下班前临时加需求，我都加班完成了。我想减少这类情况，又要保证周五交付。请帮我准备和负责人核对优先级的三句话；先不要判断我该不该离职。”现在任务是准备沟通，而非替你作人生决定。',
          '收到建议后具体纠正：“第二句太正式，我们平常用即时消息交流。请改成三句简短中文，保留询问交付优先级。”如果 AI 引用了未提供的背景，也请它移除该前提。',
          '把最终表达放回现实检验：“这项新需求会占用今晚时间。原定任务 A 和新需求 B，哪个需要优先？如果 B 必须今晚完成，A 是否可以调整到明天？”记录负责人回复，再决定是否需要下一轮讨论。',
        ],
        conclusion:
          '更准确的提问不保证对方配合，但能让你检查回答有没有完成任务。若得到的仍是泛泛鼓励，指出缺少的产物比重复要求“详细一点”更有效。',
      },
      faq: [
        {
          question: '是不是提供的私人信息越多，回答就越准？',
          answer:
            '不是。优先补充会改变建议的条件，例如时间限制和已经尝试过的办法。姓名、精确住址、同事联系方式通常不能帮助完成这些任务，可以省略。',
        },
        {
          question: '我说不清自己的目标怎么办？',
          answer:
            '可以直接发：“我还说不清，请一次问一个问题，给两三个不同选项，也允许我自己补充。”不确定本身可以保留，不需要勉强选一个不符合自己的答案。',
        },
        {
          question: '把问题写清楚，就能保证模型回答正确吗？',
          answer:
            '不能。清楚的输入减少的是误解任务的机会，模型仍可能漏掉限制、编造解释或引用错来源。继续核对重要事实和引用，尤其是它替你补出来的前提。',
        },
      ],
      glossary: [
        { term: '事实', definition: '你观察到或有记录支持的事件，例如两次约见被取消；应保留时间和范围。' },
        { term: '推测', definition: '为了说明事实而提出的解释，例如对方不重视你；还需要其他证据。' },
        {
          term: '限制条件',
          definition: '回答必须适应的现实边界，例如每周两小时、尚无出生时刻或暂不能调整期限。',
        },
      ],
    },
    en: {
      answer:
        'A useful question says what happened, what matters to you, what you do not know and what you want from this exchange. A short account with one real constraint usually gives the Agent more to work with than a request to analyze your entire life.',
      takeaways: [
        'Describe observable events and label assumptions about motives separately.',
        'Include a relevant limit: time, budget, missing information or something you have already tried.',
        'Ask for a concrete result, then correct a specific omission in the next reply.',
      ],
      figure: {
        caption: 'Four questions that need more context',
        description:
          'The cards select work, relationships, learning and birth information, pairing each with an initial question such as “Will I regret changing jobs?” These are starting questions, not complete requests. The five-row table below supplies the fuller rewrites and adds a research example.',
      },
      table: {
        title: 'Five questions you can make more useful',
        columns: ['Situation', 'First attempt', 'A more workable request'],
        rows: [
          [
            'Work',
            'Will I regret changing jobs?',
            'I value regular hours and know the salary, but not the travel schedule. List three things to ask before accepting.',
          ],
          [
            'Relationships',
            'Do they care about me?',
            'They canceled our last two meetings. I feel disappointed but do not know why. Help me ask without assuming a motive.',
          ],
          [
            'Learning',
            'Am I suited to design?',
            'I can try design for two hours a week. Suggest a two-week exercise and what to reflect on afterward.',
          ],
          [
            'Birth information',
            'Find my exact birth time.',
            'My family remembers between six and eight in the morning. Explain which fields may differ and what records I could check.',
          ],
          [
            'Research',
            'Which solar-time method is most accurate?',
            'Explain longitude correction and the equation of time. Separate astronomical definitions from Wenbu’s conventions and school differences.',
          ],
        ],
      },
      example: {
        title: 'Worked example: discussing last-minute requests at work',
        intro:
          'You begin with “Am I in the wrong job?” Start by examining one recent situation before deciding what it means for your whole career.',
        steps: [
          'Write the observation: “Twice this week, a new request arrived just before I finished work. Both times I stayed late.” Do not present disrespect as an established motive.',
          'Add your priority and limit: “I want fewer late changes, but Friday’s delivery cannot slip. I have not asked which requests genuinely need same-day completion.”',
          'Name the task: “Help me prepare three sentences to check priorities with the project lead. Do not decide whether I should leave.” The answer now has a specific job to do.',
          'Revise a mismatch: “The second sentence is too formal for our chat messages. Make it shorter but keep the question about delivery priorities.” Remove any background the model invented.',
          'Try: “This new request would take the evening. Which comes first: task A or request B? If B is needed tonight, can A move to tomorrow?” Record the reply before deciding on a follow-up.',
        ],
        conclusion:
          'A clear request cannot guarantee cooperation. It does let you check whether the answer actually prepares you for the conversation.',
      },
      faq: [
        {
          question: 'Will more personal information make the answer more accurate?',
          answer:
            'Not necessarily. Share details that could change the advice. Names, addresses and other people’s contact information are usually unnecessary.',
        },
        {
          question: 'What if I cannot identify my goal?',
          answer:
            'Ask for one question at a time with two or three options and space for your own answer. You can remain unsure.',
        },
        {
          question: 'Does a clear prompt guarantee a correct answer?',
          answer:
            'No. It can clarify the task, but the model may still miss a constraint or misuse a source. Check important claims.',
        },
      ],
      glossary: [
        {
          term: 'Observation',
          definition: 'Something you witnessed or have a record of, with its scope intact.',
        },
        {
          term: 'Inference',
          definition: 'An explanation that needs evidence beyond the observation itself.',
        },
        {
          term: 'Constraint',
          definition: 'A practical limit the answer should respect, such as time or missing data.',
        },
      ],
    },
    sources: [
      product(
        'src/lib/agent-guidance.ts',
        'Question drafting',
        '支持主题、目标、背景与方法如何组成提问草稿；完整工作和关系示例为原创练习。',
        'Supports how topic, goal, background and method form a draft. Work and relationship examples are original exercises.',
      ),
      product(
        'worker/agent.ts',
        'Clarification and interpretation rules',
        '支持逐个澄清、提供选择、不编造背景或他人动机，以及区分解释与事实的产品约束。',
        'Supports focused clarification, answer choices and rules against invented context or motives. These are product rules, not guarantees of every model response.',
      ),
    ],
  },
  'prepare-birth-details': {
    zh: {
      answer:
        '准备出生资料时，把日期、时刻、地点所用时区和资料来源分开记录。问卜八字与紫微都输入公历日期，但时间约定不同；资料不确定就保留不确定性，不能用默认时间填成“已知”，也不宜先把出生钟表时间自行改成真太阳时再重复校正。',
      takeaways: [
        '先核实公历、农历与闰月；本工具当前日期范围为 1901—2099 年。',
        '出生地当时的钟表时间和时区是一组信息，与现在居住的城市无关。',
        '未知时刻可以用于不含时柱的八字；紫微当前需要已知时刻，候选盘只能标为候选。',
      ],
      figure: {
        caption: '出生资料的四项核对：日期、时刻、时区与来源',
        description:
          '卡片选取清单前四项，分别列出日期所属历法、时刻的记录精度、出生地历史时区和资料来源的核对内容。下方完整表格另列换日约定、经度与校正、紫微参数，并说明各项不确定时怎样处理。',
      },
      table: {
        title: '排盘前可以逐项检查的清单',
        columns: ['项目', '需要核对的内容', '不确定时怎样处理'],
        rows: [
          [
            '日期',
            '年份、公历或农历；农历还要确认是否闰月。输入前换成公历。',
            '先查原记录和历法表；不要把“五月初五”直接输入成公历 5 月 5 日。',
          ],
          [
            '时刻',
            '原记录写的是几点几分，还是“清晨”“午饭前”等范围。',
            '八字选择时间未知；保留家人记忆的范围，不编造分钟。',
          ],
          [
            '时区',
            '八字使用出生地对应的时区及出生当天的历史规则。',
            '先确认出生城市；遇夏令时重叠或缺失时刻，需要核实明确偏移。',
          ],
          [
            '资料来源',
            '出生证明、医院记录、家庭笔记或口述；记录核实日期。',
            '把来源和误差范围写在自己的笔记中，勿把口述估计升级成证据。',
          ],
          [
            '换日约定',
            '八字可选零点换日或子初换日；比较结果时保持一致。',
            '先保留默认约定，尤其对 23 点附近的资料注明所用规则。',
          ],
          [
            '经度与校正',
            '只有八字开启近似真太阳时、且时刻已知时才需要经度。',
            '缺少可靠经度时不必开启；出生钟表时间作为原输入保留。',
          ],
          [
            '紫微参数',
            '已知当地时刻与当前算法使用的男/女参数；不沿用八字校正。',
            '时刻不明先学习示例；传统参数不用于定义性别认同。',
          ],
        ],
      },
      example: {
        title: '完整示例：记得“七点左右”，但记录跨了时辰边界',
        intro:
          '虚构练习资料：公历 2010 年 10 月 20 日，上海；家庭笔记记为 06:50，口述回忆可能是 07:10。两份信息目前无法确认哪份更可靠。',
        steps: [
          '先建立资料清单：“日期已确认是公历；城市上海；时刻有两个说法；家庭笔记与口述分别保留。”不把中间值 07:00 当成测量结果，也不根据哪份解读更顺耳选时间。',
          '在八字里选择 Asia/Shanghai，并先使用时间未知选项查看省略时柱的结果。注意页面的不确定性提示；未知时刻并不使交节日附近的年、月柱变得完全确定。',
          '若要学习差异，分别用 06:50 和 07:10 做两次候选计算，保持日期、时区、换日约定和校正设置相同。给两份记录明确标上“候选 A”“候选 B”，逐项比较真实返回的字段。',
          '暂不根据候选盘确定个人紫微命盘。先查原始出生记录；即使两种工具都出现差异，也不能用共同变化证明其中一个时刻是真的。',
          '查到新资料后，再记录来源并重新计算。保留旧候选与更正说明，导出时一起保存计算约定，方便以后核对不同工具为何给出不同结果。',
        ],
        conclusion:
          '资料准备的成果是一份能追溯来源、标注精度的输入，不是凑齐所有字段。对不确定时间，保留候选与边界比选出一个看似精确的答案更诚实。',
      },
      faq: [
        {
          question: '只知道农历生日，可以直接填吗？',
          answer:
            '当前输入框接收公历。先确认农历年份、月日及闰月，再用可靠历法表转换；香港天文台表可用于核对其覆盖范围内的公农历日期。',
        },
        {
          question: '人在国外，时区跟着手机选吗？',
          answer:
            '不跟着当前所在地。八字需要出生地当时使用的时间规则。紫微当前直接使用填入的当地日期与钟表时间，不能默认为它继承了八字的时区或校正设置。',
        },
        {
          question: '开启真太阳时就一定更准确吗？',
          answer:
            '不能这样承诺。问卜提供近似经度与均时差校正，属于明确的计算选择。已知同一出生瞬间时，它调整日、时所用时钟，年、月仍按绝对交节时刻判定；解释效果没有因此得到验证。',
        },
      ],
      glossary: [
        { term: '当地民用时间', definition: '出生地实际钟表使用的日期与时间，可能包含当时的夏令时安排。' },
        {
          term: '时区标识',
          definition: '如 Asia/Shanghai，指向一组随历史变化的当地时间规则，而非永远不变的数字偏移。',
        },
        {
          term: '候选输入',
          definition: '因原始资料未定而保留的一种可能输入；对应图表不应冒充已经确认的个人命盘。',
        },
      ],
    },
    en: {
      answer:
        'Record the date, local clock time, birthplace time zone and information source separately. Wenbu accepts Gregorian dates for BaZi and Zi Wei, but the tools use different time conventions. Preserve uncertainty instead of filling a default time, and avoid applying solar-time correction twice.',
      takeaways: [
        'Confirm the calendar and any leap month. The current tools accept dates from 1901 through 2099.',
        'Use the birthplace’s time rules on the birth date, not your current location.',
        'BaZi can omit an unknown hour. Zi Wei needs a known time; an uncertain chart remains a candidate.',
      ],
      figure: {
        caption: 'Check the date, time, time zone and source',
        description:
          'The cards select the first four checks: calendar type, recorded time and its precision, historical time-zone rules, and the information source. The complete table below adds day-boundary, longitude and Zi Wei settings, with guidance for uncertain inputs.',
      },
      table: {
        title: 'A birth-information checklist',
        columns: ['Item', 'What to check', 'If uncertain'],
        rows: [
          [
            'Date',
            'Year, calendar type and any lunar leap month.',
            'Check the original record and convert to Gregorian before entering.',
          ],
          [
            'Time',
            'An exact recorded time or an approximate range?',
            'Select unknown time for BaZi rather than inventing minutes.',
          ],
          [
            'Time zone',
            'The birthplace’s rules on the date, including historical daylight saving.',
            'Confirm the city; ambiguous clock times need a verified offset.',
          ],
          [
            'Source',
            'Certificate, hospital record, family note or recollection.',
            'Keep the source and uncertainty in your notes.',
          ],
          [
            'Day boundary',
            'Midnight or the start of Zi hour for BaZi.',
            'Retain the default initially and record it for comparisons.',
          ],
          [
            'Longitude',
            'Needed only for optional BaZi solar-time correction with a known time.',
            'Leave correction off if the location is uncertain.',
          ],
          [
            'Zi Wei parameters',
            'Known local time and the algorithm’s traditional sex parameter.',
            'Study a sample first; the parameter does not define gender identity.',
          ],
        ],
      },
      example: {
        title: 'Worked example: two possible times around seven in the morning',
        intro:
          'Fictional practice data: October 20, 2010, Shanghai. A family note says 06:50; a recollection suggests 07:10. Neither has yet been confirmed.',
        steps: [
          'Record both sources. Do not treat the midpoint, 07:00, as an observed time or choose whichever interpretation feels better.',
          'For BaZi, select Asia/Shanghai and begin with unknown time. Read the warnings: an omitted hour does not remove all uncertainty near a solar-term boundary.',
          'To study differences, calculate 06:50 and 07:10 separately with identical remaining settings. Label them candidate A and candidate B, then compare the fields actually returned.',
          'Do not present either as a confirmed personal Zi Wei chart. Look for the original birth record. Agreement between interpretations cannot establish a missing clock time.',
          'When better evidence arrives, note its source and calculate again. Preserve the earlier candidates and the conventions with your correction.',
        ],
        conclusion:
          'Preparation should produce traceable inputs with honest uncertainty, rather than a complete form filled with unsupported precision.',
      },
      faq: [
        {
          question: 'Can I enter a lunar birthday directly?',
          answer:
            'No. Confirm the lunar year, month, day and leap-month status, then convert. The Hong Kong Observatory offers calendar tables for its stated coverage.',
        },
        {
          question: 'Should I use my phone’s current time zone?',
          answer:
            'No. BaZi needs the birthplace’s historical rules. Zi Wei currently uses the entered local clock without importing BaZi’s time-zone or solar-time settings.',
        },
        {
          question: 'Does solar-time correction guarantee a more accurate reading?',
          answer:
            'No. For a fixed birth instant it adjusts the BaZi day/hour clock; year/month retain absolute solar-term boundaries. This convention does not validate an interpretation.',
        },
      ],
      glossary: [
        {
          term: 'Civil time',
          definition: 'The local clock date and time, including any applicable daylight saving.',
        },
        {
          term: 'Time-zone identifier',
          definition: 'A name such as Asia/Shanghai representing time rules that can change historically.',
        },
        { term: 'Candidate input', definition: 'One possible, explicitly unconfirmed set of birth details.' },
      ],
    },
    sources: [
      product(
        'src/lib/bazi.ts',
        'BaZi date and time conventions',
        '支持日期范围、未知时刻处理、时区校验及日时校正边界；不支持预测准确率的结论。',
        'Supports date limits, unknown-time handling, time-zone validation and correction scope; not predictive accuracy.',
      ),
      product(
        'src/lib/ziwei.ts',
        'Zi Wei input conventions',
        '支持当地钟表输入、传统性别参数与不继承八字校正的说明。',
        'Supports local clock input, the traditional sex parameter and the absence of BaZi corrections.',
      ),
      {
        title: 'Hong Kong Observatory · Gregorian-Lunar Calendar Conversion Table',
        url: 'https://www.hko.gov.hk/en/gts/time/conversion.htm',
        noteZh:
          '提供 1901—2100 年公农历对照；用于核对历法日期，不用于验证命理解读。问卜当前输入范围另有限制。',
        noteEn:
          'Provides calendar conversion tables for 1901–2100, not validation of readings. Wenbu has its own narrower input range.',
      },
      {
        title: 'IANA · Time Zone Database',
        url: 'https://www.iana.org/time-zones',
        noteZh: '支持时区数据库记录各地历史偏移与夏令时规则的说明；本节没有把当前偏移当成终身不变。',
        noteEn:
          'Explains historical local-time, UTC-offset and daylight-saving rules. A current offset is not assumed to apply to every birth date.',
      },
    ],
  },
  'read-ai-with-sources': {
    zh: {
      answer:
        '核查 AI 解读时，一次挑一句重要结论，确认它属于计算、传统解释还是个人推测，再查看来源是否真的支持这句话。找到网页标题、读到一段原文、验证个人预测是三件不同的事；引用数量不能代替逐条核对。',
      takeaways: [
        '计算规则查产品实现或算法文档；传统含义查具体著作；个人推测需回到现实资料。',
        '保留来源的读取范围与失败状态。读了摘要不能写成读完全文。',
        '要求报告区分已支持、未支持和待核实的句子，再决定哪些内容值得保存。',
      ],
      figure: {
        caption: '四类待核查的句子',
        description:
          '卡片选取计算结果、传统解释、个人推测和未读取引用四类例句。它们是待检查的说法，不代表这些结论已经成立。下方完整表格加入精确百分比这一类，并逐项说明核查方法和不能推出的结论。',
      },
      table: {
        title: '五类句子，五种核查方式',
        columns: ['句子类型', '示例', '该怎样查 / 不能推出什么'],
        rows: [
          [
            '计算结果',
            '这份结果中可见干支的水计数为 0。',
            '核对原图与统计口径；不能直接推出藏干中无水或日主强弱。',
          ],
          [
            '传统解释',
            '某流派将一个符号与某种主题联系起来。',
            '查具体书名、章节与取法；不能把某流派说法写成所有传统的共识。',
          ],
          [
            '个人推测',
            '所以你应离开当前行业。',
            '检查现实目标、能力和限制；前两类资料都没有自动证明这项建议。',
          ],
          [
            '未读取引用',
            '找到一篇网页，因此已证实上述结论。',
            '打开实际正文，检查是否成功读到有关段落；标题或读取失败不算内容证据。',
          ],
          [
            '精确百分比',
            '你换工作成功的概率是 87%。',
            '询问事件定义、数据集和验证方法；没有这些就不能把数字当测量结果。',
          ],
        ],
      },
      example: {
        title: '完整示例：检查“图上缺水，所以必须换行业”',
        intro:
          '假设你读到这句话。先把它当成待审查的说法，而不是现实建议。下面演示核查过程；并未假定你本人有这张命盘。',
        steps: [
          '拆成三个主张：图表中水的计数为零；零计数等于传统意义上的“需要补水”；补水意味着必须换行业。它们需要不同依据，不能因为出现在同一句话里就一起成立。',
          '核对真实图表与问卜方法：当前五行图逐个统计可见天干和地支，没有把藏干、季节和强弱加权。即使第一项计数正确，第二项也没有因此得到计算支持。',
          '请 Agent：“为每个主张列出直接支持它的来源与已读段落；没有支持就标为待核实。”若只读到一篇手册，应标为问卜的编辑性说明；若外部资料打不开，保留失败，不补造引文。',
          '改写可保留的结论：“在这份输入和统计口径下，图中的可见水计数为零。该图不是喜用神判断，也不能据此决定职业。”再把职业问题改成需要调查的条件，而不是继续替这个结论找引文。',
          '保存这版带限定的说明，并留下原来的错误句子与更正原因。以后换一个输入或统计方法，要重新核对，不能复用旧图的计数。',
        ],
        conclusion:
          '这次核查没有产出“哪种职业最旺”的答案，但排除了一个没有根据的推导。能清楚说明尚未证明什么，也是一份研究报告的重要产物。',
      },
      faq: [
        {
          question: '只要链接真实，回答就可信吗？',
          answer:
            '还需要检查相关性：原文是否支持这个具体主张、条件是否一致、是否省略了限制。真实的历法文档并不自动支持附在它后面的职业预测。',
        },
        {
          question: '多个来源都这么说，算验证了吗？',
          answer:
            '先看是否互相转述，以及讨论的是同一件事。几个站点重复一种传统解释，可以说明说法的传播，不能单凭重复证明它对个人未来有效。',
        },
        {
          question: '问卜的来源标记保证了什么？',
          answer:
            '它帮助定位当前资料与读取状态，不保证所有生成文字都正确。研习范围仍限于内部库和精选目录；NIST 的生成式 AI 风险文件也明确讨论了自信输出错误内容及核验引用的必要性。',
        },
      ],
      glossary: [
        { term: '直接支持', definition: '来源讨论了当前主张本身，并且条件和范围匹配；仅主题相近还不够。' },
        {
          term: '读取范围',
          definition: '实际拿到的是摘要、有限片段还是更完整的文本；不能把一种范围写成另一种。',
        },
        { term: '待核实', definition: '现有材料不足以确认的状态；它不是错误的同义词，也不应默认为正确。' },
      ],
    },
    en: {
      answer:
        'Check one important sentence at a time. Identify whether it reports a calculation, a tradition or a personal inference, then inspect the evidence for that exact claim. Finding a title, reading an excerpt and validating a prediction are different achievements. A long reference list cannot substitute for that distinction.',
      takeaways: [
        'Match the source to the claim: implementation for calculations, texts for traditions and real information for personal conclusions.',
        'Keep track of what was actually read. A summary is not a full-work review.',
        'Separate supported, unsupported and unresolved statements before saving a report.',
      ],
      figure: {
        caption: 'Four kinds of statement to check',
        description:
          'These cards select four types of example: a calculation, a traditional interpretation, a personal inference and an unread citation. The statements are claims to examine, not established conclusions. The complete table below adds precise percentages and explains the checks and limits for all five types.',
      },
      table: {
        title: 'What kind of claim are you checking?',
        columns: ['Type', 'Example', 'Check and limit'],
        rows: [
          [
            'Calculation',
            'This result counts zero visible Water characters.',
            'Compare the chart and counting method. This does not measure hidden stems or strength.',
          ],
          [
            'Tradition',
            'A school associates this symbol with a particular theme.',
            'Check the work and passage. One school is not every tradition.',
          ],
          [
            'Personal inference',
            'Therefore, you should change industries.',
            'Examine your goals and circumstances. The preceding sources do not establish this advice.',
          ],
          [
            'Unread citation',
            'A page was found, so the conclusion is verified.',
            'Check that relevant text was actually retrieved. A title or failed read is insufficient.',
          ],
          [
            'Precise percentage',
            'Your job change has an 87% chance of success.',
            'Ask for the event definition, data and validation. Precision alone is not measurement.',
          ],
        ],
      },
      example: {
        title: 'Worked example: “No Water means you must change industries”',
        intro: 'Treat this fictional sentence as a claim to review, not advice about your own chart.',
        steps: [
          'Split it into three claims: the count is zero; zero means Water is favorable; a favorable element dictates a career change. Each needs separate support.',
          'Check the chart and method. Wenbu counts visible stems and branches without weighting hidden stems, season or strength. A correct count does not establish the second claim.',
          'Ask for a source and a read passage for each claim. Label a Wenbu guide as editorial material. If an external page could not be read, retain that gap.',
          'Keep only the supported statement: “Under these inputs and counting rules, the visible Water count is zero. This is not a favorable-element assessment or a career recommendation.”',
          'Save the correction and why it was needed. A changed input or counting method requires a fresh check, rather than reuse of the old count.',
        ],
        conclusion:
          'Removing an unsupported inference is a useful research result, even when it produces no definitive career answer.',
      },
      faq: [
        {
          question: 'Is a real link enough?',
          answer:
            'No. Its relevant passage must support the particular statement and its conditions, rather than merely discuss a related topic.',
        },
        {
          question: 'Do several agreeing sources validate a claim?',
          answer:
            'Check whether they repeat one another. Repetition can document a tradition’s spread without validating a personal prediction.',
        },
        {
          question: 'What does a Wenbu source label guarantee?',
          answer:
            'It helps identify material and reading status, not perfect output. Research remains limited to the collection. NIST also identifies confident false output as a generative-AI risk.',
        },
      ],
      glossary: [
        {
          term: 'Direct support',
          definition: 'Evidence addressing the claim itself under matching conditions.',
        },
        {
          term: 'Reading scope',
          definition: 'The text actually available: a summary, excerpt or fuller work.',
        },
        {
          term: 'Unresolved',
          definition: 'Not established by the available evidence; neither automatically false nor true.',
        },
      ],
    },
    sources: [
      product(
        'src/lib/bazi.ts',
        'Visible element counts',
        '直接支持五行图只统计可见干支、未加权藏干季节与强弱的口径；职业示例为本文假设。',
        'Directly supports the visible-character counting method and excluded factors. The career sentence is a fictional audit example.',
      ),
      product(
        'worker/agent-library.ts',
        'Source access and reading scope',
        '支持资料库、外部目录限制和公开片段的读取范围。',
        'Supports the internal collection, external allowlist and public-excerpt reading limits.',
      ),
      product(
        'worker/agent.ts',
        'Source and report rules',
        '支持区分搜索摘要与已读来源、保留失败及标注推断的产品要求；要求不代表每条输出都无误。',
        'Supports product requirements for read sources, failure disclosure and labeled inference; requirements do not guarantee error-free output.',
      ),
      nist,
    ],
  },
  'review-a-reading': {
    zh: {
      answer:
        '复盘一份解读时，先保留当时的问题和理解，再记录实际行动、新增事实与没有对应上的部分。给自己约定一个回看日期，把后来知道的结果补在新段落中；不要为了让解读显得命中，改写最初的意思。',
      takeaways: [
        '原问题、当时理解和事后结果分开记录，尤其保留当时不知道的事情。',
        '行动要可观察，也要允许结果是“不合适”“没帮助”或“暂时无法判断”。',
        '手记和 Agent 会话各自导出；回看提醒需要自行设置，网站不会在指定日期主动来找你。',
      ],
      figure: {
        caption: '复盘记录中的四个示例字段',
        description:
          '卡片选取原问题、初始理解、行动与日期、新增事实四个字段，分别配上课程试学的虚构示例。下方完整表格还包含“没有对应”和“修订决定”，并给出各字段的检查要点。示例用时不是用户的实际记录。',
      },
      table: {
        title: '可以复制到笔记里的复盘字段',
        columns: ['字段', '课程试学示例', '检查要点'],
        rows: [
          [
            '原问题',
            '是否报名八周课程？预算已知，但不清楚实际作业时间。',
            '保留当时真正犹豫的事；不要事后换成更容易“命中”的问题。',
          ],
          [
            '初始理解',
            '我把“先练习再承诺”理解为先做试听，并非一定会报名。',
            '写清是自己的联想还是报告原句；别混作已证实事实。',
          ],
          [
            '行动与日期',
            '周六完成一节免费试听，记录听课和作业各花多久。',
            '行动必须能核实；未完成就如实写未完成。',
          ],
          [
            '新增事实',
            '听课 45 分钟，练习另花 90 分钟；当前每周只有两小时。',
            '这里是示例结果；自己的记录应填实际情况，不补造数据。',
          ],
          [
            '没有对应',
            '关于“缺乏自信”的解释没有新证据，主要困难仍是时间。',
            '反例与无帮助部分同样保留，不只收藏喜欢的句子。',
          ],
          [
            '修订决定',
            '暂不报名，先试两周短练习，再比较另一种学习安排。',
            '写明改变决定的是哪条信息，而不是笼统说“牌早就知道”。',
          ],
        ],
      },
      example: {
        title: '完整示例：一周后回来，发现原来的理解需要改',
        intro:
          '下面沿用课程试听的虚构场景。这是一种记录方法，不是问卜已验证的改善效果，也不是用于计算占卜准确率的实验。',
        steps: [
          '当天保存原始工具结果，在手记的笔记里写：“9 月 30 日：我以为主要问题是怕坚持不下来；先试听，尚未报名。”如果讨论只发生在 Agent，会话在另一处保存，需要另外导出。',
          '把回看日期设在自己的日历中，先定义要记录的事情：是否完成试听、总用时、是否仍感兴趣。不要只用“感觉准不准”作为检查项。',
          '一周后追加：“10 月 7 日：完成试听，内容仍有兴趣；听课和练习比预计更费时间。”保留第一段，不把它改成“我早就知道时间才是关键”。',
          '列出至少一个替代解释：也许困难来自课程节奏与现有安排冲突，而不来自人格缺点。区分试听带来的新事实和解读引出的联想。',
          '记录下一步并导出备份：“先做两周短练习，暂缓报名。”如果没有做试听，则写清未完成原因，安排可行的替代动作；不能凭没有观察到的结果评价原建议。',
        ],
        conclusion:
          'Fischhoff 的原始研究显示，知道结果会影响人们对当初可预测性的判断。本节借这个提醒设计记录习惯；没有声称一份手记就能消除偏差。',
      },
      faq: [
        {
          question: '手记会自动保存修改历史吗？',
          answer:
            '当前笔记是一个可编辑字段，不提供笔记版本追踪。想保留前后变化，就自行追加带日期的新段落，并在重要修改前导出备份；单条笔记还有长度限制。',
        },
        {
          question: '我没采取行动，还有复盘价值吗？',
          answer:
            '有。可以记录为什么没有做：条件改变、建议不合适、缺少时间，或你改变了主意。不要把未执行后的结果当成对这项建议有效性的直接测试。',
        },
        {
          question: '删了本地手记，会同时删除模型处理过的数据吗？',
          answer:
            '不会。删除游客手记移除的是当前浏览器中的记录，账号云端记录有独立的删除操作。此前发送给 DeepSeek 的内容按提供方政策处理；主动提交的反馈和统计也有各自的存储规则，不能用本地删除一概代表。',
        },
      ],
      glossary: [
        {
          term: '事后偏差',
          definition: '得知结果后，觉得当时的结果比实际更容易预见，并可能重新理解原有信息。',
        },
        { term: '替代解释', definition: '同一结果的其他可能原因，例如时间冲突、信息更新或自己的行动。' },
        {
          term: '回顾记录',
          definition: '把原理解与新增事实并列保留的笔记；不同于为原解读寻找一个必然正确的结尾。',
        },
      ],
    },
    en: {
      answer:
        'Keep the original question and interpretation before recording actions, new information and anything that did not fit. Set your own review date and add a new dated paragraph afterward. Do not rewrite the first interpretation to make it match the outcome.',
      takeaways: [
        'Separate what you believed then from what you learned later, including what was unknown.',
        'Track observable actions and allow “unhelpful,” “unsuitable” or “not yet known” as outcomes.',
        'Export journals and Agent conversations separately. Set reminders yourself; Wenbu does not follow up on a future date.',
      ],
      figure: {
        caption: 'Four example fields from a review record',
        description:
          'The cards select the original question, initial interpretation, action and date, and new information, each with a fictional course example. The complete table below also includes what did not fit and a revised decision, with checks for every field. The sample times are not observations from a user.',
      },
      table: {
        title: 'A review template you can copy into a note',
        columns: ['Field', 'Course example', 'What to check'],
        rows: [
          [
            'Original question',
            'Should I join an eight-week course? I know the fee, not the workload.',
            'Keep the question you actually asked.',
          ],
          [
            'Initial interpretation',
            'Try a lesson before committing; enrollment is still undecided.',
            'Separate your association from the report’s wording.',
          ],
          [
            'Action and date',
            'Try a free lesson on Saturday and record lesson and exercise time.',
            'Record what happened, including an action not taken.',
          ],
          [
            'New information',
            'Lesson: 45 minutes. Exercise: 90 minutes. I have two hours a week.',
            'These are fictional figures; record your own observations.',
          ],
          [
            'What did not fit',
            'There is no new evidence for the claim about low confidence.',
            'Keep unhelpful statements as well as apparent matches.',
          ],
          [
            'Revised decision',
            'Delay enrollment and try two weeks of shorter exercises.',
            'Identify the information that changed your decision.',
          ],
        ],
      },
      example: {
        title: 'Worked example: returning a week later with a different understanding',
        intro:
          'This fictional course example demonstrates a record-keeping practice. It is not a validated Wenbu intervention or a test of predictive accuracy.',
        steps: [
          'Save the tool result and write: “September 30: I think I am worried about sticking with it. I will try a lesson; I have not enrolled.” Export a separate Agent discussion if you want that too.',
          'Set a calendar reminder. Decide what to observe: whether you completed the lesson, total time and continued interest. “Did it feel accurate?” is not enough.',
          'Append: “October 7: I completed the lesson and remain interested, but the exercises took longer than expected.” Keep the earlier note rather than changing it to imply you always knew.',
          'Consider another explanation: the course pace may conflict with your schedule. Distinguish information from the trial from associations prompted by the reading.',
          'Record your next decision and export a backup. If you never tried the lesson, record why; do not evaluate its usefulness using an outcome you did not observe.',
        ],
        conclusion:
          'Fischhoff’s original research showed that knowing outcomes can change judgments of their earlier predictability. That motivates this practice; it does not prove journaling removes bias.',
      },
      faq: [
        {
          question: 'Does the journal keep note versions?',
          answer:
            'No. It has an editable note field with a length limit. Append dated paragraphs and export before important edits if you need a record of changes.',
        },
        {
          question: 'Is a review useful if I took no action?',
          answer:
            'Yes. Record what prevented it or changed your mind, without treating nonexecution as a direct test of the advice.',
        },
        {
          question: 'Does local deletion erase model-provider data?',
          answer:
            'No. Removing a guest record deletes its browser copy. Account history has separate deletion controls. DeepSeek processing, submitted feedback and analytics each follow their own policies.',
        },
      ],
      glossary: [
        {
          term: 'Hindsight bias',
          definition: 'Seeing an outcome as more foreseeable after learning what happened.',
        },
        {
          term: 'Alternative explanation',
          definition: 'Another possible reason for an outcome, including your own actions.',
        },
        {
          term: 'Review record',
          definition: 'A dated comparison of the initial view and newly observed facts.',
        },
      ],
    },
    sources: [
      product(
        'src/components/Journal.tsx',
        'Journal editing and export',
        '支持可编辑笔记、长度限制、删除撤销与 JSON 导出；当前没有笔记版本历史。',
        'Supports note editing, its length limit, removal/undo and JSON export; there is no note version history.',
      ),
      product(
        'src/data/pages.ts',
        'Local records and privacy',
        '支持浏览器记录、可选账号云端保存与模型、反馈、统计分别处理的说明，以及关闭页面会中断任务的边界。',
        'Supports separate handling of local records, model processing, feedback and analytics, and limits on sync and background work.',
      ),
      {
        title: 'Fischhoff (1975) · Hindsight ≠ Foresight',
        url: 'https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Behavioral_Decision_Theory/Fischhoff_1975_Hindsight_is_not_equal_to_foresight.pdf',
        noteZh:
          '原始实验论文说明结果知识怎样改变事后判断；本文的课程记录练习是编辑建议，不是该论文验证过的干预。',
        noteEn:
          'The original experiments concern how outcome knowledge changes judgment. The course-journal exercise is editorial guidance, not an intervention tested in the paper.',
      },
    ],
  },
  'ai-divination': {
    zh: {
      answer:
        'AI 解读让你感到贴切，可能来自已提供的背景、普遍适用的描述、你自己的联想，也可能来自确实有帮助的整理。要判断“准确”，先说清测的是什么：计算是否按规则复现、来源是否支持句子，还是某项未来预测是否经过独立检验。三者不能混为一个分数。',
      takeaways: [
        '计算正确、文字有共鸣、建议有帮助，是不同维度，应分别检查。',
        '模型记住你刚说的顾虑并不神秘；先排除信息复述与宽泛描述，再讨论新发现。',
        '没有事件定义、样本、基线和验证方法的“准确率”，不能作为产品能力证据。',
      ],
      figure: {
        caption: '四种可能让解读显得贴切的体验',
        description:
          '卡片选取背景复述、计算复现、主观共鸣和实际帮助四个维度，各配一条具体例子。这四项没有呈现预测检验结果。下方完整表格另列“预测表现”，说明各维度分别需要检查什么。',
      },
      table: {
        title: '把“准”拆成可以分别讨论的问题',
        columns: ['维度', '看起来贴切的例子', '真正需要检查什么'],
        rows: [
          [
            '背景复述',
            '你说最近加班，回答说你可能需要休息。',
            '这是利用已知输入，不是独立发现未提供的人生事实。',
          ],
          [
            '计算复现',
            '同一日期与同一换日约定得到同样四柱。',
            '核对输入、规则与软件版本；只支持计算一致性。',
          ],
          [
            '主观共鸣',
            '你既希望独立，也希望被理解。',
            '哪些具体行为符合？哪些不符合？这句话能否适用于很多人？',
          ],
          [
            '实际帮助',
            '回答帮你写出了愿意发送的沟通开场白。',
            '记录它怎样帮助完成任务；有帮助不等于能预测对方反应。',
          ],
          [
            '预测表现',
            '断言某件事将在固定期限内发生。',
            '事先定义事件与期限、记录全部结果，并与合理基线比较；个别命中不足以验证。',
          ],
        ],
      },
      example: {
        title: '完整示例：审阅一句让你觉得“被看穿”的话',
        intro:
          '虚构回答：“你一直独立承担很多责任，却也希望有人真正理解你；接下来会迎来一次转机。”不要急着接受或否认，先逐段检查它提供了什么。',
        steps: [
          '回看自己已提供的信息。如果前面写了“我最近独自负责一个项目”，那么“承担很多责任”有明确输入来源，应标为复述或概括，不是模型看到了未分享的经历。',
          '检查宽泛部分：“独立”与“希望被理解”可以并存，也可能适用于很多人。写一个支持的实际例子，再写一个反例，比如主动求助或喜欢合作的时刻。不要只找符合的记忆。',
          '检查“转机”：具体指什么、何时、怎样算没有发生？如果没有限定，它很容易事后套到各种变化上。不要替含糊句子补成一条原本并未提出的精确预测。',
          '要求改写：“请标出哪些话来自我的输入，哪些是一般性联想；去掉没有证据的未来断言。围绕我现在的项目，给两个可核对的沟通问题。”',
          '留下有用部分及边界：“我想问负责人哪些事项能请同事协助；目前没有证据说明未来必然出现转机。”后续评价的是这两个问题是否帮助沟通，而不是用一次巧合证明整套系统。',
        ],
        conclusion:
          '可以保留被理解的感受，也可以严格审查事实。Forer 的研究提醒人们不要用个人认同直接验证人格判断；它没有测试今天的 DeepSeek，也没有给出问卜的准确率。',
      },
      faq: [
        {
          question: 'AI 引用经典，能证明它预测得准吗？',
          answer:
            '经典出处可以支持某种传统含义确实存在；预测效果需要另外的检验。先确认引文真实、读取范围清楚，再问它是否真的支持关于你的那条结论。',
        },
        {
          question: '为什么换一种问法，答案可能不同？',
          answer:
            '问题与上下文会影响生成内容，生成过程也可能变化。若原始命盘和规则没变，却出现不同解释，先比较它们采用了哪些前提；不要把语言差异当成命运改变。',
        },
        {
          question: '问卜有没有经过验证的个人预测准确率？',
          answer:
            '本文没有可据以报告此类准确率的验证研究，因此不提供数字。可以核对公开计算约定、来源与产品行为；这与证明对个人未来的预测表现是不同工作。',
        },
      ],
      glossary: [
        {
          term: '个人认同',
          definition: '读者认为某句话贴近自己的感受；能说明体验，不能单独证明描述具有区分力。',
        },
        {
          term: '基线',
          definition:
            '评估预测时用于比较的参照方法，例如按已知常见发生率作判断；没有比较，难知是否提供了额外信息。',
        },
        {
          term: '生成错误',
          definition: '模型把错误、无依据或与输入矛盾的内容表达成答案；流畅和自信不能排除它。',
        },
      ],
    },
    en: {
      answer:
        'An AI reading may feel accurate because it uses details you supplied, offers a broadly applicable description or helps you organize a real concern. First define what you are evaluating: reproducible calculation, a supported statement, practical usefulness or a tested prediction. These are different questions, not one accuracy score.',
      takeaways: [
        'Check calculation, personal resonance and usefulness separately.',
        'Recognizing a concern you already shared is not the discovery of an undisclosed fact.',
        'An accuracy percentage needs defined outcomes, data, a baseline and a validation method.',
      ],
      figure: {
        caption: 'Four ways a reading can seem to fit',
        description:
          'The cards select restated context, reproducible calculation, personal resonance and practical help, with an example of each. None presents a predictive test result. The complete table below adds predictive performance and explains what evidence each of the five dimensions requires.',
      },
      table: {
        title: 'Five different things to evaluate',
        columns: ['Dimension', 'Example', 'What it establishes'],
        rows: [
          [
            'Restated context',
            'You mention overtime; the answer suggests rest.',
            'Use of supplied information, not independent discovery.',
          ],
          [
            'Reproducible calculation',
            'Identical dates and conventions produce identical pillars.',
            'Consistency under specified inputs, rules and software versions.',
          ],
          [
            'Personal resonance',
            'You value independence and also want understanding.',
            'Ask for examples and counterexamples, and how widely the description applies.',
          ],
          [
            'Practical help',
            'The answer helps you write a message you can use.',
            'Usefulness for a task, not prediction of the recipient’s response.',
          ],
          [
            'Predictive performance',
            'An event is said to occur within a fixed period.',
            'Needs predefined outcomes, complete records and a meaningful comparison baseline.',
          ],
        ],
      },
      example: {
        title: 'Worked example: checking a sentence that feels uncannily personal',
        intro:
          'Consider this fictional reply: “You carry many responsibilities independently, yet want someone to understand you. A turning point is coming.” Review each part before accepting it.',
        steps: [
          'Check your earlier messages. If you wrote that you were managing a project alone, the responsibility statement has an input source. Mark it as a summary rather than hidden insight.',
          'Examine the broad description. Independence and wanting understanding can coexist for many people. Note a fitting example and a counterexample, such as a time you actively sought collaboration.',
          'Ask what “turning point” means, by when, and what would count against it. Do not retrospectively turn a vague phrase into a precise prediction it never made.',
          'Request a revision: “Separate my supplied details from general associations. Remove the unsupported future claim and give me two questions to discuss about the project.”',
          'Keep the useful result and its limit: “I can ask which tasks a colleague could share. I have no evidence of an inevitable turning point.” Assess whether the questions help, without treating a later coincidence as validation of the entire system.',
        ],
        conclusion:
          'Forer’s work cautions against using personal agreement alone to validate a personality interpretation. It did not test modern DeepSeek models or establish a Wenbu accuracy rate.',
      },
      faq: [
        {
          question: 'Does a classical citation prove predictive accuracy?',
          answer:
            'It may document a traditional meaning. It still needs verification as a citation and cannot, by itself, establish a personal prediction.',
        },
        {
          question: 'Why can rephrasing change the answer?',
          answer:
            'Prompts and context influence generated interpretations. Compare their assumptions; different prose does not mean your underlying chart or future has changed.',
        },
        {
          question: 'Is there a validated personal-prediction accuracy rate for Wenbu?',
          answer:
            'This guide has no validation study supporting such a rate and reports none. Public calculation conventions and product behavior can be checked separately.',
        },
      ],
      glossary: [
        {
          term: 'Personal agreement',
          definition:
            'Feeling that a description fits; this alone does not show that it distinguishes you from others.',
        },
        {
          term: 'Baseline',
          definition: 'A comparison method used to judge whether a prediction adds information.',
        },
        {
          term: 'Confabulation',
          definition:
            'Generated content that is false, unsupported or inconsistent with the input, even when confidently expressed.',
        },
      ],
    },
    sources: [
      {
        title: 'Forer (1949) · The fallacy of personal validation',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18110193/',
        noteZh:
          '原始人格判断研究的书目记录，用于定位个人认同不等于独立验证这一研究背景；不是现代大模型或问卜的测试。',
        noteEn:
          'Bibliographic record for the original personal-validation study. It is historical research context, not a test of modern language models or Wenbu.',
      },
      nist,
      product(
        'worker/ai.ts',
        'AI reading input and interpretation rules',
        '支持模型接收既有计算结果及用户背景、按象征方式解释的产品设计；不能据提示词承诺输出永不犯错。',
        'Supports supplying calculated results and user context for symbolic interpretation; prompt rules do not guarantee correct output.',
      ),
      product(
        'worker/agent.ts',
        'Agent evidence and uncertainty rules',
        '支持区分计算、传统解释与个人推测，并禁止编造精确预测、来源和未提供经历的要求。',
        'Supports the requirements to distinguish calculation, tradition and inference, and to avoid invented predictions, sources or personal history.',
      ),
    ],
  },
};
