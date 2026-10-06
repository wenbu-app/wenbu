import { describe, expect, it } from 'vitest';
import { newMessage, newSession } from '../src/lib/agent-session';
import { sessionDeliverables, sessionSavePreview } from '../src/lib/agent-deliverables';
import type { ChartArtifact } from '../src/lib/agent-protocol';

describe('original conversation answers in the result panel', () => {
  it('links a chart to the exact answer from its own turn, leaving receipts unchanged', () => {
    const session = newSession('en');
    const chart = {
      type: 'chart',
      id: 'first-chart',
      title: 'One card',
      createdAt: '2026-10-06',
      reading: { kind: 'tarot', cards: [{ id: 'star', zh: '星星', en: 'The Star', reversed: false }] },
      input: { kind: 'tarot', input: { cards: [{ id: 'star', reversed: false }] } },
    } as ChartArtifact;
    const original = 'The traditional meaning is symbolic. Try a manageable step today. '.repeat(2);
    const message = { ...newMessage('assistant', original), status: 'complete' as const, artifacts: [chart] };
    session.messages = [
      newMessage('user', 'A first reflection'),
      message,
      newMessage('user', 'Another question'),
      { ...newMessage('assistant', 'An unrelated answer. '.repeat(7)), status: 'complete' },
    ];
    session.receipt = 'signed-session-receipt';
    const before = JSON.stringify(session);
    expect(sessionDeliverables(session)[0]).toMatchObject({
      id: chart.id,
      answer: { text: original, messageId: message.id },
    });
    expect(sessionSavePreview(session)).toBe('The Star — Full conversation · 2 results');
    expect(JSON.stringify(session)).toBe(before);
    message.status = 'running' as typeof message.status;
    expect(sessionDeliverables(session)[0]).not.toHaveProperty('answer');
  });
  it('keeps stable references and exact text without changing the signed session', () => {
    const session = newSession('en');
    const answer = {
      ...newMessage('assistant', 'An original answer. '.repeat(8)),
      status: 'complete' as const,
    };
    session.messages = [newMessage('user', 'What should I check?'), answer];
    session.receipt = 'existing-receipt';
    const before = JSON.stringify(session);
    const result = sessionDeliverables(session);
    expect(result[0]).toMatchObject({
      type: 'answer',
      id: `answer:${answer.id}`,
      messageId: answer.id,
      text: answer.text,
      title: 'What should I check?',
    });
    expect(JSON.stringify(session)).toBe(before);
    session.messages.push(newMessage('user', 'More detail'));
    expect(sessionDeliverables(session)).toEqual(result);
  });
  it('never presents incomplete or waiting text as a completed result', () => {
    const session = newSession('zh');
    for (const status of ['waiting', 'running', 'stopped', 'limited', 'error'] as const) {
      session.messages = [{ ...newMessage('assistant', '尚未完成的内容'.repeat(30)), status }];
      expect(sessionDeliverables(session)).toEqual([]);
    }
    session.messages = [
      {
        ...newMessage('assistant', 'A'.repeat(100)),
        status: 'complete',
        question: { question: 'Which?', options: [] },
      },
    ];
    expect(sessionDeliverables(session)).toEqual([]);
  });
  it('does not promote an older written questionnaire to a result', () => {
    const session = newSession('en');
    session.messages = [
      {
        ...newMessage(
          'assistant',
          'Let us clarify what matters before continuing.\nWhat matters most to you?\nA. Growth and learning\nB. Stability and a predictable schedule\nChoose one that fits.',
        ),
        status: 'complete',
      },
    ];
    expect(sessionDeliverables(session)).toEqual([]);
  });
  it('preserves verified artifacts without duplicating their closing summary', () => {
    const session = newSession('en');
    const report = {
      type: 'report' as const,
      id: 'report-id',
      title: 'Result',
      summary: 'Summary',
      sections: [],
      questions: [],
      createdAt: '2026-10-06',
    };
    session.messages = [
      { ...newMessage('assistant', 'Summary '.repeat(40)), status: 'complete', artifacts: [report] },
    ];
    expect(sessionDeliverables(session)).toEqual([report]);
  });
});
