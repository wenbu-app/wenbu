vi.mock('../src/lib/account-client', () => ({
  readAccountCache: () => JSON.parse(localStorage.getItem('wenbu.agent.sessions.v1') || '[]'),
  writeAccountCache: (_kind: string, entries: unknown) =>
    localStorage.setItem('wenbu.agent.sessions.v1', JSON.stringify(entries)),
}));
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentTrace from '../src/components/AgentTrace';
import { hasLaterReport, reportConclusion, toolDetail, traceOutcomes } from '../src/lib/agent-outcome';
import {
  newMessage,
  newSession,
  persistSessions,
  restoreSessions,
  updateMessage,
} from '../src/lib/agent-session';
import type { AgentMessage, ReportArtifact } from '../src/lib/agent-protocol';

const report: ReportArtifact = {
  type: 'report',
  id: 'saved',
  title: 'Two rules',
  summary: 'Keep the calculation conventions explicit.',
  sections: [],
  questions: [],
  createdAt: '2026-10-01',
};
function screenshot(): AgentMessage {
  return {
    ...newMessage('assistant', 'Report saved'),
    status: 'complete',
    artifacts: [report],
    tools: [
      {
        id: 'first',
        name: 'write_report',
        label: 'Report',
        status: 'error',
        detail: 'A citation was not read or verified. Read its source first.',
      },
      { id: 'read1', name: 'read_library', label: 'Read', status: 'complete' },
      { id: 'read2', name: 'read_library', label: 'Read', status: 'complete' },
      { id: 'last', name: 'write_report', label: 'Report', status: 'complete', artifactId: report.id },
    ],
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('truthful report outcomes', () => {
  it.each(['zh', 'en'] as const)(
    'fixes the historical library-read screenshot and its summary in %s',
    (locale) => {
      const message = screenshot();
      expect(traceOutcomes(message)).toEqual({ failed: 0, recovered: 1, stopped: 0 });
      const html = renderToStaticMarkup(createElement(AgentTrace, { message, locale, children: null }));
      expect(html).toContain(locale === 'zh' ? '报告已修复并生成' : 'Report corrected and saved');
      expect(html).not.toMatch(/次未成功|failed attempt/);
      expect(message.tools[0].status).toBe('error');
      expect(toolDetail(message.tools[0], 'zh')).toContain('尚未读取或核验');
      expect(toolDetail(message.tools[0], 'zh')).not.toContain('A citation');
    },
  );
  it('uses explicit artifact links across multiple attempts and preserves a later real failure', () => {
    let message = screenshot();
    message.tools[0].issue = 'citation_unread';
    message = updateMessage(message, {
      type: 'tool_recovered',
      id: 'first',
      toolId: 'last',
      artifactId: report.id,
    });
    message.tools.push({ id: 'other', name: 'read_reference', label: 'Read', status: 'error' });
    message.artifacts.push({ ...report, id: 'another' });
    message = updateMessage(message, {
      type: 'error',
      code: 'stream',
      message: 'The closing stream did not finish.',
    });
    expect(traceOutcomes(message)).toEqual({ failed: 1, recovered: 1, stopped: 0 });
    expect(message.error).toContain('did not finish');
    const html = renderToStaticMarkup(createElement(AgentTrace, { message, locale: 'en', children: null }));
    expect(html).toContain('1 failed attempt');
    expect(html).toContain('Report corrected');
    const session = newSession('en');
    session.messages = [message];
    let saved = '';
    vi.stubGlobal('localStorage', {
      getItem: () => saved,
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    });
    persistSessions([session]);
    expect(traceOutcomes(restoreSessions()[0].messages[0])).toEqual(traceOutcomes(message));
  });
  it('rejects recovery without the matching saved artifact and later successful tool', () => {
    const message = screenshot();
    message.tools[0].issue = 'citation_unread';
    expect(hasLaterReport(message, 'first')).toBe(false);
    message.tools[0].recovery = { toolId: 'last', artifactId: 'missing' };
    expect(hasLaterReport(message, 'first')).toBe(false);
    message.tools[0].recovery.artifactId = report.id;
    expect(hasLaterReport(message, 'first')).toBe(true);
    message.tools.at(-1)!.status = 'error';
    expect(hasLaterReport(message, 'first')).toBe(false);
  });
  it('repairs only empty closing scaffolds, using the saved summary without inventing points', () => {
    expect(reportConclusion('已生成。\n\n三点提要：', report, 'zh')).toContain(report.summary);
    expect(reportConclusion('Ready.\n\n**Key takeaways:**', report, 'en')).toContain(report.summary);
    const complete = 'Three points:\n1. Evidence\n2. Convention\n3. Uncertainty';
    expect(reportConclusion(complete, report, 'en')).toBe(complete);
    expect(reportConclusion('What is your question?', report, 'en')).toBe('What is your question?');
  });
});
