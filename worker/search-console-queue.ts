/** Called inside the same D1 transaction as a bilingual publication. No Google API request. */
export function searchQueueStatements(
  db: D1Database,
  urls: string[],
  revision: string,
  now: number,
  publication?: { path: string },
) {
  const guard = publication
    ? 'EXISTS(SELECT 1 FROM editorial_publications WHERE path=? AND revision=?)'
    : '1';
  const extra = publication ? [publication.path, revision] : [];
  return urls.flatMap((url) => {
    const path = new URL(url).pathname.replace(/^\/en(?=\/)/, '');
    const priority = publication
      ? 100
      : path === '/'
        ? 300
        : /^\/(agent|daily|bazi|tarot|iching|ziwei)\/$/.test(path)
          ? 290
          : /^\/(learn|compare|agents|free|methodology)\/$/.test(path)
            ? 250
            : 200;
    return [
      ...(publication
        ? [
            db
              .prepare(
                `UPDATE search_console_queue SET status='superseded',updated_at=? WHERE url=? AND revision!=? AND status IN ('pending','deferred') AND ${guard}`,
              )
              .bind(now, url, revision, ...extra),
          ]
        : []),
      db
        .prepare(
          `INSERT OR IGNORE INTO search_console_queue(id,url,revision,kind,priority,created_at,updated_at)
      SELECT ?,?,?,?,?,?,? WHERE ${guard}${publication ? '' : " AND NOT EXISTS(SELECT 1 FROM search_console_queue WHERE url=? AND kind='core')"}`,
        )
        .bind(
          crypto.randomUUID(),
          url,
          revision,
          publication ? 'article' : 'core',
          priority,
          now,
          now,
          ...extra,
          ...(publication ? [] : [url]),
        ),
    ];
  });
}
