import { describe, expect, it } from 'vitest';
import { articles } from '../src/data/articles';
import { guideDepth } from '../src/data/guide-depth';
import { guideMarkdown, guideOutline, knowledgeDocument, knowledgeIndex } from '../src/lib/knowledge';
import { readLibrary, libraryContextSnapshot } from '../worker/agent-library';
import { executeAgentTool } from '../worker/agent-tools';
import { handleMcp } from '../worker/mcp';

const guides = articles.filter((a) => a.category === 'learn');
describe('complete illustrated knowledge editions', () => {
  it('covers the entire catalogue with bilingual examples, accessible figure descriptions and scoped sources', () => {
    expect(Object.keys(guideDepth).sort()).toEqual(guides.map((a) => a.slug).sort());
    for (const article of guides)
      for (const locale of ['zh', 'en'] as const) {
        const doc = knowledgeDocument(article, locale);
        expect(doc.answer!.length).toBeGreaterThan(60);
        expect(doc.figure!.description.length).toBeGreaterThan(50);
        expect(doc.table!.rows.length).toBeGreaterThanOrEqual(4);
        expect(doc.table!.rows.every((row) => row.length === doc.table!.columns.length)).toBe(true);
        expect(doc.example!.steps.length).toBeGreaterThanOrEqual(3);
        expect(doc.faq!.length).toBeGreaterThanOrEqual(3);
        expect(
          doc.sources.every(
            (s) => s.url.startsWith('https://') && typeof s.scope === 'string' && s.scope.length > 10,
          ),
        ).toBe(true);
        expect(new Set(doc.outline.map((x) => x.id)).size).toBe(doc.outline.length);
      }
  });
  it('preserves every section, table cell, example, FAQ and source through full MCP and Markdown reads', () => {
    let longest = 0;
    for (const article of guides)
      for (const locale of ['zh', 'en'] as const) {
        const doc = knowledgeDocument(article, locale);
        const content = guideMarkdown(article, locale);
        const reading = readLibrary(doc.id, locale);
        expect(reading.content).toBe(content);
        expect(reading.scope).toBe('full');
        expect(reading.truncated).toBe(false);
        for (const s of doc.sections) for (const p of s.paragraphs) expect(content).toContain(p);
        for (const row of doc.table!.rows)
          for (const cell of row) expect(content).toContain(cell.replace(/\|/g, '\\|'));
        for (const step of doc.example!.steps) expect(content).toContain(step);
        for (const faq of doc.faq!) expect(content).toContain(faq.answer);
        for (const source of doc.sources) {
          expect(content).toContain(source.url);
          expect(content).toContain(source.scope);
        }
        longest = Math.max(longest, content.length);
      }
    expect(longest).toBeGreaterThan(9000); // Regression: the previous reader silently discarded the tail.
  });
  it('keeps section reads explicit and rejects unknown or inapplicable section IDs', () => {
    const article = guides.find((a) => a.slug === 'bazi-basics')!;
    const read = readLibrary('guide-bazi-basics', 'en', 'worked-example');
    expect(read.scope).toBe('section');
    expect(read.section).toBe('worked-example');
    expect(read.source.url.endsWith('#worked-example')).toBe(true);
    expect(read.content).toContain(guideDepth[article.slug].en.example.conclusion);
    expect(read.content).not.toContain(guideDepth[article.slug].en.faq[0].answer);
    expect(read.outline).toEqual(guideOutline(article, 'en'));
    expect(() => readLibrary('guide-bazi-basics', 'en', 'not-a-section')).toThrow();
    expect(() => readLibrary('hexagram-1', 'en', 'worked-example')).toThrow();
  });
  it('keeps section citations distinct and restores exactly their original scope', async () => {
    const sources = new Map();
    for (const section of ['worked-example', 'questions'])
      await executeAgentTool(
        'read_library',
        { id: 'guide-bazi-basics', section },
        { locale: 'en', signal: new AbortController().signal, emit: () => {}, sources },
      );
    expect([...sources.keys()]).toEqual(['guide-bazi-basics#worked-example', 'guide-bazi-basics#questions']);
    const receipt = libraryContextSnapshot('guide-bazi-basics#worked-example', 'en');
    expect(receipt.scope).toBe('section');
    expect(receipt.requiresReadBeforeCitation).toBe(false);
    expect(receipt.source.url).toContain('#worked-example');
    expect(receipt.content).toContain(guideDepth['bazi-basics'].en.example.conclusion);
    const preview = libraryContextSnapshot('guide-bazi-basics', 'en');
    expect(preview.scope).toBe('preview');
    expect(preview.truncated).toBe(true);
    expect(preview.requiresReadBeforeCitation).toBe(true);
    expect(() => readLibrary('guide-bazi-basics#questions', 'en', 'worked-example')).toThrow();
  });
  it('supplies only public guide links in a complete bilingual catalogue', () => {
    const index = knowledgeIndex();
    expect(index.guides.length).toBe(24);
    for (const guide of index.guides) {
      expect(guide.translations.map((t) => t.locale)).toEqual(['zh', 'en']);
      for (const edition of guide.translations) {
        expect(new URL(edition.html).origin).toBe('https://wenbu.app');
        expect(edition.markdown.endsWith(`/${edition.locale}/${guide.slug}.md`)).toBe(true);
        expect(edition.json.endsWith(`/${edition.locale}/${guide.slug}.json`)).toBe(true);
      }
    }
  });
  it('executes a focused read in the built-in Agent without treating reference links as fetched sources', async () => {
    const sources = new Map();
    const result = await executeAgentTool(
      'read_library',
      { id: 'guide-bazi-basics', section: 'worked-example' },
      { locale: 'en', signal: new AbortController().signal, emit: () => {}, sources },
    );
    expect(result).toMatchObject({ scope: 'section', section: 'worked-example', truncated: false });
    expect([...sources.keys()]).toEqual(['guide-bazi-basics#worked-example']);
  });
  it('exposes the catalogue resource and section read over the actual MCP transport', async () => {
    const call = async (method: string, params: unknown) =>
      (
        await handleMcp(
          new Request('https://wenbu.app/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          }),
        )
      ).json() as Promise<{
        result: {
          contents: { text: string }[];
          structuredContent: { scope: string; content: string };
          isError?: boolean;
        };
      }>;
    const index = await call('resources/read', { uri: 'wenbu://knowledge' });
    expect(JSON.parse(index.result.contents[0].text).guides).toHaveLength(24);
    const example = await call('tools/call', {
      name: 'read_library',
      arguments: { id: 'guide-iching-three-coins', locale: 'zh', section: 'worked-example' },
    });
    expect(example.result.structuredContent.scope).toBe('section');
    expect(example.result.structuredContent.content).toContain('47');
    const invalid = await call('tools/call', {
      name: 'read_library',
      arguments: { id: 'guide-iching-three-coins', section: '../../private' },
    });
    expect(invalid.result.isError).toBe(true);
  });
});
