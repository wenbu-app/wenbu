import type { AgentMessage, AgentSession, ChartArtifact, ReportArtifact } from './agent-protocol';
import { writtenQuestion } from './agent-written-question';

export type AnswerNote = {
  type: 'answer';
  id: string;
  messageId: string;
  title: string;
  text: string;
};
export type ChartOutcome = ChartArtifact & { answer?: { messageId: string; text: string } };
export type Deliverable = ChartOutcome | ReportArtifact | AnswerNote;

// Match the established completion proxy. This is not a claim of usefulness or
// comprehension, and never promotes partial, waiting or failed streams.
export function isCompletedAnswer(message: AgentMessage) {
  return (
    message.role === 'assistant' &&
    message.status === 'complete' &&
    !message.question &&
    message.text.trim().length >= 80 &&
    !writtenQuestion(message.text)
  );
}

/** A view of original messages: no second model call, new receipt or stored mutation. */
export function sessionDeliverables(session: AgentSession): Deliverable[] {
  let title = session.title;
  return session.messages.flatMap((message): Deliverable[] => {
    if (message.role === 'user') title = message.text.trim().slice(0, 100);
    if (message.artifacts.length)
      return message.artifacts.map((artifact) =>
        artifact.type === 'chart' && isCompletedAnswer(message)
          ? { ...artifact, answer: { messageId: message.id, text: message.text } }
          : artifact,
      );
    return isCompletedAnswer(message)
      ? [
          {
            type: 'answer',
            id: `answer:${message.id}`,
            messageId: message.id,
            title,
            text: message.text,
          },
        ]
      : [];
  });
}

/** Labels the saved content without generating or changing any of it. */
export function sessionSavePreview(session: AgentSession, locale = session.locale) {
  const results = sessionDeliverables(session);
  const latestChart = [...results].reverse().find((item) => item.type === 'chart');
  const names =
    latestChart?.type === 'chart' && latestChart.reading.kind === 'tarot'
      ? latestChart.reading.cards.map((card) => (locale === 'zh' ? card.zh : card.en)).join(' · ')
      : '';
  return [
    names || session.title,
    locale === 'zh'
      ? `对话全文 · ${results.length} 份结果`
      : `Full conversation · ${results.length} ${results.length === 1 ? 'result' : 'results'}`,
  ].join(' — ');
}
