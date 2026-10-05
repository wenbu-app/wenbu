// Read-only release check: compare served pages and their direct bundles with this build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const base = (process.env.WENBU_URL || 'https://wenbu.app').replace(/\/$/, '');
const pages = [
  '/',
  '/en/',
  '/agent/',
  '/en/agent/',
  '/bazi/',
  '/en/bazi/',
  '/en/iching/',
  '/en/tarot/',
  '/en/ziwei/',
  '/en/tarot/deck/',
  '/learn/',
  '/en/learn/',
  '/learn/first-reading/',
  '/en/learn/five-elements/',
  '/journal/',
  '/en/journal/',
  '/insights/',
  '/en/insights/',
];
const evidence = {
  base,
  checkedAt: new Date().toISOString(),
  sourceSha: process.env.WENBU_SOURCE_SHA || null,
  workerVersion: process.env.WENBU_WORKER_VERSION || null,
  pages: [],
  assets: [],
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function compare(path, file) {
  const response = await fetch(base + path, {
    headers: { 'X-Wenbu-Test': 'true', DNT: '1', 'X-Wenbu-Analytics': 'off' },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, path);
  const live = Buffer.from(await response.arrayBuffer()),
    built = await readFile(file);
  assert.equal(hash(live), hash(built), `${path}: served bytes must match the release build`);
  return { path, sha256: hash(live) };
}
const assets = new Set();
for (let i = 0; i < pages.length; i += 4) {
  await Promise.all(
    pages.slice(i, i + 4).map(async (path) => {
      const file = 'dist' + path + 'index.html';
      evidence.pages.push(await compare(path, file));
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/\/_astro\/[A-Za-z0-9_.-]+\.(?:js|css)/g)) assets.add(match[0]);
    }),
  );
}
const bundles = [...assets];
for (let i = 0; i < bundles.length; i += 4)
  evidence.assets.push(
    ...(await Promise.all(bundles.slice(i, i + 4).map((path) => compare(path, 'dist' + path)))),
  );
await compare('/indexnow-manifest.json', 'dist/indexnow-manifest.json');
evidence.manifestRevision = JSON.parse(await readFile('dist/indexnow-manifest.json', 'utf8')).revision;
evidence.pages.sort((a, b) => a.path.localeCompare(b.path));
evidence.assets.sort((a, b) => a.path.localeCompare(b.path));
evidence.result = 'passed';
if (process.env.WENBU_EVIDENCE)
  await writeFile(process.env.WENBU_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
console.log(
  JSON.stringify({
    result: evidence.result,
    pages: evidence.pages.length,
    assets: evidence.assets.length,
    manifestRevision: evidence.manifestRevision,
  }),
);
