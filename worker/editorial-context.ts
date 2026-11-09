import type { EditorialTopic } from '../src/data/editorial-topics';
import { editorialDocumentCoverage, editorialOwners, type EditorialOwner } from './editorial-commissioning';
import { contentHash, pathForTopic, type EditorialDocument } from './editorial-schema';
import type { Env } from './types';

export const EDITORIAL_CONTEXT_VERSION = 'targeted-v1';
export const EDITORIAL_OWNER_BYTES = 180_000;
export const COMMISSIONING_OWNER_BYTES = 360_000;
const encoder = new TextEncoder();

export function jsonBytes(value: unknown) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

type CatalogTopic = EditorialTopic & { state?: string };
type PublicationMetadata = {
  path: string;
  revision: string;
  title: string;
  description: string;
  zh_headings: string;
  en_headings: string;
};

export async function readEditorialCatalog(env: Env, existing?: CatalogTopic[]) {
  const db = env.ANALYTICS!;
  const [topics, publications] = await Promise.all([
    existing ??
      db
        .prepare('SELECT definition_json,status FROM editorial_topics ORDER BY id')
        .all<{ definition_json: string; status: string }>()
        .then(({ results }) =>
          results.map((row) => ({
            ...(JSON.parse(row.definition_json) as EditorialTopic),
            state: row.status,
          })),
        ),
    db
      .prepare(
        `SELECT p.path,p.revision,
       COALESCE(json_extract(p.document_json,'$.en.title'),p.path) AS title,
       COALESCE(json_extract(p.document_json,'$.zh.description'),'') || ' ' ||
         COALESCE(json_extract(p.document_json,'$.en.description'),'') AS description,
       (SELECT json_group_array(json_extract(value,'$.heading')) FROM json_each(p.document_json,'$.zh.sections')) AS zh_headings,
       (SELECT json_group_array(json_extract(value,'$.heading')) FROM json_each(p.document_json,'$.en.sections')) AS en_headings
       FROM editorial_publications p ORDER BY p.path`,
      )
      .all<PublicationMetadata>(),
  ]);
  const owners = new Map(editorialOwners(topics, [], { metadataOnly: true }).map((o) => [o.path, o]));
  for (const row of publications.results) {
    const previous = owners.get(row.path);
    const headings = [
      ...JSON.parse(row.zh_headings),
      ...JSON.parse(row.en_headings),
      ...(previous?.headings ?? []),
    ].filter((value): value is string => typeof value === 'string');
    owners.set(row.path, {
      path: row.path,
      title: row.title,
      description: row.description,
      headings: [...new Set(headings)],
      plannedTasks: previous?.plannedTasks ?? [],
      coverage: '',
      published: true,
      revision: row.revision,
    });
  }
  return [...owners.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function editorialDirectory(owners: EditorialOwner[]) {
  return owners.map((owner) => ({
    path: owner.path,
    title: owner.title.slice(0, 160),
    description: owner.description.slice(0, 220),
    headings: owner.headings.slice(0, 6).map((heading) => heading.slice(0, 90)),
    published: owner.published,
    readyTasks: owner.plannedTasks
      .filter((task) => task.state === 'ready')
      .slice(0, 2)
      .map((task) => task.task.slice(0, 160)),
  }));
}

const commonWords = new Set(['and', 'the', 'for', 'how', 'with', 'what', 'from', 'your', 'guide', 'using']);
function searchTerms(text: string) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const terms = new Set((normalized.match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !commonWords.has(word)));
  for (const run of normalized.match(/\p{Script=Han}{2,}/gu) ?? []) {
    const characters = [...run];
    for (let i = 1; i < characters.length; i++) terms.add(characters[i - 1] + characters[i]);
  }
  return terms;
}

export function relatedEditorialOwners(
  catalog: EditorialOwner[],
  topic: EditorialTopic,
  additionalText = '',
) {
  const exactPath = pathForTopic(topic);
  const terms = searchTerms(
    [
      topic.zh,
      topic.en,
      topic.task,
      topic.unique,
      ...(topic.search?.zh ?? []),
      ...(topic.search?.en ?? []),
      additionalText,
    ].join(' '),
  );
  return catalog
    .filter((owner) => owner.published)
    .map((owner) => {
      const headings = searchTerms([owner.path, owner.title, ...owner.headings].join(' '));
      const description = searchTerms(
        [owner.description, ...owner.plannedTasks.map((task) => task.task)].join(' '),
      );
      let score = 0;
      for (const term of terms) score += headings.has(term) ? 3 : description.has(term) ? 1 : 0;
      return { owner, score, exact: owner.path === exactPath };
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.score - a.score ||
        a.owner.path.localeCompare(b.owner.path, 'en'),
    )
    .map(({ owner }) => owner.path);
}

export type OwnerEvidence = {
  path: string;
  revision: string;
  coverage: string;
  cache: 'hit' | 'miss' | 'bundled';
};

async function readOwnerEvidence(env: Env, owner: EditorialOwner): Promise<OwnerEvidence> {
  const base = editorialOwners([], [], { onlyPath: owner.path })[0]?.coverage ?? '';
  if (!owner.revision) {
    if (!base) throw new Error('editorial_owner_unavailable');
    return { path: owner.path, revision: await contentHash(base), coverage: base, cache: 'bundled' };
  }
  const bucket = env.ANALYTICS_ARCHIVE;
  const key = `editorial/owner-cache/v1/${owner.path}/${owner.revision}.json`;
  try {
    const cached = await bucket?.get(key);
    const entry = await cached?.json<{ path: string; revision: string; coverage: string }>();
    if (
      entry?.path === owner.path &&
      entry.revision === owner.revision &&
      typeof entry.coverage === 'string' &&
      entry.coverage
    )
      return { ...entry, coverage: base ? `${base}\n${entry.coverage}` : entry.coverage, cache: 'hit' };
  } catch {
    // A missing or unreadable cache falls back to the exact saved revision.
  }
  const row = await env
    .ANALYTICS!.prepare(
      `SELECT document_json FROM editorial_publications WHERE path=? AND revision=?
       UNION ALL SELECT document_json FROM editorial_revisions WHERE path=? AND revision=? LIMIT 1`,
    )
    .bind(owner.path, owner.revision, owner.path, owner.revision)
    .first<{ document_json: string }>();
  if (!row) throw new Error('editorial_owner_revision_unavailable');
  const document = JSON.parse(row.document_json) as EditorialDocument;
  if (
    document.revision !== owner.revision ||
    pathForTopic(document.topic) !== owner.path ||
    !document.zh ||
    !document.en
  )
    throw new Error('editorial_owner_revision_mismatch');
  const coverage = editorialDocumentCoverage(document);
  await bucket
    ?.put(key, JSON.stringify({ path: owner.path, revision: owner.revision, coverage }))
    .catch(() => {});
  return {
    path: owner.path,
    revision: owner.revision,
    coverage: base ? `${base}\n${coverage}` : coverage,
    cache: 'miss',
  };
}

export function editorialEvidenceReader(env: Env, catalog: EditorialOwner[]) {
  const owners = new Map(catalog.filter((owner) => owner.published).map((owner) => [owner.path, owner]));
  const loaded = new Map<string, Promise<OwnerEvidence>>();
  return async (paths: string[]) => {
    const evidence = await Promise.all(
      [...new Set(paths)].map((path) => {
        const owner = owners.get(path);
        if (!owner) throw new Error('editorial_owner_unavailable');
        let result = loaded.get(path);
        if (!result) {
          result = readOwnerEvidence(env, owner);
          loaded.set(path, result);
        }
        return result;
      }),
    );
    return evidence.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  };
}

export function modelOwnerEvidence(evidence: OwnerEvidence[]) {
  return evidence.map(({ path, revision, coverage }) => ({ path, revision, coverage }));
}
