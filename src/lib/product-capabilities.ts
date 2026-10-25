import { version } from '../../package.json';

export const mcpToolNames = [
  'calculate_bazi',
  'cast_iching',
  'draw_tarot',
  'calculate_ziwei',
  'search_library',
  'read_library',
  'get_daily_card',
] as const;
export function productCapabilities() {
  return {
    schemaVersion: 'wenbu-capabilities-1',
    version,
    name: 'Wenbu',
    url: 'https://wenbu.app',
    languages: ['zh', 'en'],
    endpoints: {
      mcp: 'https://wenbu.app/mcp',
      openapi: 'https://wenbu.app/openapi.json',
      skill: 'https://wenbu.app/SKILL.md',
      cli: 'https://wenbu.app/wenbu.mjs',
      knowledge: 'https://wenbu.app/knowledge/index.json',
      capabilities: 'https://wenbu.app/capabilities.json',
    },
    mcp: {
      transport: 'stateless-streamable-http',
      tools: mcpToolNames,
      resources: ['wenbu://methodology', 'wenbu://knowledge', 'wenbu://capabilities'],
      prompts: ['reflect_on_reading', 'research_with_sources'],
      successfulOutputs: 'structuredContent with outputSchema; text JSON is also returned',
    },
    conventions: {
      bazi: {
        date: 'Gregorian 1901–2099',
        timezone: 'IANA or explicit UTC offset; omitted timezone uses Asia/Shanghai and returns a warning',
        unknownTime: 'Hour pillar omitted; noon is provisional for year/month on a solar-term day',
        yearMonth: 'Absolute solar-term boundaries in fixed UTC+08:00',
        dayBoundary: 'midnight by default; optional 23:00 Zi boundary',
        solarTime: 'Optional approximation requiring a known time and longitude',
        elements: 'Visible-character counts, not favorable-element or predictive accuracy claims',
      },
      iching: { order: 'bottom-to-top', lines: [6, 7, 8, 9], changing: [6, 9] },
      tarot: {
        deck: 78,
        count: [1, 3],
        withoutReplacement: true,
        reversalsDefault: true,
        preserve: 'Keep the returned cards for follow-up; do not redraw without the user choosing to',
      },
      ziwei: {
        clock: 'Entered local civil clock',
        engine: 'iztro@2.6.1',
        school: 'Default configuration; fixLeap=true; no solar-time correction',
      },
      daily: {
        scope: 'public',
        timezoneDefault: 'UTC',
        clock: 'Server calendar in the chosen IANA timezone',
        note: 'Public daily prompt. It can differ from a personal browser/account card; no private history is accessed.',
      },
    },
    privacy: {
      accountRequired: false,
      aiKeyRequiredForMcp: false,
      automaticPrivateContextAccess: false,
      selectedContextOnly: true,
      analyticsOptOutHeader: 'X-Wenbu-Analytics: off',
      testHeader: 'X-Wenbu-Test: true',
      modelCall:
        'Only the separate Agent API invokes a model and requires consent:true. MCP calculations, daily practice and library reads do not.',
    },
    evidence: {
      calculations: 'Deterministic conventions or explicitly random draws',
      interpretations: 'Cultural reflection, not established factual predictions',
      library:
        'Read the full document or relevant section before citing; reference search entries are metadata, not fetched source text',
    },
  };
}
