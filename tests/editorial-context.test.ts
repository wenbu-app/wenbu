import { expect, test } from 'vitest';
import { editorialTopics } from '../src/data/editorial-topics';
import {
  editorialDirectory,
  editorialEvidenceReader,
  readEditorialCatalog,
  relatedEditorialOwners,
} from '../worker/editorial-context';
import { pathForTopic, type EditorialDocument } from '../worker/editorial-schema';
import type { Env } from '../worker/types';
import { database } from './helpers/analytics-db';
import { fixtureDraft } from './helpers/editorial-fixture';

test('canonical originals are read on demand and cached by the committed revision', async () => {
  const { env, sql } = database();
  const entries = new Map<string, string>();
  env.ANALYTICS_ARCHIVE = {
    get: async (key: string) => {
      const entry = entries.get(key);
      return entry ? { json: async () => JSON.parse(entry) } : null;
    },
    put: async (key: string, data: string) => entries.set(key, data),
  } as unknown as Env['ANALYTICS_ARCHIVE'];
  const topic = editorialTopics[0];
  const path = pathForTopic(topic);
  const write = (doc: EditorialDocument) => {
    const body = JSON.stringify(doc);
    sql
      .prepare('INSERT INTO editorial_revisions VALUES (?,?,?,?,?)')
      .run(doc.revision, path, body, 'test', 1);
    sql
      .prepare('INSERT OR REPLACE INTO editorial_publications VALUES (?,?,?,?,?,?,?)')
      .run(path, topic.id, doc.revision, body, 1, 1, 'test');
  };
  const old = {
    ...fixtureDraft(),
    topic,
    revision: 'old',
    sources: [],
    publishedAt: '',
    updatedAt: '',
    review: { factual: true, bilingual: true, useful: true, original: true, natural: true, issues: [] },
  };
  old.en.sections[0].paragraphs[0] = 'Earlier bilingual addition full text.';
  write(old);
  const current = { ...old, ...fixtureDraft(), revision: 'current' };
  current.en.sections[0].paragraphs[0] = 'Current bilingual addition full text.';
  write({ ...current, previousAdditions: [old] });

  const catalog = await readEditorialCatalog(env);
  expect(JSON.stringify(editorialDirectory(catalog))).not.toContain('Earlier bilingual addition full text.');
  expect(relatedEditorialOwners(catalog, topic)[0]).toBe(path);
  expect(entries.size).toBe(0);
  const [first] = await editorialEvidenceReader(env, catalog)([path, path]);
  expect(first).toMatchObject({ cache: 'miss', revision: 'current' });
  expect(first.coverage).toContain('Earlier bilingual addition full text.');
  expect(first.coverage).toContain('Current bilingual addition full text.');
  expect((await editorialEvidenceReader(env, catalog)([path]))[0]).toMatchObject({ cache: 'hit' });

  write({ ...current, revision: 'replacement' });
  const [replacement] = await editorialEvidenceReader(env, await readEditorialCatalog(env))([path]);
  expect(replacement).toMatchObject({ cache: 'miss', revision: 'replacement' });
  expect(replacement.coverage).not.toContain('Earlier bilingual addition full text.');
});
