import { browserAudienceSQL, serviceRequestSQL } from './traffic-contract';

/** Shared by totals, curves, breakdowns and quality checks. No identity or prompt data. */
export const measurementVersion = '2026-10-15-daily-v1';
export const productSuccessSQL =
  "(origin='server' AND ((event IN ('calculation_succeeded','interpret_succeeded') AND action!='example') OR event='daily_ready' OR (event='agent_finished' AND status='complete')))";
export const activeBrowserSQL = `(${browserAudienceSQL} AND ${productSuccessSQL})`;
export const serviceFailureSQL = `(${serviceRequestSQL} AND status IN ('error','unavailable','timeout'))`;
export const audiences = ['all', 'browser', 'classified_browser', 'automated', 'unknown', 'legacy'] as const;
export const audienceSQL: Record<(typeof audiences)[number], string> = {
  all: '1=1',
  browser: browserAudienceSQL,
  classified_browser: "actor_type='browser' AND classification_version>0",
  automated: "actor_type IN ('search_crawler','ai_crawler','ai_agent','automation','tool_client')",
  unknown: "actor_type='unknown'",
  legacy: "actor_type='legacy'",
};
export const metricDefinitions: Record<string, { unit: string; definition: string; additive: boolean }> = {
  content_requests: {
    unit: '次 GET',
    definition: '服务端记录的公开内容 GET；含爬虫、未知客户端和错误响应，HEAD 单列。',
    additive: true,
  },
  search_requests: {
    unit: '次 GET',
    definition: '被识别为搜索爬虫的公开内容 GET；身份可信度查看分类依据。',
    additive: true,
  },
  ai_requests: {
    unit: '次 GET',
    definition: 'AI 抓取和用户委托 Agent 获取公开内容；与问卜 Agent 产品回合分开。',
    additive: true,
  },
  service_requests: {
    unit: '次调用',
    definition:
      '每个 API 操作或 MCP tools/call 的终态一次；包括解析前拒绝的服务请求，不含 MCP 初始化/工具列表和 Agent 内部工具阶段。',
    additive: true,
  },
  pageviews: {
    unit: '次 PV',
    definition: '浏览器客户端上报的页面浏览；旧记录兼容非 bot、非 edge。脚本阻止、退出或丢报可能造成缺失。',
    additive: true,
  },
  visitors: {
    unit: '个浏览器标识',
    definition: '发生 PV 的去重匿名浏览器标识，有效期 30 天；不是自然人数，换浏览器、清存储会重复。',
    additive: false,
  },
  sessions: {
    unit: '个会话',
    definition: '发生 PV 的去重会话标识；30 分钟不活跃后产生新会话。',
    additive: false,
  },
  active_visitors: {
    unit: '个浏览器标识',
    definition:
      '服务器确认完成非示例计算、解读、日签响应或问卜 Agent 回合的去重浏览器标识；仅统计可关联标识的浏览器流量。日签响应不等于结果已被看见。',
    additive: false,
  },
  calculations: {
    unit: '次计算',
    definition: '服务器确认完成的非示例计算；包含网站、API、CLI、MCP，不等于人数。',
    additive: true,
  },
  agent_complete: {
    unit: '个回合',
    definition: '问卜 Agent 成功完成的回合；等待补充、额度不足、中断单列，不代表一段完整对话。',
    additive: true,
  },
  failures: {
    unit: '次错误',
    definition: '服务终态为 error、unavailable、timeout；输入错误、限速和主动中断单列。',
    additive: true,
  },
};
