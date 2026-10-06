import { agentBirthSchema, type AgentRequest } from './agent-schema';
import { ziweiSchema } from '../src/lib/schema';

/** A UX bound, never an entitlement or quota signal. Every request still reserves a turn. */
export function allowsClarification(input: AgentRequest, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const question = value as { form?: unknown; birthKind?: unknown };
  if (question.form === 'birth') {
    // Required-data forms are an exception only while calculation inputs are missing.
    // Unknown time is valid for BaZi, never for Zi Wei.
    const birth = input.context.birth;
    if (!birth) return true;
    if (question.birthKind === 'ziwei')
      return !ziweiSchema.safeParse({ date: birth.date, time: birth.time, sex: birth.sex }).success;
    const { sex: _sex, ...bazi } = birth;
    return !agentBirthSchema.safeParse(bazi).success;
  }
  // A completed answer may begin a new line of inquiry. A waiting/failed turn
  // cannot reset intake. Older clients without this hint take the conservative path.
  // History is user context, never proof of entitlement, completion or activation.
  const previous = [...input.history].reverse().find((message) => message.role === 'assistant');
  return !previous || previous.delivered === true;
}
