import { afterEach, expect, it, vi } from 'vitest';
import { database } from './helpers/analytics-db';
import { readEditorialOwner } from '../worker/editorial-research';
import { editorialContentContract } from '../worker/editorial-schema';
import { editorialTopics } from '../src/data/editorial-topics';
const topic = editorialTopics.find((t) => t.category === 'compare' && t.slug === 'fatetell')!;
afterEach(() => vi.restoreAllMocks());
it('reads a static comparison through its exact canonical HTML when no machine edition exists', async () => {
  const { env } = database();
  env.EDITORIAL_ENABLED = 'true';
  env.SITE_URL = 'https://wenbu.app';
  const fetcher = vi
    .fn()
    .mockImplementation(async (request: Request) =>
      request.url.includes('/knowledge/')
        ? new Response('missing', { status: 404 })
        : new Response(
            '<main><h1>Comparison</h1>' + 'Supported original comparison. '.repeat(20) + '</main>',
            { headers: { 'Content-Type': 'text/html' } },
          ),
    );
  env.ASSETS = { fetch: fetcher } as unknown as typeof env.ASSETS;
  const sources = await readEditorialOwner(env, topic);
  expect(sources.map((s) => s.url)).toEqual([
    'https://wenbu.app/compare/fatetell/',
    'https://wenbu.app/en/compare/fatetell/',
  ]);
  expect(sources.every((s) => s.excerpt.includes('Supported original') && s.truncated === false)).toBe(true);
  expect(editorialContentContract(topic, sources).kind).toBe('complete_guide');
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it('does not mask a machine-format server failure with a fallback page', async () => {
  const { env } = database();
  env.EDITORIAL_ENABLED = 'true';
  env.SITE_URL = 'https://wenbu.app';
  const fetcher = vi.fn().mockResolvedValue(new Response('failure', { status: 503 }));
  env.ASSETS = { fetch: fetcher } as unknown as typeof env.ASSETS;
  await expect(readEditorialOwner(env, topic)).rejects.toThrow('original_article_unavailable');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
