import { describe, expect, it, vi } from 'vitest';
import { deliverCodexEditorial, prepareCodexEditorial } from '../worker/editorial-codex';
import { codexEditorialActive } from '../worker/editorial-policy';
import { contentHash } from '../worker/editorial-schema';
import { database } from './helpers/analytics-db';
import { fixtureDraft } from './helpers/editorial-fixture';

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
  return { env, sql, input };
}

describe('Codex editorial delivery', () => {
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
