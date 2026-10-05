import { describe, it, expect, vi, afterEach } from 'vitest';
import worker, { boundedBody, originAllowed } from '../worker/index';
import { identityHash, interpret } from '../worker/ai';
import type { Env } from '../worker/types';
const env = { SITE_URL: 'https://wenbu.app', DEEPSEEK_MODEL: 'deepseek-v4-flash' } as Env;
const req = (body: unknown, origin?: string, path = 'bazi') =>
  new Request('https://wenbu.app/api/v1/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
afterEach(() => vi.restoreAllMocks());
describe('public edge API', () => {
  it('never silently recasts an I Ching interpretation', async () => {
    await expect(
      interpret({ kind: 'iching', input: {}, question: 'Question', consent: true }, req({}), env),
    ).rejects.toThrow();
  });
  it('allows same-origin and native clients but denies cross-origin/null', () => {
    expect(originAllowed(req({}, env.SITE_URL), env)).toBe(true);
    expect(originAllowed(req({}), env)).toBe(true);
    expect(originAllowed(req({}, 'https://evil.example'), env)).toBe(false);
    expect(originAllowed(req({}, 'null'), env)).toBe(false);
    expect(originAllowed(req({}, 'http://localhost:9999'), env)).toBe(false);
  });
  it('rejects foreign origin before computation', async () =>
    expect((await worker.fetch(req({}, 'https://evil.example'), env)).status).toBe(403));
  it('returns private no-store responses with calculations', async () => {
    const res = await worker.fetch(req({ date: '2005-12-23', time: '08:37' }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(((await res.json()) as { kind: string }).kind).toBe('bazi');
  });
  it('rejects invalid calendar fields', async () =>
    expect((await worker.fetch(req({ date: '2023-02-29' }), env)).status).toBe(422));
  it('rejects unrecognized fields', async () =>
    expect((await worker.fetch(req({ date: '2000-01-01', secret: 'not allowed' }), env)).status).toBe(422));
  it('caps request bytes even without Content-Length', async () =>
    expect((await worker.fetch(req({ a: 'x'.repeat(9000) }), env)).status).toBe(413));
  it('rejects non-JSON and malformed JSON', async () => {
    await expect(
      boundedBody(new Request('https://x.test', { method: 'POST', body: 'text' })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      boundedBody(
        new Request('https://x.test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requires POST', async () =>
    expect((await worker.fetch(new Request('https://wenbu.app/api/v1/bazi'), env)).status).toBe(405));
  it('requires AI consent before provider work', async () =>
    expect(
      (
        await worker.fetch(
          req({ kind: 'bazi', input: { date: '2000-01-01' }, question: 'hello' }, undefined, 'interpret'),
          env,
        )
      ).status,
    ).toBe(422));
  it('degrades gracefully when AI unconfigured', async () =>
    expect(
      (
        await worker.fetch(
          req(
            { kind: 'bazi', input: { date: '2000-01-01' }, question: 'hello', consent: true },
            undefined,
            'interpret',
          ),
          env,
        )
      ).status,
    ).toBe(503));
  it('normalizes IPv6 /64 and is salt-specific', async () => {
    expect(await identityHash('2001:db8::1', 'salt')).toBe(
      await identityHash('2001:0db8:0:0:ffff::99', 'salt'),
    );
    expect(await identityHash('1.2.3.4', 'salt')).not.toBe(await identityHash('1.2.3.4', 'other'));
  });
  it('does not call upstream after quota denial', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const fake = {
      ...env,
      DEEPSEEK_API_KEY: 'test-only',
      QUOTA_SALT: 'test-only',
      QUOTA: {
        idFromName: () => 0,
        get: () => ({ reserve: async () => ({ allowed: false, remaining: 0, reason: 'daily_budget' }) }),
      },
    } as unknown as Env;
    await expect(
      interpret(
        { kind: 'bazi', input: { date: '2000-01-01' }, question: 'Question', consent: true },
        req({}),
        fake,
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects invented/duplicate tarot inputs before provider work', async () => {
    await expect(
      interpret(
        {
          kind: 'tarot',
          input: { cards: [{ id: 78, reversed: false }] },
          question: 'Question',
          consent: true,
        },
        req({}),
        env,
      ),
    ).rejects.toThrow();
  });
});
