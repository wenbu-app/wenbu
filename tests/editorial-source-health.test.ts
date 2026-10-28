import { afterEach, describe, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { editorialSources } from '../src/data/editorial-topics';
import { readApprovedEditorialSource, refreshEditorialSources } from '../worker/editorial-research';
import { recordEditorialProviderFailure } from '../worker/editorial-provider';
import { editorialGrowthStatus } from '../worker/editorial-growth';
import type { Env } from '../worker/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const text =
  'Public teaching reference with named conventions, worked examples and clearly described limitations. '.repeat(
    12,
  );
const now = Date.parse('2026-10-27T14:00:00Z');
function setup() {
  const { env, sql } = database();
  env.EDITORIAL_ENABLED = 'true';
  env.SITE_URL = 'https://wenbu.app';
  const asset = vi.fn().mockImplementation(async () => new Response(text));
  env.ASSETS = { fetch: asset } as unknown as Env['ASSETS'];
  const external = vi.fn().mockImplementation(async (request: Request) => {
    if (new URL(request.url).hostname === 'api.deepseek.com')
      throw new Error('Unexpected model or balance probe');
    return new Response(text);
  });
  vi.stubGlobal('fetch', external);
  return { env, sql, asset, external };
}

describe('source checks remain independent from model availability', () => {
  it('does not reject a complete official page because its first feature card is short', async () => {
    const { env, sql, external } = setup();
    external.mockResolvedValue(
      new Response(
        '<main><article>First feature card.</article><p>' +
          text +
          '</p><p>Final storage and export limitations.</p></main>',
        { headers: { 'Content-Type': 'text/html' } },
      ),
    );
    const source = await readApprovedEditorialSource(env, 'nttarot');
    expect(source?.excerpt).toContain('First feature card.');
    expect(source?.excerpt).toContain('Final storage and export limitations.');
    expect(source?.excerpt.length).toBeGreaterThan(150);
    expect(
      sql.prepare("SELECT status,error_code FROM editorial_source_health WHERE id='nttarot'").get(),
    ).toEqual({
      status: 'available',
      error_code: null,
    });
    expect(external).toHaveBeenCalledTimes(1);
    expect(new URL((external.mock.calls[0][0] as Request).url).hostname).toBe('nttarot.net');
  });

  it('refreshes expired allowlisted sources during a known model pause without changing any generation or search state', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { env, sql, external } = setup();
    await recordEditorialProviderFailure(env, 402);
    for (const [id, source] of Object.entries(editorialSources))
      sql
        .prepare(
          'INSERT INTO editorial_source_health(id,url,checked_at,status,error_code,characters) VALUES(?,?,?,?,?,?)',
        )
        .run(id, source.url, now - 25 * 3600_000, 'unavailable', 'old_failure', 0);
    const beforeProvider = sql.prepare('SELECT * FROM editorial_model_provider').get();
    const beforeIndexnow = sql.prepare('SELECT * FROM indexnow_state').get();
    const result = await refreshEditorialSources(env);
    expect(result).toHaveLength(Object.keys(editorialSources).length);
    expect(
      sql
        .prepare("SELECT COUNT(*) n FROM editorial_source_health WHERE checked_at=? AND status='available'")
        .get(now)?.n,
    ).toBe(result.length);
    expect(
      external.mock.calls.every(([r]) => new URL((r as Request).url).hostname !== 'api.deepseek.com'),
    ).toBe(true);
    expect(sql.prepare('SELECT * FROM editorial_model_provider').get()).toEqual(beforeProvider);
    expect(sql.prepare('SELECT * FROM indexnow_state').get()).toEqual(beforeIndexnow);
    for (const table of [
      'editorial_daily_budgets',
      'editorial_runs',
      'editorial_commissioning_runs',
      'editorial_publications',
    ])
      expect(sql.prepare(`SELECT COUNT(*) n FROM ${table}`).get()?.n).toBe(0);
  });

  it('retains unavailable results and the existing six-hour read cooldown', async () => {
    let time = now;
    vi.spyOn(Date, 'now').mockImplementation(() => time);
    const { env, sql, asset, external } = setup();
    external.mockImplementation(async () => new Response('Unavailable', { status: 503 }));
    await refreshEditorialSources(env);
    const calls = external.mock.calls.length + asset.mock.calls.length;
    expect(
      sql.prepare("SELECT COUNT(*) n FROM editorial_source_health WHERE status='unavailable'").get()?.n,
    ).toBeGreaterThan(0);
    time += 5 * 3600_000;
    await refreshEditorialSources(env);
    expect(external.mock.calls.length + asset.mock.calls.length).toBe(calls);
    time += 3600_001;
    await refreshEditorialSources(env);
    expect(external.mock.calls.length + asset.mock.calls.length).toBe(calls * 2);
  });

  it('exposes stale and missing checks without claiming that candidate eligibility proves source availability', async () => {
    const { env, sql } = setup();
    const [id, source] = Object.entries(editorialSources)[0];
    sql
      .prepare(
        'INSERT INTO editorial_source_health(id,url,checked_at,status,error_code,characters) VALUES(?,?,?,?,?,?)',
      )
      .run(id, source.url, now - 25 * 3600_000, 'unavailable', 'old_failure', 0);
    const status = await editorialGrowthStatus(env, now);
    expect(status.sourceHealth).toMatchObject({
      available: 0,
      unavailable: [],
      stale: 1,
      missing: Object.keys(editorialSources).length - 1,
    });
    expect(status.sourceEligibilityBasis).toContain('not verified availability');
  });
});
