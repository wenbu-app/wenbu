import type { Locale } from './schema';

export class FeedbackDeliveryError extends Error {
  constructor(readonly status: number) {
    super('Feedback delivery failed');
    this.name = 'FeedbackDeliveryError';
  }
}

export function feedbackReceipt(value: unknown, expectedId: string): string {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !('saved' in value) ||
    value.id !== expectedId ||
    value.saved !== true
  )
    throw new FeedbackDeliveryError(502);
  return expectedId;
}

// Browser and server errors are diagnostic data, not user-facing copy.
export function feedbackFailureMessage(error: unknown, locale: Locale): string {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  if (error instanceof FeedbackDeliveryError && error.status === 429)
    return t(
      '提交得有些频繁，请一分钟后再试。内容还在这里。',
      'Please wait a minute before trying again. Your note is still here.',
    );
  if (error instanceof Error && error.name === 'TimeoutError')
    return t(
      '连接超时，请重试。重复提交不会重复保存。',
      'The connection timed out. You can retry without creating a duplicate.',
    );
  if (error instanceof TypeError)
    return t(
      '连接中断，反馈尚未确认保存。内容还在这里，请联网后重试。',
      'The connection was interrupted, so saving is not confirmed. Your note is still here; reconnect and try again.',
    );
  return t(
    '暂时没能确认保存，请稍后重试。内容还在这里。',
    'We couldn’t confirm saving. Your note is still here; please try again.',
  );
}
