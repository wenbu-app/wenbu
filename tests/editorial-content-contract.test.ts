import { describe, expect, it } from 'vitest';
import { fixtureDraft, fixtureFocusedDraft } from './helpers/editorial-fixture';
import { editorialTopics, editorialSources } from '../src/data/editorial-topics';
import {
  draftIssues,
  editorialContentContract,
  editorialDraftSchema,
  editorialSchemaFor,
  editionText,
  type ResearchSource,
} from '../worker/editorial-schema';
import { focusedDraftShape, draftShape } from '../worker/editorial-research';

const topic = { ...editorialTopics.find((t) => t.id === 'daily-reflection')!, mode: 'extend' as const };
const supporting: ResearchSource[] = ['daily', 'tarot', 'review'].map((id) => ({
  id,
  ...editorialSources[id],
  fetchedAt: '2026-10-26T00:00:00Z',
  hash: 'a'.repeat(64),
  excerpt: 'Source material used for a practice.',
  truncated: false,
}));
const originals: ResearchSource[] = (['zh', 'en'] as const).map((lang) => ({
  id: 'current-' + lang,
  title: 'Fetched canonical owner',
  url: `https://wenbu.app/knowledge/${lang}/${topic.slug}.md`,
  role: 'Current owner',
  fetchedAt: '2026-10-26T00:00:00Z',
  hash: 'b'.repeat(64),
  excerpt: editionText(fixtureDraft()[lang]),
  truncated: false,
}));
const sources = [...supporting, ...originals];

describe('contextual editorial content contract', () => {
  it('requires an existing-owner task and both exact fetched owners before selecting an addition', () => {
    expect(editorialContentContract(topic, sources).kind).toBe('focused_addition');
    for (const packet of [
      supporting,
      sources.filter((s) => s.id !== 'current-en'),
      sources.map((s) => (s.id === 'current-en' ? { ...s, truncated: true } : s)),
      sources.map((s) => (s.id === 'current-en' ? { ...s, url: s.url + '?another=owner' } : s)),
      sources.map((s) =>
        s.id === 'current-en' ? { ...s, url: 'https://example.com/knowledge/en/' + topic.slug + '.md' } : s,
      ),
    ]) {
      expect(editorialContentContract(topic, packet).kind).toBe('complete_guide');
      expect(editorialSchemaFor(topic, packet).safeParse(fixtureFocusedDraft()).success).toBe(false);
    }
    expect(editorialContentContract({ ...topic, mode: 'new' }, sources).kind).toBe('complete_guide');
  });
  it('admits a useful focused artifact without requiring another complete guide', () => {
    const draft = fixtureFocusedDraft();
    expect(editorialSchemaFor(topic, sources).safeParse(draft).success).toBe(true);
    expect(editorialDraftSchema.safeParse(draft).success).toBe(false);
    expect(draftIssues(draft, sources, topic)).toEqual([]);
    expect(draftIssues(draft, sources, { ...topic, mode: 'new' })).toContain('en:insufficient_depth');
    expect(editionText(draft.en).split(/\s+/).length).toBeLessThan(850);
    expect(focusedDraftShape.zh.sections).toHaveLength(2);
    expect(draftShape.zh.sections).toHaveLength(4);
  });
  it('keeps evidence, source, bilingual, placeholder and certainty gates on a short addition', () => {
    const draft = fixtureFocusedDraft();
    draft.zh.evidence[0].quote = 'An invented passage';
    draft.en.sections[0].sourceIds = ['unread-source'];
    draft.en.answer =
      'A guaranteed prediction is an unsupported claim that must still be rejected, even when the writer chooses a short answer.';
    draft.zh.faq[0].answer = '待补充正文';
    draft.en.table.rows.pop();
    expect(draftIssues(draft, sources, topic)).toEqual(
      expect.arrayContaining([
        'zh:unverified_evidence_quote',
        'en:unread_source',
        'en:unsupported_claim',
        'zh:unsafe_or_placeholder_text',
        'bilingual_structure',
      ]),
    );
    expect(
      editorialSchemaFor(topic, sources).safeParse({ ...draft, contentContract: 'focused_addition' }).success,
    ).toBe(false);
  });
  it('rejects substantial literal repetition of an owner while allowing a correction to retain accurate text', () => {
    const draft = fixtureFocusedDraft();
    draft.en.sections[0].paragraphs[0] = fixtureDraft().en.sections[0].paragraphs[0];
    expect(draftIssues(draft, sources, topic)).toContain('en:repeated_owner_paragraph');
    expect(draftIssues(draft, sources, topic, { correction: true })).not.toContain(
      'en:repeated_owner_paragraph',
    );
    expect(editorialContentContract(topic, sources, { correction: true })).toMatchObject({
      kind: 'focused_addition',
      purpose: 'correction',
    });
  });
  it('keeps the legacy complete guide contract and does not migrate or trim old editions', () => {
    expect(editorialDraftSchema.safeParse(fixtureDraft()).success).toBe(true);
    expect(editorialSchemaFor(topic, sources).safeParse(fixtureDraft()).success).toBe(true);
    expect(draftIssues(fixtureDraft(), supporting, { ...topic, mode: 'new' })).toEqual([]);
  });
});
