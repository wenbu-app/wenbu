import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  newMessage,
  newSession,
  persistSessions,
  restoreSessions,
  updateMessage,
  contextHistory,
  readingReference,
  isSafeSource,
  hasLaterReport,
} from '../src/lib/agent-session';
import { drawTarot } from '../src/lib/tarot';
import { restoreReading } from '../worker/agent-schema';
vi.mock('../src/lib/account-client', () => ({
  readAccountCache: () => JSON.parse(localStorage.getItem('wenbu.agent.sessions.v1') || '[]'),
  writeAccountCache: (_kind: string, entries: unknown) =>
    localStorage.setItem('wenbu.agent.sessions.v1', JSON.stringify(entries)),
}));
afterEach(() => vi.unstubAllGlobals());
describe('Agent local recovery and context', () => {
  it('preserves partial content but does not resume abandoned executions on reload', () => {
    let saved = '';
    vi.stubGlobal('localStorage', {
      getItem: () => saved,
      setItem: (_: string, v: string) => {
        saved = v;
      },
    });
    const s = newSession('zh');
    s.messages = [newMessage('assistant', 'Partial result')];
    s.messages[0].tools = [{ id: 'a', name: 'read_library', label: 'Read', status: 'running' }];
    persistSessions([s]);
    const restored = restoreSessions()[0];
    expect(restored.messages[0].status).toBe('stopped');
    expect(restored.messages[0].text).toBe('Partial result');
    expect(restored.messages[0].tools[0].status).toBe('stopped');
  });
  it('surfaces storage failure instead of silently claiming to save', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => persistSessions([newSession('en')])).toThrow('quota');
  });
  it('keeps completed tool work and text when a later streaming step fails', () => {
    let m = newMessage('assistant', 'Verified calculation');
    m = updateMessage(m, {
      type: 'tool_start',
      tool: { id: '1:a', name: 'calculate_bazi', label: 'Chart', status: 'running' },
    });
    m = updateMessage(m, { type: 'tool_end', id: '1:a', status: 'complete', detail: 'done' });
    m = updateMessage(m, {
      type: 'tool_start',
      tool: { id: '2:a', name: 'read_library', label: 'Read', status: 'running' },
    });
    m = updateMessage(m, { type: 'error', code: 'upstream', message: 'Unavailable' });
    expect(m.text).toBe('Verified calculation');
    expect(m.tools.map((t) => t.status)).toEqual(['complete', 'error']);
    expect(m.status).toBe('error');
  });
  it('sends bounded recent history without mutating the full local conversation', () => {
    const messages = Array.from({ length: 25 }, () => newMessage('user', 'a'.repeat(9000)));
    const history = contextHistory(messages);
    expect(history).toHaveLength(4);
    expect(history.reduce((sum, m) => sum + m.content.length, 0)).toBe(28000);
    expect(messages).toHaveLength(25);
    expect(messages[0].text).toHaveLength(9000);
  });
  it('round-trips original card identities and reversals for follow-up', () => {
    const draw = drawTarot({ count: 3, reversals: true });
    const restored = restoreReading(readingReference(draw));
    expect(restored.kind).toBe('tarot');
    if (restored.kind === 'tarot')
      expect(restored.cards.map((c) => [c.id, c.reversed])).toEqual(
        draw.cards.map((c) => [c.id, c.reversed]),
      );
  });
});

it('discards corrupted or unsafe stored source URLs during recovery', () => {
  const s = newSession('en');
  s.messages = [newMessage('assistant', 'Saved text')];
  const source = {
    id: 'x',
    title: 'Source',
    url: 'not a url',
    kind: 'reference' as const,
    level: 'primary',
    excerpt: 'Excerpt',
    readAt: '2026-09-28',
  };
  s.messages[0].sources = [source];
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([s]) });
  expect(restoreSessions()[0].messages[0].sources).toEqual([]);
  expect(
    updateMessage(s.messages[0], { type: 'source', source: { ...source, url: 'javascript:alert(1)' } })
      .sources,
  ).toEqual([source]);
  expect(isSafeSource({ ...source, url: 'javascript:alert(1)' })).toBe(false);
  expect(isSafeSource({ ...source, url: 'https://aa.usno.navy.mil/faq/eqtime' })).toBe(true);
});

it('describes a later report without rewriting the original failed attempt', () => {
  const message = newMessage('assistant', 'Report saved');
  message.status = 'complete';
  message.tools = [
    {
      id: 'first',
      name: 'write_report',
      label: 'Report',
      status: 'error',
      detail: 'A citation was not read or verified. Read its source first.',
    },
    { id: 'read', name: 'read_reference', label: 'Read', status: 'complete' },
    { id: 'last', name: 'write_report', label: 'Report', status: 'complete' },
  ];
  message.artifacts = [
    {
      id: 'report',
      type: 'report',
      title: 'Two rules',
      createdAt: '2026-09-28',
      summary: 'Summary',
      sections: [],
      questions: [],
    },
  ];
  expect(hasLaterReport(message, 'first')).toBe(true);
  expect(message.tools[0].status).toBe('error');
  expect(hasLaterReport(message, 'read')).toBe(false);
  expect(hasLaterReport({ ...message, status: 'running' }, 'first')).toBe(false);
  expect(hasLaterReport({ ...message, status: 'error' }, 'first')).toBe(false);
  expect(hasLaterReport({ ...message, artifacts: [] }, 'first')).toBe(false);
  expect(
    hasLaterReport(
      { ...message, artifacts: [...message.artifacts, { ...message.artifacts[0], id: 'other' }] },
      'first',
    ),
  ).toBe(false);
  expect(hasLaterReport({ ...message, tools: message.tools.filter((t) => t.id !== 'read') }, 'first')).toBe(
    false,
  );
  expect(
    hasLaterReport(
      {
        ...message,
        tools: message.tools.map((t) =>
          t.id === 'first' ? { ...t, detail: 'Unrelated upstream failure' } : t,
        ),
      },
      'first',
    ),
  ).toBe(false);
  expect(
    hasLaterReport(
      {
        ...message,
        tools: [
          ...message.tools,
          { id: 'other', name: 'write_report', label: 'Other report', status: 'error' },
        ],
      },
      'first',
    ),
  ).toBe(false);
});
