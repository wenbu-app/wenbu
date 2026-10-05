import { describe, expect, it } from 'vitest';
import {
  followupSuggestions,
  prepareAgentSubmission,
  conversationStarters,
  toolStarters,
  guideText,
} from '../src/lib/agent-guidance';
import { newMessage } from '../src/lib/agent-session';

describe('conversation submissions preserve authorship', () => {
  it('sends only the visible choice and retains all unsent writing, for every shortcut source', () => {
    const draft = '  我还没写完的背景\n\n这里仍是草稿  ';
    for (const action of ['guided', 'clarification', 'followup', 'example'] as const) {
      const result = prepareAgentSubmission(draft, { text: '比较两个选择', action });
      expect(result?.text).toBe('比较两个选择');
      expect(result?.draft).toBe(draft);
      expect(result?.action).toBe(action);
    }
  });
  it('sends a composer message once and clears only that submitted draft', () => {
    expect(prepareAgentSubmission('  我自己的问题  ')).toEqual({
      text: '我自己的问题',
      draft: '',
      action: 'none',
      mode: undefined,
    });
  });
  it('does not substitute a draft for an empty choice or silently truncate a long message', () => {
    expect(prepareAgentSubmission(' ')).toBeNull();
    expect(prepareAgentSubmission('Do not send this', { text: ' ', action: 'followup' })).toBeNull();
    expect(prepareAgentSubmission('x'.repeat(3001))).toBeNull();
    expect(prepareAgentSubmission('Keep this', { text: 'x'.repeat(3001), action: 'followup' })).toBeNull();
    expect(prepareAgentSubmission('x'.repeat(3000))?.text).toHaveLength(3000);
  });
  it('preserves the chosen research mode without adding a hidden prompt in either language', () => {
    for (const locale of ['zh', 'en'] as const) {
      for (const item of [...conversationStarters, ...toolStarters]) {
        const visible = guideText(item.prompt, locale);
        const result = prepareAgentSubmission('', { text: visible, action: 'guided' });
        expect(result?.text).toBe(visible);
      }
      const research = toolStarters.find((item) => item.mode === 'research')!;
      expect(
        prepareAgentSubmission('', {
          text: guideText(research.prompt, locale),
          action: 'example',
          mode: research.mode,
        })?.mode,
      ).toBe('research');
    }
  });
});

describe('contextual follow-ups', () => {
  it('never interrupts a clarification, running, failed or stopped turn with generic suggestions', () => {
    const message = newMessage('assistant', 'A question');
    for (const status of ['running', 'waiting', 'error', 'limited', 'stopped'] as const)
      expect(followupSuggestions({ ...message, status }, 'zh')).toEqual([]);
    expect(
      followupSuggestions(
        { ...message, status: 'complete', question: { question: 'Which?', options: ['A'] } },
        'zh',
      ),
    ).toEqual([]);
    expect(followupSuggestions(newMessage('user', 'Hello'), 'zh')).toEqual([]);
    expect(followupSuggestions({ ...message, status: 'complete' }, 'zh')).toHaveLength(2);
    expect(
      followupSuggestions({ ...message, text: '以下是一个假设案例。', status: 'complete' }, 'zh')[0].text,
    ).toBe('整理成简明清单');
  });
  it('uses the latest report’s questions and removes duplicate and empty suggestions', () => {
    const message = newMessage('assistant', 'A report');
    expect(
      followupSuggestions(
        {
          ...message,
          status: 'complete',
          artifacts: [
            {
              type: 'report',
              id: 'report',
              title: '主题',
              summary: '说明',
              sections: [],
              questions: [
                '如何应用刚才的方法？',
                ' ',
                '如何应用刚才的方法？',
                '还有哪些限制？',
                '第三个问题',
              ],
              createdAt: new Date().toISOString(),
            },
          ],
        },
        'zh',
      ).map((item) => item.text),
    ).toEqual(['如何应用刚才的方法？', '还有哪些限制？']);
  });
});
