import { describe, expect, it } from 'vitest';
import { shouldSendMessage } from '../src/lib/agent-keyboard';
import { UserFacingError, uiErrorMessage } from '../src/lib/ui-error';
import { feedbackFailureMessage, feedbackReceipt, FeedbackDeliveryError } from '../src/lib/feedback-delivery';

const enter = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false };

describe('localized interface errors', () => {
  it('preserves deliberate UI copy while hiding browser, parser and internal diagnostics', () => {
    const fallback = '连接暂不可用，已有内容仍保留。';
    for (const error of [
      new TypeError('Failed to fetch'),
      new SyntaxError('sensitive body'),
      new Error('internal stream size'),
      null,
    ])
      expect(uiErrorMessage(error, fallback)).toBe(fallback);
    expect(uiErrorMessage(new UserFacingError('今日额度已用完'), fallback)).toBe('今日额度已用完');
  });
});

describe('composer keyboard contract', () => {
  it('desktop Enter sends while Shift+Enter preserves a new line', () => {
    expect(shouldSendMessage(enter, false)).toBe(true);
    expect(shouldSendMessage({ ...enter, shiftKey: true }, false)).toBe(false);
  });
  it('touch Enter adds a line; explicit Ctrl or Command shortcuts can still send', () => {
    expect(shouldSendMessage(enter, true)).toBe(false);
    expect(shouldSendMessage({ ...enter, ctrlKey: true }, true)).toBe(true);
    expect(shouldSendMessage({ ...enter, metaKey: true }, true)).toBe(true);
  });
  it('IME confirmation never submits, including the legacy 229 composition signal', () => {
    for (const touch of [true, false]) {
      expect(shouldSendMessage({ ...enter, isComposing: true, ctrlKey: true }, touch)).toBe(false);
      expect(shouldSendMessage({ ...enter, keyCode: 229 }, touch)).toBe(false);
      expect(shouldSendMessage({ ...enter, key: 'a' }, touch)).toBe(false);
    }
  });
});

describe('feedback delivery truth and recovery', () => {
  it('a success receipt must confirm this exact submission was saved', () => {
    expect(feedbackReceipt({ id: 'submission-1', saved: true }, 'submission-1')).toBe('submission-1');
    for (const response of [
      null,
      {},
      'ok',
      { id: 'another', saved: true },
      { id: 'submission-1', saved: false },
    ])
      expect(() => feedbackReceipt(response, 'submission-1')).toThrow(FeedbackDeliveryError);
  });
  it('browser and malformed-response diagnostics never leak into user-facing feedback', () => {
    for (const error of [
      new TypeError('Failed to fetch'),
      new SyntaxError('secret response body'),
      new Error('private internal diagnostic'),
    ]) {
      const zh = feedbackFailureMessage(error, 'zh');
      expect(zh).toContain('内容还在这里');
      expect(zh).not.toContain(error.message);
      expect(feedbackFailureMessage(error, 'en')).toContain('Your note is still here');
    }
  });
  it('timeout and rate-limit recovery are specific and localized', () => {
    const timeout = new Error('deadline');
    timeout.name = 'TimeoutError';
    expect(feedbackFailureMessage(timeout, 'zh')).toContain('重复提交不会重复保存');
    expect(feedbackFailureMessage(timeout, 'en')).toContain('without creating a duplicate');
    expect(feedbackFailureMessage(new FeedbackDeliveryError(429), 'zh')).toContain('一分钟');
    expect(feedbackFailureMessage(new FeedbackDeliveryError(429), 'en')).toContain('wait a minute');
  });
});
