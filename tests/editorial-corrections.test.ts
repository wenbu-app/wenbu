import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorialRevisionSchema } from '../worker/editorial-corrections';
import { researchEditorial } from '../worker/editorial-research';
import { database } from './helpers/analytics-db';
import type { EditorialTopic } from '../src/data/editorial-topics';
import type { Env } from '../worker/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const revision = {
  path: 'learn/bazi-leap-month-conversion',
  expectedRevision: 'a'.repeat(64),
  instructions: 'Correct the source scope while preserving accurate unaffected content.',
};
const topic: EditorialTopic = {
  id: 'calendar-fixture',
  slug: 'calendar-fixture',
  category: 'learn',
  mode: 'new',
  tool: 'bazi',
  zh: '核对历表',
  en: 'Check the calendar table',
  task: 'Check a calendar date.',
  unique: 'A hypothetical lookup exercise.',
  sources: ['hko', 'methods'],
  priority: 1,
};
function setup(fail = false) {
  const { env, sql } = database();
  env.SITE_URL = 'https://wenbu.app';
  env.ASSETS = {
    fetch: vi.fn(async () => new Response('A public documented convention and its limits. '.repeat(15))),
  } as unknown as Env['ASSETS'];
  const fetch = vi.fn(async (request: Request) => {
    if (request.url.endsWith('/T2023e.txt'))
      return fail
        ? new Response('', { status: 503 })
        : new Response(
            'Synthetic 2023 calendar fixture\n' +
              'documented calendar row\n'.repeat(350) +
              '2023/4/5 15 Wednesday Bright & Clear\n' +
              'calendar end\n'.repeat(100),
            { headers: { 'Content-Type': 'text/plain' } },
          );
    return new Response('Official calendar year index and its stated limitations. '.repeat(20));
  });
  vi.stubGlobal('fetch', fetch);
  return { env, sql, fetch };
}

describe('correction supporting source contract', () => {
  it('keeps existing requests compatible and accepts only explicit registered IDs', () => {
    expect(editorialRevisionSchema.parse(revision)).toEqual(revision);
    expect(
      editorialRevisionSchema.parse({ ...revision, additionalSourceIds: ['hko2023'] }).additionalSourceIds,
    ).toEqual(['hko2023']);
  });
  it.each([
    ['https://example.test/table'],
    ['toString'],
    ['unregistered'],
    ['hko2023', 'hko2023'],
    ['hko2023', 'hko', 'methods', 'bazi', 'birth'],
  ])('rejects an unsafe or unbounded source list %j', (...ids) => {
    expect(editorialRevisionSchema.safeParse({ ...revision, additionalSourceIds: ids }).success).toBe(false);
  });
  it('reads and archives a deduplicated exact-year source, retaining rows beyond the normal excerpt limit', async () => {
    const { env, fetch } = setup();
    const sources = await researchEditorial(env, { ...topic, sources: [...topic.sources, 'hko2023'] }, [
      'hko2023',
    ]);
    const year = sources.filter((s) => s.id === 'hko2023');
    expect(year).toHaveLength(1);
    expect(year[0].excerpt.indexOf('2023/4/5')).toBeGreaterThan(6500);
    expect(year[0]).toMatchObject({
      truncated: false,
      url: 'https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2023e.txt',
    });
    expect(year[0]).not.toHaveProperty('excerptLimit');
    expect(year[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetch.mock.calls.filter(([r]) => r.url.endsWith('/T2023e.txt'))).toHaveLength(1);
  });
  it('fails closed when explicitly requested supporting evidence cannot be read', async () => {
    const { env, sql } = setup(true);
    await expect(researchEditorial(env, topic, ['hko2023'])).rejects.toThrow('additional_source_unavailable');
    expect(sql.prepare("SELECT status FROM editorial_source_health WHERE id='hko2023'").get()?.status).toBe(
      'unavailable',
    );
    expect(sql.prepare('SELECT COUNT(*) n FROM editorial_daily_budgets').get()?.n).toBe(0);
  });
  it('rejects unknown sources before any network request', async () => {
    const { env, fetch } = setup();
    await expect(researchEditorial(env, topic, ['https://example.test/'])).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
