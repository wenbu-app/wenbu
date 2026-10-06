import type { Article } from './articles';
export const integrationArticles: Article[] = [
  {
    slug: 'connect-your-agent',
    category: 'blog',
    symbol: '连',
    minutes: 6,
    tool: 'agent',
    published: '2026-10-03',
    updated: '2026-10-03',
    sources: [
      {
        title: 'Wenbu · open MCP implementation and reproducible examples',
        url: 'https://github.com/wenbu-app/wenbu/tree/main/integrations/mcp',
      },
      {
        title: 'Model Context Protocol · remote servers',
        url: 'https://modelcontextprotocol.io/registry/remote-servers',
      },
      { title: 'Wenbu · complete bilingual knowledge index', url: 'https://wenbu.app/knowledge/index.json' },
    ],
    zh: {
      title: '把问卜接入你的 Agent：先跑通一个不需要私人资料的例子',
      description:
        'MCP、CLI 和 Skill 分别做什么？用固定六爻验证第一次调用，再学习完整资料读取、来源核验与上下文选择。',
      sections: [
        {
          heading: '先选连接方式，再谈模型',
          paragraphs: [
            '已经有自己的 Agent，可以连接 https://wenbu.app/mcp。问卜提供六个工具，返回实际计算、抽取结果和原始学习内容；你的宿主仍使用自己的模型。MCP 不会替你调用问卜的 AI，也不需要问卜账户或模型密钥。',
            '如果希望在终端或程序中读取 JSON，选无需依赖的 CLI。Skill 则是操作说明，帮助 Agent 选择工具、核验来源与处理你决定分享的资料；安装 Skill 不会自动配置 MCP。想让问卜自己研究问题，可以直接打开内置 Agent。接入页同时提供这三种入口。',
          ],
        },
        {
          heading: '第一个结果：六个 7，一份可以复核的输出',
          paragraphs: [
            '先使用固定六爻 [7,7,7,7,7,7]，不填写生日，也不随机起卦。这六个阳爻自下而上排列，本卦应为第 1 卦「乾」，动爻列表为空。这个例子只验证工具调用与数据格式，不是给你的一次占问。',
            '在 MCP 中调用 cast_iching，参数是 lines 和 locale:"zh"。在 CLI 中运行 node wenbu.mjs iching 并传入相同 JSON。完整可复制命令和请求文件位于本页来源中的开源 quickstart，以及网站「Agent 接入」页。检查 structuredContent 或 CLI JSON，不要仅凭模型复述来判断成功。',
          ],
        },
        {
          heading: '第二步：搜到资料之后，真正读它',
          paragraphs: [
            '调用 search_library 搜索一个概念，例如八字换日。搜索结果会返回编号和条目类别。对于 guide 或 symbol，将编号交给 read_library；原创手册可以返回完整正文、目录、案例、图示说明和来源链接。',
            '如果只读某一章，使用返回目录中的章节编号，保留 scope:"section"。21 篇原创手册都有中英文 HTML、Markdown 和 JSON，从同一内容生成。外部 reference 条目只提供出处信息，MCP 没有 read_reference；你的宿主需要打开外部页面后，才能引用它的正文。搜索摘要不能充当阅读凭据。',
          ],
        },
        {
          heading: '从合成示例转向自己的问题',
          paragraphs: [
            '易经与塔罗不要求出生信息。八字需要公历日期、当地时刻或明确的未知时辰、IANA 时区，以及可核对的换日约定。紫微需要已知的当地时刻和传统排盘参数，目前不自动修正真太阳时。不要为了完成调用猜测缺失信息。',
            '真实资料在 CLI 中应通过指定文件或标准输入传入，避免留在命令历史。问卜 CLI 不会自动扫描文件、读取其他对话或同步手记。内置 Agent 会将你选择发送的消息与上下文交给 AI，调用前应理解这一数据流。',
          ],
        },
        {
          heading: '遇到错误，先读状态与约定',
          paragraphs: [
            '字段无效时先改输入；遇到 429 按提示等待。不要自动重试 AI 请求，失败也可能消耗额度。Agent 的 complete 表示一回合完成，waiting 表示需要补充，limited 表示预算不足；断流缺少终止事件不能算成功。',
            '问卜返回的是传统符号与可复核计算约定，不能把历法算对直接推导为未来预测可靠。保留警告、结果范围与来源，把解释转化为你可以检验和行动的问题。需要重复使用时，保存已有结果并围绕它追问，而不是不断重新抽取。',
          ],
        },
      ],
    },
    en: {
      title: 'Connect your agent to Wenbu: start with a reproducible, non-personal example',
      description:
        'Choose MCP, CLI or an Agent Skill, verify a fixed I Ching result, then read complete guides with clear source scope and chosen context.',
      sections: [
        {
          heading: 'Choose the connection before the model',
          paragraphs: [
            'If you already use an agent, connect it to https://wenbu.app/mcp. Six tools return actual calculations, draws and original learning content. Your host keeps using its own model. Wenbu MCP does not call Wenbu’s AI service and requires no account or model key.',
            'Use the dependency-free CLI when a script or terminal needs JSON. The Skill is an instruction file: it helps an agent choose tools, check sources and handle context you choose to share. Installing it does not configure MCP. For Wenbu to research a question itself, open the built-in Agent. The integration page explains all three paths.',
          ],
        },
        {
          heading: 'Your first result: six 7s and an output you can check',
          paragraphs: [
            'Supply the fixed lines [7,7,7,7,7,7]. No birth information or random cast is involved. Ordered from bottom to top, these six yang lines should produce hexagram 1, Qian, with an empty changing-line list. This tests the connection and data format; it is not a personal reading.',
            'Call cast_iching through MCP with lines and locale:"en", or run node wenbu.mjs iching with the same JSON. Copyable commands and request files are in the open-source quickstart linked below and on the Agent integrations page. Check structuredContent or the CLI JSON rather than relying on a model’s description of the result.',
          ],
        },
        {
          heading: 'Next, read what you find',
          paragraphs: [
            'Search for a concept such as the BaZi day boundary with search_library. Results include IDs and entry types. Pass a guide or symbol ID to read_library. Original guides return complete text, an outline, worked examples, diagram descriptions and source links.',
            'To read one section, use its ID from the returned outline and preserve scope:"section". All 21 original guides have Chinese and English HTML, Markdown and JSON editions drawn from the same content. External reference entries contain metadata only. MCP has no read_reference tool: your host must open the external page before citing its contents. A search snippet does not establish that a source was read.',
          ],
        },
        {
          heading: 'Move from a synthetic example to your own question',
          paragraphs: [
            'Tarot and the I Ching need no birth details. BaZi needs a Gregorian date, recorded local time or explicitly unknown time, an IANA time zone and a visible day-boundary convention. Zi Wei needs a known local civil time and the traditional calculation parameter; it does not automatically apply a solar-time correction. Do not guess missing information to finish a call.',
            'For personal CLI input, use a named file or stdin to keep it out of shell history. The CLI does not scan folders, read other conversations or sync a journal. The built-in Agent sends the message and context you select to AI. Understand that data flow before choosing it.',
          ],
        },
        {
          heading: 'Read the outcome before retrying',
          paragraphs: [
            'Correct invalid fields first, and back off on HTTP 429. Do not automatically retry AI requests; a failed request may still use an allowance. An Agent complete status means one turn finished, waiting means it needs more input, and limited means the work budget ran out. A stream without a terminal event is incomplete.',
            'Wenbu returns cultural symbols and checkable calculation conventions. Correct calendar arithmetic does not establish reliable prediction. Keep the warnings, source scope and existing result, then use the interpretation to frame questions you can examine and act on. Save a draw and explore it through follow-ups rather than repeatedly drawing for a preferred answer.',
          ],
        },
      ],
    },
  },
];
