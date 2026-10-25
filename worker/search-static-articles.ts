import { z } from 'zod';
import type { Env } from './types';

const origin = 'https://wenbu.app';
const manifestSchema = z.object({
  pages: z.array(z.object({ url: z.string().url(), hash: z.string().regex(/^[a-f0-9]{64}$/) })).max(500),
});

/** Read only the deployed build. Never generates content or sends an indexing request. */
export async function reconcileStaticBlogs(env: Env, now = Date.now()) {
  const db = env.ANALYTICS!;
  const response = await env.ASSETS.fetch(new Request(origin + '/indexnow-manifest.json'));
  if (!response.ok) throw new Error('search_static_manifest_unavailable');
  const manifest = manifestSchema.parse(await response.json());
  const pages = manifest.pages.filter(({ url }) => {
    const u = new URL(url);
    if (u.origin !== origin || u.search || u.hash || u.username || u.password)
      throw new Error('search_static_manifest_invalid');
    return /^\/(?:en\/)?blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(u.pathname);
  });
  const initialized = await db
    .prepare('SELECT initialized_at FROM search_static_blog_state WHERE id=1')
    .first();
  if (!initialized) {
    // First observation is a baseline, not permission to resubmit the archive.
    await db.batch([
      ...pages.map((page) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO search_static_blog_revisions(url,revision,updated_at) VALUES(?,?,?)',
          )
          .bind(page.url, page.hash, now),
      ),
      db.prepare('INSERT OR IGNORE INTO search_static_blog_state(id,initialized_at) VALUES(1,?)').bind(now),
    ]);
    return { baseline: true, checked: pages.length, added: 0 };
  }
  let added = 0;
  for (const page of pages) {
    const previous = await db
      .prepare('SELECT revision FROM search_static_blog_revisions WHERE url=?')
      .bind(page.url)
      .first<{ revision: string }>();
    if (previous?.revision === page.hash) continue;
    const guard = 'EXISTS(SELECT 1 FROM search_static_blog_revisions WHERE url=? AND revision=?)';
    const result = await db.batch([
      previous
        ? db
            .prepare(
              'UPDATE search_static_blog_revisions SET revision=?,updated_at=? WHERE url=? AND revision=?',
            )
            .bind(page.hash, now, page.url, previous.revision)
        : db
            .prepare(
              'INSERT OR IGNORE INTO search_static_blog_revisions(url,revision,updated_at) VALUES(?,?,?)',
            )
            .bind(page.url, page.hash, now),
      db
        .prepare(
          `UPDATE search_console_queue SET status='superseded',updated_at=? WHERE url=? AND revision!=? AND status IN ('pending','deferred') AND ${guard}`,
        )
        .bind(now, page.url, page.hash, page.url, page.hash),
      db
        .prepare(
          `INSERT OR IGNORE INTO search_console_queue(id,url,revision,kind,priority,created_at,updated_at) SELECT ?,?,?,'article',100,?,? WHERE ${guard}`,
        )
        .bind(crypto.randomUUID(), page.url, page.hash, now, now, page.url, page.hash),
      db
        .prepare(
          `INSERT OR IGNORE INTO search_console_inspections(job_id,provider,next_check_at) SELECT q.id,p.provider,? FROM search_console_queue q CROSS JOIN (SELECT 'google' AS provider UNION ALL SELECT 'bing') p WHERE q.url=? AND q.revision=? AND ${guard}`,
        )
        .bind(now + 86400_000, page.url, page.hash, page.url, page.hash),
    ]);
    added += result[2].meta.changes ?? 0;
  }
  return { baseline: false, checked: pages.length, added };
}
