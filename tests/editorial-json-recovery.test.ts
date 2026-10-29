import { describe, expect, it } from 'vitest';
import { recoverEditorialDraftJson } from '../worker/editorial-json-recovery';
import { editorialDraftSchema as draftSchema } from '../worker/editorial-schema';
import { fixtureDraft } from './helpers/editorial-fixture';

const wrapped = (invalidJson: string) => ({ parseError: 'invalid_json_syntax', invalidJson });

describe('bounded editorial draft JSON recovery', () => {
  it('recovers an extra root closer without changing the bilingual article', () => {
    const draft = fixtureDraft();
    const result = recoverEditorialDraftJson(wrapped(JSON.stringify(draft) + '}'));
    expect(result?.value).toEqual(draft);
    expect(result?.repair).toEqual({ insertedSectionClosers: [], removedTrailingClosers: 1 });
    expect(draftSchema.safeParse(result?.value).success).toBe(true);
  });

  it('closes only the edition sections array at its figure sibling', () => {
    const draft = fixtureDraft();
    const malformed = JSON.stringify(draft).replaceAll('}],"figure":', '},"figure":');
    expect(() => JSON.parse(malformed)).toThrow();
    const result = recoverEditorialDraftJson(wrapped(malformed + '}'));
    expect(result?.value).toEqual(draft);
    expect(result?.repair.insertedSectionClosers).toHaveLength(2);
    expect(result?.repair.removedTrailingClosers).toBe(1);
    expect(draftSchema.safeParse(result?.value).success).toBe(true);
  });

  it('preserves quoted delimiters, escapes, Unicode and primitive values exactly', () => {
    const draft = {
      zh: {
        sections: [{ text: '引号 " / \\ / ],"figure": / 😀', n: -1.25e3, flag: false, nil: null }],
        figure: {},
      },
      en: { sections: [{ text: 'Do not repair quoted } ] or move words.' }], figure: {} },
    };
    const result = recoverEditorialDraftJson(
      wrapped(JSON.stringify(draft).replaceAll('}],"figure":', '},"figure":')),
    );
    expect(result?.value).toEqual(draft);
    // Structural recovery never makes an incomplete or unsupported article valid.
    expect(draftSchema.safeParse(result?.value).success).toBe(false);
  });

  it('does not normalize already valid output or non-syntax provider failures', () => {
    const json = JSON.stringify(fixtureDraft());
    for (const raw of [
      JSON.parse(json),
      wrapped(json),
      { parseError: 'truncated', invalidJson: json + '}' },
      null,
    ])
      expect(recoverEditorialDraftJson(raw)).toBeNull();
  });

  it.each([
    '{"zh":[',
    '{"zh":{"sections":[{"text":"unfinished',
    '{"zh":{"sections":[{"text":"bad\\q"}],"figure":{}}}}}',
    '{"zh":{"sections":[{"text":"line\nbreak"}],"figure":{}}}}}',
    '{"zh":{"sections":[{"text":"unescaped "quote""}],"figure":{}}}}}',
    '{"zh":{"sections":[{},],"figure":{}}}}',
    '{"zh":{"faq":[{},"figure":{}}}}',
    '{"zh":{"sections":[{},"table":{}}}}',
    '{"zh":{"sections":[{},"figure":{}}',
    '{"zh":{"sections":[{}],"figure":{}}} another answer',
    '{"zh":{}}{"en":{}}',
    '{"zh":{},/* comment */"en":{}}}',
    '```json\n{"zh":{}}\n```',
    '{"zh":{}}}}}}}',
    '{"n":01}}',
    '{"n":truefalse}}',
    '{"nested":' + '['.repeat(40) + '0' + ']'.repeat(40) + '}}',
    '{"oversized":"' + 'x'.repeat(500_000) + '"}}',
  ])('refuses unsupported or incomplete framing: %s', (json) => {
    expect(recoverEditorialDraftJson(wrapped(json))).toBeNull();
  });
});
