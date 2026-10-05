import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState } from '../src/lib/account-client';
type Stored = {
  id: string;
  kind: string;
  content: { id: string; note?: string };
  revision: number;
  updatedAt: number;
  provenance: string;
};
let client: typeof import('../src/lib/account-client');
let storage: Map<string, string>,
  records: Map<string, Stored>,
  user: string | null,
  cloud = true;
let fail = false,
  requests: { path: string; owner: string | null; body: unknown }[];
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  storage = new Map([['wenbu.analytics.disabled', 'true']]);
  records = new Map();
  user = 'account-a';
  cloud = true;
  fail = false;
  requests = [];
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', { documentElement: { lang: 'en' } });
  vi.stubGlobal('navigator', { doNotTrack: '1' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      const headers = new Headers(init.headers),
        owner = headers.get('X-Wenbu-Owner'),
        body = init.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ path, owner, body });
      if (fail) throw new Error('offline');
      if (path === '/api/account')
        return Response.json({
          enabled: true,
          user: user ? { id: user, email: user + '@example.test', createdAt: 0 } : null,
          cloudHistory: cloud,
          storage: { used: 0, limit: 10485760 },
        } satisfies Partial<AccountState>);
      if (path === '/api/auth/sign-out') {
        user = null;
        return Response.json({ ok: true });
      }
      if (owner !== user) return Response.json({ error: { code: 'account_changed' } }, { status: 409 });
      if (path === '/api/account/preferences') {
        cloud = body.cloudHistory ?? cloud;
        return Response.json({ ok: true });
      }
      if (path === '/api/account/records') return Response.json({ records: [...records.values()] });
      if (path.startsWith('/api/account/records/')) {
        const id = path.split('/').at(-1)!,
          kind = path.split('/').at(-2)!,
          prior = records.get(id);
        if (init.method === 'GET')
          return prior
            ? Response.json(prior)
            : Response.json({ error: { code: 'record_not_found' } }, { status: 404 });
        if (init.method === 'DELETE') {
          records.delete(id);
          return Response.json({ deleted: true });
        }
        if ((prior?.revision || 0) !== body.revision)
          return Response.json({ error: { code: 'revision_conflict' } }, { status: 409 });
        const next = {
          id,
          kind,
          content: body.content,
          revision: (prior?.revision || 0) + 1,
          updatedAt: Date.now(),
          provenance: 'user_data',
        };
        records.set(id, next);
        return Response.json({ revision: next.revision });
      }
      throw new Error('Unexpected fixture route ' + path);
    }),
  );
  client = await import('../src/lib/account-client');
  await client.initializeAccount();
  await client.flushAccount();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('account-owned outbox and local recovery', () => {
  it('an empty first flush does not permanently lock subsequent saves', async () => {
    client.writeAccountCache('journal', [{ id: 'one', note: 'first' }] as { id: string }[]);
    await client.flushAccount();
    expect(records.get('one')?.content.note).toBe('first');
    expect(client.pendingRecords()).toHaveLength(0);
    client.writeAccountCache('journal', [{ id: 'one', note: 'second' }] as { id: string }[]);
    await client.flushAccount();
    expect(records.get('one')?.content.note).toBe('second');
    expect(records.get('one')?.revision).toBe(2);
  });
  it('offline content remains exportable and logout is blocked until it is handled', async () => {
    fail = true;
    client.writeAccountCache('journal', [{ id: 'offline', note: 'only copy' }] as { id: string }[]);
    await client.flushAccount();
    expect(client.pendingRecords()[0].content).toEqual({ id: 'offline', note: 'only copy' });
    await expect(client.signOut()).rejects.toMatchObject({ code: 'pending_before_signout' });
    fail = false;
    await client.retryAccount();
    expect(records.get('offline')?.content.note).toBe('only copy');
  });
  it('a conflict preserves the newest local edits and a copy gets a new ID', async () => {
    records.set('one', {
      id: 'one',
      kind: 'journal',
      content: { id: 'one', note: 'elsewhere' },
      revision: 2,
      updatedAt: 1,
      provenance: 'user_data',
    });
    client.writeAccountCache('journal', [{ id: 'one', note: 'mine' }] as { id: string }[]);
    await client.flushAccount();
    expect(client.pendingRecords()[0].error).toBe('revision_conflict');
    client.writeAccountCache('journal', [{ id: 'one', note: 'mine, revised' }] as { id: string }[]);
    await client.resolvePending(client.pendingRecords()[0].requestId, 'copy');
    expect(records.get('one')?.content.note).toBe('elsewhere');
    expect([...records.values()].some((r) => r.id !== 'one' && r.content.note === 'mine, revised')).toBe(
      true,
    );
  });
  it('cookie changes cannot write the previous account outbox to the next account', async () => {
    client.writeAccountCache('journal', [{ id: 'private-a', note: 'A only' }] as { id: string }[]);
    user = 'account-b';
    await client.flushAccount();
    expect(records.size).toBe(0);
    expect(client.pendingRecords()[0].error).toBe('account_changed');
    expect(requests.find((r) => r.path.endsWith('/private-a'))?.owner).toBe('account-a');
    await client.initializeAccount(true);
    expect(client.readAccountCache('journal')).toEqual([]);
    expect(JSON.parse(storage.get('wenbu.account.account-a.pending')!)[0].content.note).toBe('A only');
  });
  it('paused history survives refresh and is not auto-uploaded on resume', async () => {
    await client.accountRequest('/api/account/preferences', 'PATCH', { cloudHistory: false });
    await client.initializeAccount(true);
    client.writeAccountCache('journal', [{ id: 'temporary', note: 'private local' }] as { id: string }[]);
    await client.initializeAccount(true);
    expect(client.readAccountCache('journal')).toEqual([{ id: 'temporary', note: 'private local' }]);
    await client.accountRequest('/api/account/preferences', 'PATCH', { cloudHistory: true });
    await client.initializeAccount(true);
    client.writeAccountCache('journal', client.readAccountCache<{ id: string }>('journal'));
    await client.flushAccount();
    expect(records.size).toBe(0);
    expect(client.accountSnapshot().temporary).toBe(1);
    await expect(client.signOut()).rejects.toMatchObject({ code: 'pending_before_signout' });
    client.writeAccountCache('journal', [{ id: 'temporary', note: 'edited after resume' }] as {
      id: string;
    }[]);
    await client.flushAccount();
    expect(records.get('temporary')?.content.note).toBe('edited after resume');
    expect(client.accountSnapshot().temporary).toBe(0);
  });
  it('server chat starts only after the user message is acknowledged', async () => {
    const headers = await client.prepareCloudRun({ id: 'chat' });
    expect(headers['X-Wenbu-Revision']).toBe('1');
    expect(records.has('chat')).toBe(true);
    client.writeAccountCache('session', [{ id: 'chat', note: 'streaming' }] as { id: string }[]);
    await client.flushAccount();
    expect(records.get('chat')?.revision).toBe(1);
    client.endCloudRun('chat');
    client.writeAccountCache('session', [{ id: 'chat', note: 'complete' }] as { id: string }[]);
    await client.flushAccount();
    expect(records.get('chat')?.revision).toBe(2);
  });
  it('empty drafts stay local and current import selects the original conversation', async () => {
    const draft = { id: 'empty', messages: [] };
    client.writeAccountCache('session', [draft]);
    await client.flushAccount();
    expect(records.size).toBe(0);
    let detail: unknown;
    window.addEventListener('wenbu:records-changed', (event) => {
      detail = (event as CustomEvent).detail;
    });
    await client.importRecord(
      'session',
      { id: 'original', messages: [{ text: 'guest result' }] } as { id: string },
      'current',
    );
    expect(records.has('original')).toBe(true);
    expect(detail).toEqual({ kind: 'session', id: 'original' });
  });
  it('an import waits for its own acknowledgement while another flush is running', async () => {
    const fetcher = fetch;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit) => {
        if (path.endsWith('/first') && init.method === 'PUT') await gate;
        return fetcher(path, init);
      }),
    );
    client.writeAccountCache('journal', [{ id: 'first' }]);
    const first = client.flushAccount();
    const imported = client.importRecord('journal', { id: 'second' }, 'current');
    release();
    await Promise.all([first, imported]);
    expect(records.has('second')).toBe(true);
    expect(client.pendingRecords()).toHaveLength(0);
  });
  it('cloud read failure after account switch still unlocks the new isolated UI', async () => {
    const fetcher = fetch;
    let changed = 0;
    window.addEventListener('wenbu:account-changed', () => {
      changed++;
    });
    user = 'account-b';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit) => {
        if (path === '/api/account/records') throw new Error('offline');
        return fetcher(path, init);
      }),
    );
    await client.initializeAccount(true);
    expect(changed).toBe(1);
    expect(client.accountSnapshot().user?.id).toBe('account-b');
    expect(client.accountSnapshot().error).toBe('connection_failed');
  });
  it('reimporting a stale guest copy cannot overwrite a continued cloud conversation', async () => {
    records.set('continued', {
      id: 'continued',
      kind: 'session',
      content: { id: 'continued', note: 'new cloud follow-up' },
      revision: 3,
      updatedAt: 1,
      provenance: 'user_data',
    });
    await client.refreshCloud();
    await expect(
      client.importRecord(
        'session',
        { id: 'continued', note: 'old guest copy' } as { id: string },
        'current',
      ),
    ).rejects.toMatchObject({ code: 'revision_conflict' });
    expect(records.get('continued')?.content.note).toBe('new cloud follow-up');
    expect(client.pendingRecords()).toHaveLength(1);
  });
  it('loading a large cloud library does not duplicate its bodies into localStorage', async () => {
    for (let i = 0; i < 30; i++)
      records.set('large-' + i, {
        id: 'large-' + i,
        kind: 'journal',
        content: { id: 'large-' + i, note: 'x'.repeat(90000) },
        revision: 1,
        updatedAt: i,
        provenance: 'user_data',
      });
    await client.refreshCloud();
    expect(client.readAccountCache('journal')).toHaveLength(30);
    expect([...storage.values()].reduce((n, v) => n + v.length, 0)).toBeLessThan(10000);
  });
  it('signout clears account caches after pending content has synced', async () => {
    client.writeAccountCache('journal', [{ id: 'one' }]);
    await client.flushAccount();
    await client.signOut();
    expect(storage.has('wenbu.account.account-a.journal')).toBe(false);
    expect(storage.has('wenbu.account.account-a.pending')).toBe(false);
    expect(client.accountSnapshot().user).toBe(null);
  });
});

describe('record-level save feedback', () => {
  it('distinguishes an unsaved result, pending write and acknowledged cloud copy', async () => {
    const item = { id: 'result', note: 'v1' };
    expect(client.recordSaveState('journal', item)).toBe('unsaved');
    client.writeAccountCache('journal', [item]);
    expect(client.recordSaveState('journal', item)).toBe('pending');
    await client.flushAccount();
    expect(client.recordSaveState('journal', item)).toBe('cloud');
    expect(client.recordSaveState('journal', { ...item, note: 'unsaved edit' })).toBe('unsaved');
  });
  it('does not label failed or paused-history writes as cloud saved', async () => {
    const item = { id: 'offline' };
    fail = true;
    client.writeAccountCache('journal', [item]);
    await client.flushAccount();
    expect(client.recordSaveState('journal', item)).toBe('error');
    fail = false;
    await client.retryAccount();
    cloud = false;
    await client.initializeAccount(true);
    const temporary = { id: 'local-only' };
    client.writeAccountCache('journal', [temporary]);
    expect(client.recordSaveState('journal', temporary)).toBe('browser');
  });
  it('a generic account entry never carries a prior save intent', () => {
    const received: unknown[] = [];
    window.addEventListener('wenbu:account-open', (event) => received.push((event as CustomEvent).detail));
    client.openAccount({ kind: 'journal', content: { id: 'one' } });
    client.openAccount();
    expect(received).toEqual([
      { entry: 'account-save', intent: { kind: 'journal', content: { id: 'one' } } },
      { entry: 'account-header', intent: undefined },
    ]);
  });
});

it('notifies subscribers after an explicit current-result import is readable', async () => {
  const states: string[] = [];
  const stop = client.subscribeAccount(() => {
    const item = client.readAccountCache<{ id: string }>('journal').find((r) => r.id === 'imported');
    states.push(item ? client.recordSaveState('journal', item) : 'missing');
  });
  await client.importRecord('journal', { id: 'imported' }, 'current');
  stop();
  expect(states.at(-1)).toBe('cloud');
  expect(requests.find((r) => r.path.endsWith('/imported') && r.body)?.body).toMatchObject({
    source: 'current',
  });
});
