import { describe, expect, it, vi } from 'vitest';
import { deliverCodexEditorial, prepareCodexEditorial } from '../worker/editorial-codex';
import { codexEditorialActive } from '../worker/editorial-policy';
import { contentHash, type EditorialDocument } from '../worker/editorial-schema';
import { readEditorialOwner } from '../worker/editorial-research';
import { database } from './helpers/analytics-db';
import { fixtureDraft, fixtureFocusedDraft } from './helpers/editorial-fixture';

const topic = {
  id: 'codex-shadow-fixture',
  slug: 'codex-shadow-fixture',
  category: 'learn',
  mode: 'new',
  tool: 'daily',
  zh: '仅供本地验证的双语试稿',
  en: 'A private fixture for bilingual delivery',
  task: 'Verify that a reviewed bilingual packet can be validated without publishing either edition.',
  unique:
    'Exercise the real delivery code, source receipt, review validation and exact revision replay in an in-memory database.',
  sources: ['daily', 'review', 'tarot'],
  comparisonSourceId: null,
  priority: 70,
};

async function fixture() {
  const { env, sql } = database();
  const archived = new Map<string, string>();
  Object.assign(env, {
    EDITORIAL_ENABLED: 'true',
    EDITORIAL_AUTOPUBLISH: 'true',
    SITE_URL: 'https://wenbu.app',
    ASSETS: {
      fetch: async () =>
        new Response('Source material. '.repeat(24), { headers: { 'Content-Type': 'text/markdown' } }),
    },
    ANALYTICS_ARCHIVE: {
      get: async (key: string) =>
        archived.has(key) ? { json: async () => JSON.parse(archived.get(key)!) } : null,
      put: async (key: string, value: string) => {
        archived.set(key, value);
      },
    },
  });
  const packet = await prepareCodexEditorial(env, { topic });
  const draft = fixtureDraft();
  const input = {
    packet: packet.packet,
    draft,
    draftHash: await contentHash(JSON.stringify(draft)),
    review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
    audit: {
      factual: 'Checked each source excerpt and the claims.',
      bilingual: 'Checked the same three steps in both languages.',
      useful: 'Checked the original task against the exercise.',
      original: 'Checked the closest published canonical guides.',
      natural: 'Read both language editions from start to finish.',
    },
  };
  return { env, sql, input, packet };
}

describe('Codex editorial delivery', () => {
  it('prepares and validates long bilingual originals including their retained additions', async () => {
    const { env, sql, input, packet: initial } = await fixture();
    const revision = 'a'.repeat(64);
    const sources = initial.sources.map(({ excerpt: _, ...source }) => source);
    const date = '2026-11-01T00:00:00.000Z';
    const original: EditorialDocument = {
      ...fixtureDraft(),
      topic: initial.topic,
      sources,
      revision,
      publishedAt: date,
      updatedAt: date,
      review: input.review,
      previousAdditions: Array.from({ length: 4 }, (_, index) => ({
        ...fixtureDraft(),
        sources,
        revision: String(index + 1).repeat(64),
        publishedAt: date,
        updatedAt: date,
      })),
    };
    const path = 'learn/' + topic.slug;
    sql
      .prepare('INSERT INTO editorial_publications VALUES(?,?,?,?,?,?,?)')
      .run(path, topic.id, revision, JSON.stringify(original), 1, 1, 'synthetic-owner');
    const extension = { ...topic, id: 'codex-long-owner-extension', mode: 'extend' as const };
    expect((await readEditorialOwner(env, extension)).find((s) => s.id === 'current-en')?.truncated).toBe(
      true,
    );

    const prepared = await prepareCodexEditorial(env, { topic: extension });
    const owner = prepared.sources.find((s) => s.id === 'current-en')!;
    expect(owner.excerpt.length).toBeGreaterThan(30000);
    expect(owner.truncated).toBe(false);
    expect(prepared.contract.kind).toBe('focused_addition');
    expect(prepared.expectedRevision).toBe(revision);
    expect(prepared.reviewedOwners.find((o) => o.path === path)?.coverage).toContain('previousAdditions');
    const draft = fixtureFocusedDraft();
    const reviewed = {
      ...input,
      packet: prepared.packet,
      draft,
      draftHash: await contentHash(JSON.stringify(draft)),
    };
    await expect(deliverCodexEditorial(env, reviewed)).resolves.toMatchObject({ status: 'validated' });
    original.en.answer += ' A source changed after preparation.';
    sql
      .prepare('UPDATE editorial_publications SET document_json=? WHERE path=?')
      .run(JSON.stringify(original), path);
    await expect(deliverCodexEditorial(env, reviewed)).rejects.toMatchObject({ code: 'codex_owner_changed' });
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_runs').get()?.n).toBe(0);
    expect(sql.prepare('SELECT COUNT(*) n FROM model_usage').get()?.n).toBe(0);
  });

  it('validates a reviewed pair without public rows and refuses a changed draft or inactive publish', async () => {
    const { env, sql, input } = await fixture();
    await expect(deliverCodexEditorial(env, input)).resolves.toMatchObject({ status: 'validated' });
    await expect(deliverCodexEditorial(env, { ...input, publish: true })).rejects.toMatchObject({
      code: 'codex_publish_inactive',
    });
    await expect(
      deliverCodexEditorial(env, {
        ...input,
        draft: { ...input.draft, en: { ...input.draft.en, title: 'Changed title' } },
      }),
    ).rejects.toMatchObject({ code: 'codex_review_revision_mismatch' });
    await expect(
      deliverCodexEditorial(env, { ...input, review: { ...input.review, factual: false } }),
    ).rejects.toMatchObject({ code: 'codex_review_blocked' });
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_publications').get()?.n).toBe(0);
    expect(sql.prepare('SELECT COUNT(*) n FROM search_console_queue').get()?.n).toBe(0);
  });

  it('commits both languages once and returns the exact receipt on retry', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T13:05:00Z'));
    try {
      const { env, sql, input } = await fixture();
      env.EDITORIAL_CODEX_FROM = '2026-11-10';
      expect(codexEditorialActive(env, Date.parse('2026-11-09T15:59:59Z'))).toBe(false);
      const published = await deliverCodexEditorial(env, { ...input, publish: true });
      expect(published).toMatchObject({ status: 'published', slot: '2026-11-10-codex-01', replayed: false });
      await expect(deliverCodexEditorial(env, { ...input, publish: true })).resolves.toMatchObject({
        revision: published.revision,
        status: 'published',
        replayed: true,
      });
      expect(sql.prepare('SELECT COUNT(*) n FROM editorial_publications').get()?.n).toBe(1);
      expect(sql.prepare('SELECT COUNT(*) n FROM editorial_revisions').get()?.n).toBe(1);
      expect(sql.prepare('SELECT COUNT(*) n FROM search_console_queue').get()?.n).toBe(2);
      expect(sql.prepare('SELECT COUNT(*) n FROM model_usage').get()?.n).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });
});
