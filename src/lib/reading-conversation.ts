import { newSession } from './agent-session';
import type { Entry } from './journal';
import type { Locale } from './schema';
import type { AgentSession } from './agent-protocol';

export function isolatedTrialSession(current: AgentSession, locale: Locale) {
  return current.messages.length ||
    current.context.note ||
    current.context.useBirth ||
    current.context.journalIds.length
    ? newSession(locale)
    : current;
}

/** Reuse an existing reading. No new draw, model call or synthetic completion. */
export function readingConversation(entry: Entry, locale: Locale) {
  const session = newSession(locale);
  session.title =
    entry.question.trim().slice(0, 100) || (locale === 'zh' ? '继续读这份结果' : 'Explore this reading');
  session.context.journalIds = [entry.id];
  session.context.note = entry.context ?? '';
  return session;
}
