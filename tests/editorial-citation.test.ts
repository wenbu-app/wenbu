import { describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { fixtureDraft } from './helpers/editorial-fixture';
import { editorialTopics } from '../src/data/editorial-topics';
import type { EditorialDocument } from '../worker/editorial-schema';
import { readCompleteLibrary, SupersededLibraryCitation } from '../worker/editorial-library';
import { executeAgentTool } from '../worker/agent-tools';
import { handleMcp } from '../worker/mcp';

async function correctedOwner() {
  const { env, sql } = database();
  env.EDITORIAL_ENABLED = 'true';
  env.SITE_URL = 'https://wenbu.app';
  const topic = editorialTopics.find((t) => t.id === 'first-reading-update')!;
  const old: EditorialDocument = {
    ...fixtureDraft(),
    topic,
    sources: [],
    publishedAt: '2026-10-15T01:00:00Z',
    updatedAt: '2026-10-15T01:00:00Z',
    revision: 'a'.repeat(64),
    review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
  };
  old.en.sections[0].paragraphs = ['WITHDRAWN-PRIVATE-TEXT'];
  const current = structuredClone(old);
  current.revision = 'b'.repeat(64);
  current.en.sections[0].paragraphs = ['Corrected public explanation.'];
  sql
    .prepare('INSERT INTO editorial_publications VALUES(?,?,?,?,?,?,?)')
    .run('learn/first-reading', topic.id, current.revision, JSON.stringify(current), 1, 2, 'test-current');
  sql
    .prepare('INSERT INTO editorial_revisions VALUES(?,?,?,?,?)')
    .run(old.revision, 'learn/first-reading', JSON.stringify(old), 'test-old', 1);
  return { env, sql, old, current, pinned: `editorial-${old.revision.slice(0, 24)}-section-0` };
}

describe('corrected library citation recovery', () => {
  it.each(['en', 'zh'] as const)('provides a metadata-only current-owner pointer in %s', async (locale) => {
    const { env, current, pinned } = await correctedOwner();
    let caught: unknown;
    try {
      await readCompleteLibrary(`guide-first-reading#${pinned}`, locale, undefined, env);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SupersededLibraryCitation);
    const recovery = (caught as SupersededLibraryCitation).recovery;
    expect(recovery).toMatchObject({
      code: 'source_superseded',
      recoverable: true,
      requestedSection: pinned,
      current: {
        id: 'guide-first-reading',
        revision: current.revision,
        url: `https://wenbu.app/${locale === 'en' ? 'en/' : ''}learn/first-reading/`,
      },
      nextAction: { tool: 'read_library', arguments: { id: 'guide-first-reading', locale } },
    });
    expect(JSON.stringify(recovery)).not.toContain('WITHDRAWN-PRIVATE-TEXT');
    expect(recovery).not.toHaveProperty('source');
    expect(recovery).not.toHaveProperty('content');
    const refreshed = await readCompleteLibrary(recovery.nextAction.arguments.id, locale, undefined, env);
    expect(refreshed.scope).toBe('full');
    expect(refreshed.content).not.toContain('WITHDRAWN-PRIVATE-TEXT');
  });

  it('does not turn invented sections, other owners, or conflicting IDs into recovery receipts', async () => {
    const { env, sql, pinned, old } = await correctedOwner();
    for (const section of [
      pinned.replace('section-0', 'section-9999'),
      pinned.replace('a'.repeat(24), 'c'.repeat(24)),
      pinned.replace('section-0', 'section-00'),
      'editorial-section-9999',
    ])
      await expect(readCompleteLibrary('guide-first-reading', 'en', section, env)).rejects.toThrow(
        /^Unknown document section/,
      );
    sql.prepare('UPDATE editorial_revisions SET path=?').run('learn/bazi-basics');
    await expect(readCompleteLibrary('guide-first-reading', 'en', pinned, env)).rejects.toThrow(
      /^Unknown document section/,
    );
    sql
      .prepare('INSERT INTO editorial_revisions VALUES(?,?,?,?,?)')
      .run(
        old.revision.slice(0, 24) + 'c'.repeat(40),
        'learn/first-reading',
        JSON.stringify(old),
        'other',
        1,
      );
    sql.prepare('UPDATE editorial_revisions SET path=?').run('learn/first-reading');
    await expect(readCompleteLibrary('guide-first-reading', 'en', pinned, env)).rejects.toThrow(
      /^Unknown document section/,
    );
    await expect(
      readCompleteLibrary(`guide-first-reading#${pinned}`, 'en', 'another-section', env),
    ).rejects.toThrow('Conflicting');
  });

  it('continues serving a still-public retained addition by its exact revision citation', async () => {
    const { env, sql, old, current, pinned } = await correctedOwner();
    old.en.sections[0].paragraphs = ['Still public, verified earlier addition.'];
    current.previousAdditions = [old];
    sql.prepare('UPDATE editorial_publications SET document_json=?').run(JSON.stringify(current));
    const read = await readCompleteLibrary('guide-first-reading', 'en', pinned, env);
    expect(read.scope).toBe('section');
    expect(read.content).toContain('Still public, verified earlier addition.');
    expect(read.source.id).toBe(`guide-first-reading#${pinned}`);
  });

  it('does not register a withdrawn section as read evidence for Agent reports', async () => {
    const { env, pinned } = await correctedOwner();
    const ctx = {
      env,
      locale: 'en' as const,
      signal: new AbortController().signal,
      emit: vi.fn(),
      sources: new Map(),
    };
    await expect(
      executeAgentTool('read_library', { id: 'guide-first-reading', section: pinned }, ctx),
    ).rejects.toBeInstanceOf(SupersededLibraryCitation);
    expect(ctx.sources.size).toBe(0);
    expect(ctx.emit).not.toHaveBeenCalled();
    await executeAgentTool('read_library', { id: 'guide-first-reading' }, ctx);
    expect(ctx.sources.has('guide-first-reading')).toBe(true);
    expect(ctx.sources.has(`guide-first-reading#${pinned}`)).toBe(false);
  });

  it('returns an MCP tool error that clients can recover without mistaking it for source content', async () => {
    const { env, pinned } = await correctedOwner();
    const response = await handleMcp(
      new Request('https://wenbu.app/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'read_library',
            arguments: { id: 'guide-first-reading', section: pinned, locale: 'en' },
          },
        }),
      }),
      undefined,
      env,
    );
    const body = (await response.json()) as {
      result: { isError: boolean; structuredContent: Record<string, unknown> };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent).toMatchObject({ error: { code: 'source_superseded' } });
    expect(JSON.stringify(body)).not.toContain('WITHDRAWN-PRIVATE-TEXT');
    expect(body.result.structuredContent).not.toHaveProperty('source');
  });
});
