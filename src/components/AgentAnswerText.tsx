import { useEffect, useRef } from 'react';
import AgentMarkdown from './AgentMarkdown';
import type { AgentMessage } from '../lib/agent-protocol';
import type { Locale } from '../lib/schema';
import { isCompletedAnswer } from '../lib/agent-deliverables';
import { track } from '../lib/analytics';

const seen = new Set<string>();

export default function AgentAnswerText({
  message,
  conversation,
  locale,
  allowedUrls,
}: {
  message: AgentMessage;
  conversation: string;
  locale: Locale;
  allowedUrls: string[];
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = root.current?.firstElementChild;
    if (!target || !isCompletedAnswer(message) || seen.has(message.id)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inView = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const update = () => {
      cancel();
      if (!inView || document.visibilityState !== 'visible' || seen.has(message.id)) return;
      timer = setTimeout(() => {
        seen.add(message.id);
        if (seen.size > 500) seen.delete(seen.values().next().value!);
        track('agent_result_visible', {
          tool: 'agent',
          conversation,
          operation: message.id,
          status: 'complete',
        });
        observer.disconnect();
      }, 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        update();
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(target);
    document.addEventListener('visibilitychange', update);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [message.id, message.status, conversation]);
  return (
    <div
      ref={root}
      className={`agent-prose agent-answer ${message.status === 'running' ? 'is-streaming' : ''}`}
    >
      <AgentMarkdown locale={locale} text={message.text} allowedUrls={allowedUrls} />
      {message.status === 'running' && <span className="agent-writing-cursor" aria-hidden="true" />}
    </div>
  );
}
