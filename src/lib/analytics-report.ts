import { trafficDimensions } from './traffic-contract';
import { campaigns, mediums, pagePaths, sources, tools } from './analytics-contract';

export const reportPresets = [1, 3, 7, 14, 30, 90] as const;
export const reportTimezones = ['Asia/Shanghai', 'UTC'] as const;
export const reportDimensions: Record<string, readonly string[]> = {
  ...trafficDimensions,
  source: sources,
  medium: mediums,
  campaign: campaigns,
  locale: ['zh', 'en'],
  device: ['mobile', 'desktop', 'tablet', 'bot', 'unknown'],
  channel: ['web', 'api', 'cli', 'mcp'],
  page: [
    ...pagePaths.map((p) => `/${p ? p + '/' : ''}`),
    '/other/',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/feed.xml',
    '/en/feed.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/SKILL.md',
    '/skill.md',
    '/openapi.json',
    '/wenbu.mjs',
    '/agent-protocol.md',
    '/.well-known/mcp-registry-auth',
    '/.well-known/agent.json',
    '/.well-known/mcp.json',
    '/knowledge/index.json',
  ],
  entry_page: [...pagePaths.map((p) => `/${p ? p + '/' : ''}`), '/other/'],
  tool: tools,
  mode: ['none', 'explore', 'research'],
  browser: ['chrome', 'safari', 'firefox', 'edge', 'other', 'unknown'],
  os: ['windows', 'macos', 'ios', 'android', 'linux', 'other', 'unknown'],
};
export type ReportFilters = {
  audience: string;
  actor_type: string;
  actor_name: string;
  actor_purpose: string;
  classification_evidence: string;
  resource_type: string;
  http_method: string;
  days: string;
  start: string;
  end: string;
  timezone: string;
  granularity: string;
  test: string;
  source: string;
  medium: string;
  campaign: string;
  locale: string;
  device: string;
  channel: string;
  page: string;
  entry_page: string;
  tool: string;
  mode: string;
  browser: string;
  os: string;
  country: string;
};
export const defaultReportFilters: ReportFilters = {
  audience: 'all',
  actor_type: '',
  actor_name: '',
  actor_purpose: '',
  classification_evidence: '',
  resource_type: '',
  http_method: '',
  days: '7',
  start: '',
  end: '',
  timezone: 'Asia/Shanghai',
  granularity: 'auto',
  test: 'false',
  source: '',
  medium: '',
  campaign: '',
  locale: '',
  device: '',
  channel: '',
  page: '',
  entry_page: '',
  tool: '',
  mode: '',
  browser: '',
  os: '',
  country: '',
};
export const reportMetrics = [
  { key: 'content_requests', label: '内容请求', color: '#3b6c78', dash: undefined },
  { key: 'search_requests', label: '搜索爬虫请求', color: '#a67738', dash: '7 3' },
  { key: 'ai_requests', label: 'AI 抓取 / Agent 请求', color: '#78678f', dash: '3 3' },
  { key: 'service_requests', label: '服务调用', color: '#687461', dash: '7 3' },
  { key: 'pageviews', label: '浏览器页面浏览', color: '#47664d', dash: undefined },
  { key: 'visitors', label: '访问浏览器标识', color: '#896239', dash: '3 3' },
  { key: 'sessions', label: '访问会话', color: '#4e7383', dash: '7 3' },
  { key: 'active_visitors', label: '完成使用的浏览器标识', color: '#37665b', dash: '3 3' },
  { key: 'calculations', label: '成功计算', color: '#9b573f', dash: undefined },
  { key: 'agent_complete', label: '问卜 Agent 完成', color: '#796783', dash: '3 3' },
  { key: 'failures', label: '服务错误', color: '#923f57', dash: '7 3' },
] as const;
export type ReportMetric = (typeof reportMetrics)[number]['key'];
export type ReportRow = Record<string, string | number | null>;
export type TrendPoint = Record<ReportMetric, number | null> & {
  bucket: number;
  end: number;
  label: string;
  state: 'observed' | 'partial' | 'future';
};
export type AnalyticsReport = {
  measurement: {
    version: string;
    definitions: Record<string, { unit: string; definition: string; additive: boolean }>;
  };
  generatedAt: string;
  days: number;
  includeTest: boolean;
  retentionDays: number;
  timezone: string;
  filters: ReportFilters;
  range: {
    start: number;
    end: number;
    asOf: number;
    startDate: string;
    endDate: string;
    granularity: 'hour' | 'day';
  };
  series: TrendPoint[];
  data: Record<string, ReportRow[]>;
};
export const reportLabels: Record<string, string> = {
  'Asia/Shanghai': '北京 · UTC+8',
  UTC: 'UTC',
  actor_type: '访问者类型',
  actor_name: '客户端标识',
  actor_purpose: '请求用途',
  classification_evidence: '分类依据',
  resource_type: '资源类型',
  http_method: '请求方法',
  search_crawler: '搜索爬虫',
  ai_crawler: 'AI 抓取',
  ai_agent: '用户委托 Agent',
  automation: '其他自动化',
  tool_client: '工具客户端',
  legacy: '旧数据 · 无分类依据',
  browse: '网页浏览',
  search: '搜索检索',
  training: '训练抓取',
  user_fetch: '用户委托抓取',
  ua_declared: 'UA 自报 · 未核实身份',
  browser_hint: '浏览器特征 · 不等于真人',
  tool_declared: '协议 / 客户端自报',
  cf_verified: 'Cloudflare 已验证自动化',
  cf_signed: 'Cloudflare 已验证签名 Agent',
  cf_score: 'Cloudflare 自动化评分推断',
  html: '网页 HTML',
  markdown: 'Markdown 手册',
  json: 'JSON 内容',
  discovery: '发现文件',
  service: '服务端操作',
  client_event: '浏览器事件',
  googlebot: 'Googlebot',
  bingbot: 'Bingbot',
  baiduspider: 'Baiduspider',
  duckduckbot: 'DuckDuckBot',
  yandexbot: 'YandexBot',
  oai_searchbot: 'OAI-SearchBot',
  gptbot: 'GPTBot',
  chatgpt_user: 'ChatGPT-User',
  claudebot: 'ClaudeBot',
  claude_searchbot: 'Claude-SearchBot',
  claude_user: 'Claude-User',
  perplexitybot: 'PerplexityBot',
  perplexity_user: 'Perplexity-User',
  bytespider: 'Bytespider',
  headless: '无头浏览器',
  script: '脚本客户端',
  generic_bot: '未识别自动化',
  cf_bot: 'Cloudflare 已验证 Bot',
  cf_agent: 'Cloudflare 签名 Agent',
  mcp_client: 'MCP 客户端',
  cli_client: 'CLI 客户端',
  api_client: 'API 客户端',
  google: 'Google',
  bing: 'Bing',
  baidu: '百度',
  duckduckgo: 'DuckDuckGo',
  github: 'GitHub',
  chatgpt: 'ChatGPT 引荐',
  perplexity: 'Perplexity 引荐',
  claude: 'Claude 引荐',
  deepseek: 'DeepSeek 引荐',
  x: 'X',
  weibo: '微博',
  xiaohongshu: '小红书',
  youtube: 'YouTube',
  newsletter: '邮件通讯',
  page_view: '页面浏览',
  page_exit: '页面离开',
  setting_changed: '调整设置',
  feedback_opened: '打开反馈',
  telemetry_gap: '客户端报告丢弃',
  engaged: '停留超过 30 秒',
  scroll_depth: '阅读深度',
  cta_click: '入口点击',
  tool_started: '开始工具',
  result_viewed: '展示结果',
  ai_requested: '请求 AI 解读',
  ai_result_viewed: '展示 AI 解读',
  agent_started: '开始 Agent 回合',
  agent_received: '接收 Agent 结果',
  agent_stopped: '停止 Agent',
  guide_opened: '旧版：打开引导',
  guide_step: '旧版：引导步骤',
  guide_skipped: '旧版：跳过引导',
  guide_draft_created: '旧版：生成问题草稿',
  suggestion_selected: '选择建议',
  artifact_opened: '打开成果',
  report_exported: '导出报告',
  conversation_exported: '导出对话',
  context_exported: '导出给 Agent',
  journal_exported: '导出手记',
  journal_saved: '保存手记',
  context_opened: '打开上下文',
  card_inspected: '查看卡牌',
  source_opened: '打开来源',
  form_started: '开始填写',
  client_error: '客户端错误',
  calculation_succeeded: '计算完成',
  interpret_succeeded: '解读完成',
  agent_finished: 'Agent 回合终态',
  agent_tool_finished: 'Agent 工具阶段',
  api_failed: '服务请求未完成',
  mcp_finished: 'MCP 调用终态',
  page_request: '公开内容请求',
  event: '事件',
  status: '结果',
  session: '会话',
  operation: '操作',
  conversation: '对话',
  visitor: '浏览器标识',
  'mcp-registry': '官方 MCP Registry',
  'open-source-2026': '开源接入推广',
  'first-reading': '第一次使用',
  audience: '统计人群',
  all: '全部请求与事件',
  classified_browser: '新分类浏览器',
  automated: '已识别自动化 / 工具',
  source: '引荐来源',
  medium: '渠道类型',
  campaign: '活动',
  locale: '语言',
  device: '设备',
  channel: '使用方式',
  page: '浏览页面',
  entry_page: '进入页面',
  tool: '功能事件',
  mode: 'Agent 模式',
  browser: '浏览器',
  os: '操作系统',
  country: '国家 / 地区',
  direct: '无已知来源（含直接访问）',
  internal: '站内来源',
  other: '其他',
  unknown: '未知',
  none: '未指定',
  zh: '中文',
  en: 'English',
  mobile: '手机',
  desktop: '电脑',
  tablet: '平板',
  bot: '自动化访问',
  organic: '自然搜索',
  referral: '引荐',
  social: '社交',
  email: '邮件',
  cpc: '付费点击',
  ai: 'AI 引荐',
  web: '网页',
  api: 'API',
  cli: 'CLI',
  mcp: 'MCP',
  bazi: '八字',
  iching: '易经',
  tarot: '塔罗',
  ziwei: '紫微',
  agent: 'Agent',
  interpret: 'AI 解读',
  explore: '探索',
  research: '研究',
  complete: '已完成',
  waiting: '等待补充',
  limited: '额度限制',
  cancelled: '用户中断',
  error: '服务错误',
  timeout: '超时',
  rate_limited: '限流',
  invalid_input: '输入未通过',
  unavailable: '服务不可用',
};
export function reportLabel(value: string) {
  return reportLabels[value] ?? value;
}
export function dateInTimezone(time: number, timezone: string) {
  const offset = timezone === 'Asia/Shanghai' ? 8 * 3600000 : 0;
  return new Date(time + offset).toISOString().slice(0, 10);
}
export function formatReportTime(time: number, timezone: string, detail = false) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
    ...(detail ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(time);
}
