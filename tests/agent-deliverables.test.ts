import { describe, expect, it } from 'vitest';
import { newMessage, newSession } from '../src/lib/agent-session';
import { sessionDeliverables } from '../src/lib/agent-deliverables';

describe('original conversation answers in the result panel', () => {
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
