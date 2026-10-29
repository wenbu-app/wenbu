type Token = { kind: 'string' | 'literal' | 'punctuation'; text: string; start: number; end: number };

function tokensFor(text: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < text.length;) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    const start = i;
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text.charCodeAt(i) < 32) throw new Error('invalid_string');
        i += text[i] === '\\' ? 2 : 1;
      }
      if (i >= text.length) throw new Error('unfinished_string');
      const raw = text.slice(start, ++i);
      JSON.parse(raw); // Reject invalid escapes instead of guessing prose.
      tokens.push({ kind: 'string', text: raw, start, end: i });
    } else if ('{}[],:'.includes(text[i])) {
      tokens.push({ kind: 'punctuation', text: text[i++], start, end: i });
    } else {
      const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
      if (!literal) throw new Error('invalid_token');
      i += literal[0].length;
      tokens.push({ kind: 'literal', text: literal[0], start, end: i });
    }
  }
  return tokens;
}

// Only two observed framing defects are recoverable. Quoted strings and
// primitive tokens remain byte-for-byte unchanged. Reviews/planning never use
// this helper; the recovered draft must still pass every normal quality gate.
export function recoverEditorialDraftJson(raw: unknown): {
  value: unknown;
  repair: { insertedSectionClosers: number[]; removedTrailingClosers: number };
} | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('parseError' in raw) ||
    raw.parseError !== 'invalid_json_syntax' ||
    !('invalidJson' in raw) ||
    typeof raw.invalidJson !== 'string' ||
    raw.invalidJson.length > 500_000
  )
    return null;
  try {
    const text = raw.invalidJson,
      tokens = tokensFor(text),
      insertions: number[] = [];
    let i = 0;
    const peek = () => tokens[i]?.text;
    const take = (expected: string) => {
      if (peek() !== expected) throw new Error('invalid_structure');
      i++;
    };
    const value = (path: string[], depth: number): void => {
      if (depth > 32 || !tokens[i]) throw new Error('incomplete_structure');
      if (peek() === '{') {
        take('{');
        if (peek() !== '}')
          for (;;) {
            if (tokens[i]?.kind !== 'string') throw new Error('invalid_key');
            const key = JSON.parse(tokens[i++].text) as string;
            take(':');
            value([...path, key], depth + 1);
            if (peek() !== ',') break;
            take(',');
          }
        take('}');
      } else if (peek() === '[') {
        take('[');
        if (peek() !== ']')
          for (;;) {
            value([...path, '*'], depth + 1);
            if (peek() !== ',') break;
            if (
              path.length === 2 &&
              ['zh', 'en'].includes(path[0]) &&
              path[1] === 'sections' &&
              tokens[i + 1]?.kind === 'string' &&
              JSON.parse(tokens[i + 1].text) === 'figure' &&
              tokens[i + 2]?.text === ':'
            ) {
              if (insertions.length >= 2) throw new Error('too_many_repairs');
              insertions.push(tokens[i].start);
              return; // Insert ] before the edition's comma; do not consume it.
            }
            take(',');
          }
        take(']');
      } else if (tokens[i].kind === 'string' || tokens[i].kind === 'literal') i++;
      else throw new Error('invalid_value');
    };
    if (peek() !== '{') return null;
    value([], 0);
    const end = tokens[i - 1].end,
      tail = tokens.slice(i);
    if (tail.length > 4 || tail.some((token) => token.text !== '}' && token.text !== ']')) return null;
    if (!insertions.length && !tail.length) return null;
    let repaired = text.slice(0, end);
    for (const position of [...insertions].sort((a, b) => b - a))
      repaired = repaired.slice(0, position) + ']' + repaired.slice(position);
    const parsed = JSON.parse(repaired);
    // Re-tokenization proves no string, key, number, boolean or null was changed,
    // dropped, fabricated or moved by the structural edit.
    const content = (list: Token[]) => list.filter((t) => t.kind !== 'punctuation').map((t) => t.text);
    if (JSON.stringify(content(tokens)) !== JSON.stringify(content(tokensFor(repaired)))) return null;
    return {
      value: parsed,
      repair: { insertedSectionClosers: insertions, removedTrailingClosers: tail.length },
    };
  } catch {
    return null;
  }
}
