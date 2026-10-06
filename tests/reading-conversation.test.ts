import { expect, it } from 'vitest';
import { readingConversation, isolatedTrialSession } from '../src/lib/reading-conversation';
import { newSession } from '../src/lib/agent-session';
import type { Entry } from '../src/lib/journal';

it('carries only the selected reading and background without a synthetic answer', () => {
  const entry = {
    id: 'chosen-reading',
    question: 'What can I try?',
    context: 'My selected context',
    receipt: 'original-receipt',
  } as Entry;
  const before = JSON.stringify(entry);
  const conversation = readingConversation(entry, 'en');
  expect(conversation.context).toEqual({
    note: 'My selected context',
    useBirth: false,
    journalIds: ['chosen-reading'],
  });
  expect(conversation.messages).toEqual([]);
  expect(conversation.receipt).toBeUndefined();
  expect(conversation.title).toBe(entry.question);
  expect(JSON.stringify(entry)).toBe(before);
});

it('a no-details trial does not inherit selected personal context or prior messages', () => {
  const current = newSession('en');
  expect(isolatedTrialSession(current, 'en')).toBe(current);
  current.context.note = 'Private background previously selected';
  current.context.journalIds = ['private-record'];
  const before = JSON.stringify(current);
  const trial = isolatedTrialSession(current, 'en');
  expect(trial.id).not.toBe(current.id);
  expect(trial.context).toEqual({ note: '', useBirth: false, journalIds: [] });
  expect(trial.messages).toEqual([]);
  expect(JSON.stringify(current)).toBe(before);
});
