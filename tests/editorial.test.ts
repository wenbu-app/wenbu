import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureDraft } from './helpers/editorial-fixture';
import { editorialTopics, editorialSources } from '../src/data/editorial-topics';
import {
  editorialDraftSchema,
  draftIssues,
  publicationSlot,
  shanghaiDay,
  type EditorialDocument,
  type ResearchSource,
} from '../worker/editorial-schema';
import {
  claimEditorial,
  publishEditorial,
  releaseEditorial,
  seedEditorial,
  publishedDocuments,
  failEditorial,
} from '../worker/editorial-store';
import { editorialBody, editorialMarkdown, escapeHtml } from '../worker/editorial-render';
import { mergePublishedManifest } from '../worker/editorial-discovery';
import { dispatchEditorial } from '../worker/editorial-workflow';
import { database } from './helpers/analytics-db';
import { safePage, registerEditorialPaths } from '../src/lib/analytics-contract';
import { contentTarget } from '../worker/traffic';
import { substantiveContent, indexNowManifest } from '../scripts/lib/indexnow.mjs';
import { readCompleteLibrary, searchCompleteLibrary } from '../worker/editorial-library';

const sources: ResearchSource[] = ['daily', 'tarot', 'review'].map((id) => ({
  id,
  ...editorialSources[id],
  fetchedAt: '2026-10-15T01:00:00Z',
  hash: 'a'.repeat(64),
  excerpt: 'Source material used for a practice.',
  truncated: true,
}));

function doc(topic = editorialTopics.find((t) => t.id === 'daily-reflection')!): EditorialDocument {
  return {
    ...fixtureDraft(),
    topic,
    sources: sources.map(({ excerpt: _, ...s }) => s),
    publishedAt: '2026-10-15T01:00:00Z',
    updatedAt: '2026-10-15T01:00:00Z',
    revision: 'b'.repeat(64),
    review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
  };
}
afterEach(() => vi.restoreAllMocks());
describe('editorial gates', () => {
  it('uses three stable Shanghai slots across day boundaries', () => {
    expect(shanghaiDay(Date.parse('2026-10-15T16:00:00Z'))).toBe('2026-10-16');
    expect(publicationSlot(Date.parse('2026-10-15T01:00:00Z'))).toBe('2026-10-15-09');
    expect(publicationSlot(Date.parse('2026-10-15T07:00:00Z'))).toBe('2026-10-15-15');
    expect(publicationSlot(Date.parse('2026-10-15T13:00:00Z'))).toBe('2026-10-15-21');
  });
  it('requires complete equivalent editions and read sources', () => {
    const draft = fixtureDraft();
    expect(editorialDraftSchema.safeParse(draft).success).toBe(true);
    expect(draftIssues(draft, sources, doc().topic)).toEqual([]);
    draft.en.sections[0].sourceIds = ['invented'];
    draft.zh.table.rows[0] = ['mismatch'];
    expect(draftIssues(draft, sources, doc().topic)).toEqual(
      expect.arrayContaining(['en:unread_source', 'zh:table_width']),
    );
  });
  it('rejects thin, repeated, unsafe and unsupported prose', () => {
    const draft = fixtureDraft();
    draft.zh.sections = [];
    draft.en.sections[1].paragraphs[0] = draft.en.sections[0].paragraphs[0];
    draft.en.answer = '<script>alert(1)</script>';
    draft.en.description = '100% accurate is a guaranteed prediction';
    expect(draftIssues(draft, sources, doc().topic)).toEqual(
      expect.arrayContaining([
        'zh:insufficient_depth',
        'en:repeated_paragraph',
        'en:unsafe_or_placeholder_text',
        'en:unsupported_claim',
        'bilingual_structure',
      ]),
    );
  });
  it('escapes model text in every rendered field', () => {
    expect(escapeHtml('<img src=x onerror="x">')).toBe('&lt;img src=x onerror=&quot;x&quot;&gt;');
    const d = doc();
    d.en.title = '<script>';
    d.en.answer = '<script>alert(1)</script>';
    expect(editorialBody(d, 'en')).not.toContain('<script>');
  });
  it('does not infer competitor facts without a fetched vendor source', () => {
    expect(draftIssues(fixtureDraft(), sources, editorialTopics[0])).toContain(
      'comparison_without_vendor_source',
    );
  });
  it('has one initial canonical owner for each reader task', () => {
    expect(new Set(editorialTopics.map((t) => `${t.category}/${t.slug}`)).size).toBe(editorialTopics.length);
    expect(
      editorialTopics.every((t) => t.sources.length >= 2 && t.sources.every((id) => editorialSources[id])),
    ).toBe(true);
  });
});
describe('durable publication', () => {
  it('publishes the pair atomically and retains an immutable revision', async () => {
    const { env, sql } = database();
    env.EDITORIAL_ENABLED = 'true';
    env.EDITORIAL_AUTOPUBLISH = 'true';
    env.SITE_URL = 'https://wenbu.app';
    await seedEditorial(env);
    const topic = await claimEditorial(env, 'run-a', '2026-10-15-09');
    expect(topic?.id).toBe('daily-reflection');
    const result = await publishEditorial(env, 'run-a', doc(topic!));
    expect(result.urls).toHaveLength(2);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM editorial_publications').get()?.n).toBe(1);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM editorial_revisions').get()?.n).toBe(1);
    expect(await claimEditorial(env, 'run-a', '2026-10-15-09')).toBeNull();
    expect((await publishedDocuments(env))[0].zh.title).toContain('日签');
    const hit = (await searchCompleteLibrary('daily card', 'en', 8, env)).find(
      (d) => d.id === 'editorial-daily-reflection',
    );
    expect(hit).toBeTruthy();
    expect((await readCompleteLibrary('editorial-daily-reflection', 'en', undefined, env)).truncated).toBe(
      false,
    );
    expect((await readCompleteLibrary('editorial-daily-reflection', 'zh', undefined, env)).content).toContain(
      '日签',
    );
    expect(
      await mergePublishedManifest(env, {
        version: 1,
        origin: 'https://wenbu.app',
        revision: 'a'.repeat(64),
        pages: [{ url: 'https://wenbu.app/', hash: 'a'.repeat(64) }],
      }),
    ).toMatchObject({
      staticRevision: 'a'.repeat(64),
      pages: expect.arrayContaining([
        { url: 'https://wenbu.app/en/learn/daily-card-reflection/', hash: expect.any(String) },
      ]),
    });
  });
  it('never publishes on a lost lease or disabled publication flag', async () => {
    const { env, sql } = database();
    env.EDITORIAL_AUTOPUBLISH = 'true';
    env.SITE_URL = 'https://wenbu.app';
    await seedEditorial(env);
    await claimEditorial(env, 'run-b', '2026-10-15-15');
    await releaseEditorial(env, 'run-b');
    await expect(publishEditorial(env, 'run-b', doc())).rejects.toThrow('lease_lost');
    expect(sql.prepare('SELECT COUNT(*) AS n FROM editorial_publications').get()?.n).toBe(0);
    env.EDITORIAL_AUTOPUBLISH = 'false';
    await expect(publishEditorial(env, 'run-b', doc())).rejects.toThrow('disabled');
  });
  it('retains quality failures without exposing a draft', async () => {
    const { env, sql } = database();
    await seedEditorial(env);
    await claimEditorial(env, 'run-c', '2026-10-15-21');
    await failEditorial(env, 'run-c', 'quality_gate:unread_source');
    expect(sql.prepare('SELECT status FROM editorial_runs').get()?.status).toBe('blocked');
    expect(sql.prepare('SELECT COUNT(*) AS n FROM editorial_publications').get()?.n).toBe(0);
  });
  it('dispatches a stable instance ID and does not create a fourth daily slot', async () => {
    const { env, sql } = database();
    env.EDITORIAL_ENABLED = 'true';
    const createBatch = vi.fn().mockResolvedValue([]);
    env.EDITORIAL_WORKFLOW = { createBatch } as unknown as NonNullable<typeof env.EDITORIAL_WORKFLOW>;
    await dispatchEditorial(env, Date.parse('2026-10-15T13:00:00Z'));
    expect(createBatch.mock.calls[0][0][0].id).toBe('editorial-2026-10-15-09');
    for (const h of ['09', '15', '21'])
      sql
        .prepare(
          'INSERT OR REPLACE INTO editorial_runs(id,slot,status,created_at,updated_at) VALUES(?,?,?,?,?)',
        )
        .run(h, `2026-10-15-${h}`, 'published', 0, 0);
    expect(await dispatchEditorial(env, Date.parse('2026-10-15T15:59:00Z'))).toMatchObject({
      status: 'no_due_slot',
    });
  });
});
describe('discovery and telemetry boundaries', () => {
  it('ignores runtime/navigation changes while detecting actual article edits', () => {
    const before =
      '<title>Guide</title><nav>Old</nav><main><p>Read a card</p><script src="/_astro/a.js"></script></main>';
    const after = before.replace('Old', 'New').replace('a.js', 'b.js');
    expect(substantiveContent(before)).toBe(substantiveContent(after));
    expect(
      indexNowManifest([{ url: 'https://wenbu.app/learn/test/', html: before }], 'https://wenbu.app')
        .revision,
    ).not.toBe(
      indexNowManifest(
        [
          {
            url: 'https://wenbu.app/learn/test/',
            html: before.replace('Read a card', 'Read and review a card'),
          },
        ],
        'https://wenbu.app',
      ).revision,
    );
  });
  it('only records registered public document IDs, never arbitrary slugs', () => {
    expect(safePage('/learn/unregistered-private-question/')).toBe('/other/');
    registerEditorialPaths(['learn/validated-public-guide']);
    expect(safePage('/en/learn/validated-public-guide/?secret=no')).toBe('/learn/validated-public-guide/');
    expect(contentTarget(new Request('https://wenbu.app/knowledge/zh/validated-public-guide.md'))?.page).toBe(
      '/learn/validated-public-guide/',
    );
    expect(
      contentTarget(new Request('https://wenbu.app/knowledge/zh/unregistered-private-question.md')),
    ).toBeUndefined();
  });
  it('exports figures, examples and actual source scopes as readable text', () => {
    const text = editorialMarkdown(doc(), 'en');
    expect(text).toContain('From observation to review');
    expect(text).toContain('A bounded practice');
    expect(text).toContain('excerpt');
  });
});
