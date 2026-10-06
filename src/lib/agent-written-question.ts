import type { AgentQuestion } from './agent-protocol';

/** Normalize only recognizable intake menus, not lists of advice or quoted examples. */
export function writtenQuestion(text: string): { question: AgentQuestion; preamble: string } | null {
  if (text.length > 2400 || /```|^\s*>/m.test(text)) return null;
  const lines = text.split('\n').map((line) => line.trim().replace(/\*\*|__/g, ''));
  const choices = lines.flatMap((line, index) => {
    const match = line.match(/^(?:[-*•]\s*)?(?:[A-Da-d]|[1-4])[.、:：)）]\s*(.+)$/);
    return match ? [{ index, text: match[1] }] : [];
  });
  if (choices.length < 2 || choices.length > 4 || choices.some((choice) => choice.text.length > 160))
    return null;
  const first = choices[0].index;
  const last = choices.at(-1)!.index;
  if (lines.slice(first, last + 1).filter(Boolean).length !== choices.length) return null;
  const tail = lines
    .slice(last + 1)
    .join(' ')
    .trim();
  // An explicit request to select/reply distinguishes intake from an answer's
  // rhetorical heading and numbered recommendations.
  if (
    !/选一个|选一项|选择最|选最|回复[一你]|告诉我.{0,12}(?:选|哪)|(?:choose|pick|select)\s+(?:one|an? option|the)|which\s+(?:one|option)\s+(?:fits|feels)|reply\s+with/i.test(
      tail,
    ) ||
    tail.length > 240
  )
    return null;
  // "Choose one to try this week" can be an actionable recommendation.
  // Require a request to reply or identify the option that describes the user.
  if (
    !/回复|回答|告诉我|最接近|最符合|适合你|补充.{0,12}(?:说法|想法|情况)|\b(?:reply|tell me|your own words|fits|feels|closest|describes you)\b/i.test(
      tail,
    )
  )
    return null;
  const reverseIndex = lines
    .slice(0, first)
    .reverse()
    .findIndex((line) => /[?？]$/.test(line));
  const questionIndex = reverseIndex < 0 ? -1 : first - 1 - reverseIndex;
  if (questionIndex < 0 || lines[questionIndex].length > 700) return null;
  if (lines.slice(questionIndex + 1, first).some(Boolean)) return null;
  return {
    question: { question: lines[questionIndex], options: choices.map((choice) => choice.text) },
    preamble: lines.slice(0, questionIndex).join('\n').trim(),
  };
}
