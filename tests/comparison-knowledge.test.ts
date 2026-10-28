import { describe, expect, it } from 'vitest';
import { comparisons } from '../src/data/comparisons';
import { comparisonDocument, comparisonLinks, comparisonMarkdown } from '../src/lib/comparison-knowledge';
import { knowledgeIndex } from '../src/lib/knowledge';
import { readLibrary } from '../worker/agent-library';
import { completeLibraryDocuments, readCompleteLibrary } from '../worker/editorial-library';
import { handleMcp } from '../worker/mcp';
import { database } from './helpers/analytics-db';
import { fixtureDraft } from './helpers/editorial-fixture';
import { editorialTopics } from '../src/data/editorial-topics';
import type { EditorialDocument } from '../worker/editorial-schema';

describe('complete comparison exports and current-owner reads', () => {
  it.each(['zh', 'en'] as const)(
    'retains every comparison cell, source and original review date in %s',
    (locale) => {
      for (const comparison of comparisons) {
        const doc = comparisonDocument(comparison, locale);
        const read = readLibrary(doc.id, locale);
        expect(doc.updated).toBe(comparison.reviewed);
        expect(read.content).toBe(doc.content);
        expect(read.links).toEqual(comparisonLinks(comparison.slug, locale));
        expect(read.scope).toBe('full');
        expect(read.truncated).toBe(false);
        expect(read.source.kind).toBe('guide');
        for (const row of comparison[locale].rows)
          for (const cell of row) expect(read.content).toContain(cell.replace(/\|/g, '\\|'));
        expect(read.content).toContain(comparison[locale].intro);
        expect(read.content).toContain(comparison[locale].conclusion);
        for (const source of comparison.sources) expect(read.content).toContain(source.url);
        expect(knowledgeIndex().guides.filter((g) => g.slug === doc.slug)).toHaveLength(1);
      }
    },
  );
  it.each(['zh', 'en'] as const)('limits a comparison citation to its selected chapter in %s', (locale) => {
    const comparison = comparisons[0];
    const read = readLibrary('guide-compare-fatetell#comparison-table', locale);
    expect(read.scope).toBe('section');
    expect(read.source.id).toBe('guide-compare-fatetell#comparison-table');
    expect(read.source.url).toBe(comparisonLinks('fatetell', locale).html + '#comparison-table');
    expect(read.content).toContain(comparison[locale].rows.at(-1)![2]);
    expect(read.content).not.toContain(comparison[locale].conclusion);
    expect(() => readLibrary('guide-compare-fatetell', locale, 'invented')).toThrow('Unknown section');
    expect(() => comparisonMarkdown(comparison, locale, 'not-a-section')).toThrow();
  });
  it.each(['zh', 'en'] as const)(
    'keeps the published canonical authoritative through static and existing editorial IDs in %s',
    async (locale) => {
      const { env, sql } = database();
      env.EDITORIAL_ENABLED = 'true';
      env.SITE_URL = 'https://wenbu.app';
      const topic = editorialTopics.find((t) => t.category === 'compare' && t.slug === 'labyrinthos')!;
      expect(topic.mode).toBe('extend');
      const current: EditorialDocument = {
        ...fixtureDraft(),
        topic,
        sources: [],
        publishedAt: '2026-10-20T01:00:00Z',
        updatedAt: '2026-10-21T01:00:00Z',
        revision: 'c'.repeat(64),
        review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
      };
      current[locale].sections[0].paragraphs = ['CURRENT-PUBLISHED-ADDITION'];
      sql
        .prepare('INSERT INTO editorial_publications VALUES(?,?,?,?,?,?,?)')
        .run(
          'compare/labyrinthos',
          topic.id,
          current.revision,
          JSON.stringify(current),
          1,
          2,
          'comparison-test',
        );
      const docs = await completeLibraryDocuments(locale, env);
      expect(docs.filter((d) => d.url === comparisonLinks('labyrinthos', locale).html)).toHaveLength(1);
      for (const id of ['guide-compare-labyrinthos', `editorial-${topic.id}`]) {
        const read = await readCompleteLibrary(id, locale, undefined, env);
        expect(read.content).toContain('CURRENT-PUBLISHED-ADDITION');
        expect(read.source.id).toBe(`editorial-${topic.id}`);
        const part = await readCompleteLibrary(id, locale, 'comparison-table', env);
        expect(part.content).toContain(comparisons[1][locale].rows[0][2]);
        expect(part.content).not.toContain('CURRENT-PUBLISHED-ADDITION');
      }
    },
  );
  it('exposes complete static comparisons through the actual public MCP transport', async () => {
    const call = async (section: string) =>
      (
        await handleMcp(
          new Request('https://wenbu.app/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: {
                name: 'read_library',
                arguments: { id: 'guide-compare-fatetell', locale: 'en', section },
              },
            }),
          }),
        )
      ).json();
    const valid = await call('comparison-table');
    expect(valid.result.structuredContent.scope).toBe('section');
    expect(valid.result.structuredContent.content).toContain('FateBook');
    expect(valid.result.structuredContent.links.json).toBe(
      'https://wenbu.app/knowledge/en/compare-fatetell.json',
    );
    expect((await call('not-a-section')).result.isError).toBe(true);
  });
});
