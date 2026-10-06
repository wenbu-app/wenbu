import type { AgentArtifact, AgentMessage, AgentSession } from './agent-protocol';

export type AnswerNote = {
  type: 'answer';
  id: string;
  messageId: string;
  title: string;
  text: string;
};
export type Deliverable = AgentArtifact | AnswerNote;

// Match the established completion proxy. This is not a claim of usefulness or
// comprehension, and never promotes partial, waiting or failed streams.
export function isCompletedAnswer(message: AgentMessage) {
  return (
    message.role === 'assistant' &&
    message.status === 'complete' &&
    !message.question &&
    message.text.trim().length >= 80
  );
}

/** A view of original messages: no second model call, new receipt or stored mutation. */
export function sessionDeliverables(session: AgentSession): Deliverable[] {
  let title = session.title;
  return session.messages.flatMap((message): Deliverable[] => {
    if (message.role === 'user') title = message.text.trim().slice(0, 100);
    if (message.artifacts.length) return message.artifacts;
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
