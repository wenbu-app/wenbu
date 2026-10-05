import { analyticsHeaders, analyticsEnabled } from './analytics';
import type { CloudRecord, RecordKind } from './account-protocol';

export type AccountIntent = {
  label?: string;
  kind: RecordKind;
  content: { id: string; title?: string; question?: string; createdAt?: string; updatedAt?: string };
};
export type AccountEntry = 'account-header' | 'account-result' | 'account-save' | 'account-history';
export type AccountOpenRequest = { intent?: AccountIntent; entry: AccountEntry };

export type AccountState = {
  ready: boolean;
  enabled: boolean;
  user: null | { id: string; email: string; createdAt: number };
  cloudHistory: boolean;
  storage: { used: number; limit: number };
  pending: number;
  temporary: number;
  error: string;
  syncing: boolean;
};
type Pending = {
  owner: string;
  kind: RecordKind;
  id: string;
  revision: number;
  requestId: string;
  content?: unknown;
  source: 'current' | 'legacy';
  error?: string;
};
type Index = Record<string, { revision: number; json: string }>;
let state: AccountState = {
  ready: false,
  enabled: false,
  user: null,
  cloudHistory: true,
  storage: { used: 0, limit: 10485760 },
  pending: 0,
  temporary: 0,
  error: '',
  syncing: false,
};
let initialized: Promise<void> | undefined,
  flushing: Promise<void> | undefined,
  timer: ReturnType<typeof setTimeout> | undefined;
let activeRuns = new Set<string>();
let initializationGeneration = 0;
export const accountSnapshot = () => state;
const listeners = new Set<() => void>();
// Synced content is refetched from its authoritative owner on load. Keep the
// full cloud cache in memory, so 10 MB of cloud history does not exhaust the
// much smaller synchronous browser store. Only unsynced/paused content is durable.
const cloudCache = new Map<string, string>();
function cacheWrite(key: string, json: string) {
  if (key.startsWith('wenbu.account.')) {
    cloudCache.set(key, json);
    try {
      localStorage.removeItem(key);
    } catch {
      /* Optional old cache cleanup. */
    }
  } else localStorage.setItem(key, json);
}
export function subscribeAccount(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function publish(patch: Partial<AccountState> = {}) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}
const legacyKey = (kind: RecordKind) => (kind === 'journal' ? 'wenbu.journal.v1' : 'wenbu.agent.sessions.v1');
const cacheKey = (kind: RecordKind, owner = state.user?.id) =>
  owner ? `wenbu.account.${owner}.${kind}` : legacyKey(kind);
const queueKey = (owner: string) => `wenbu.account.${owner}.pending`;
const indexKey = (owner: string) => `wenbu.account.${owner}.revisions`;
const temporaryKey = (owner: string) => `wenbu.account.${owner}.temporary`;
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(cloudCache.get(key) ?? localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function index(owner: string): Index {
  return read(indexKey(owner), {});
}
function queue(owner: string): Pending[] {
  return read(queueKey(owner), []);
}
function setQueue(owner: string, next: Pending[]) {
  localStorage.setItem(queueKey(owner), JSON.stringify(next));
  if (state.user?.id === owner) publish({ pending: next.length });
}
export class AccountClientError extends Error {
  constructor(
    public code: string,
    public status = 0,
    public detail?: unknown,
  ) {
    super(code);
  }
}
export function accountInstance() {
  if (!analyticsEnabled()) return undefined;
  try {
    let id = localStorage.getItem('wenbu.account.installation');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('wenbu.account.installation', id);
    }
    return id;
  } catch {
    return undefined;
  }
}
export async function accountRequest<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
  owner = state.user?.id,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Wenbu-Locale': document.documentElement.lang.startsWith('zh') ? 'zh' : 'en',
      ...analyticsHeaders(),
      ...(accountInstance() ? { 'X-Wenbu-Instance': accountInstance()! } : {}),
      ...(owner ? { 'X-Wenbu-Owner': owner } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as { error?: { code?: string }; code?: string; detail?: unknown };
  if (!response.ok)
    throw new AccountClientError(
      data.error?.code || data.code || 'request_failed',
      response.status,
      data.detail,
    );
  return data as T;
}
export async function initializeAccount(force = false) {
  if (initialized && !force) return initialized;
  const generation = ++initializationGeneration;
  initialized = (async () => {
    let changed = false;
    try {
      const info =
        await accountRequest<Pick<AccountState, 'enabled' | 'user' | 'cloudHistory' | 'storage'>>(
          '/api/account',
        );
      if (generation !== initializationGeneration) return;
      changed = state.user?.id !== info.user?.id;
      if (changed) {
        window.dispatchEvent(new Event('wenbu:account-changing'));
        activeRuns = new Set();
      }
      publish({
        ...info,
        ready: true,
        error: '',
        pending: info.user ? queue(info.user.id).length : 0,
        temporary: info.user ? Object.keys(read<Index>(temporaryKey(info.user.id), {})).length : 0,
      });
      if (info.user) {
        await refreshCloud();
        if (!changed) window.dispatchEvent(new Event('wenbu:records-changed'));
        publish({
          pending: queue(info.user.id).length,
          temporary: Object.keys(read<Index>(temporaryKey(info.user.id), {})).length,
        });
        void flushAccount();
      }
    } catch {
      if (generation === initializationGeneration) publish({ ready: true, error: 'connection_failed' });
    } finally {
      if (changed && generation === initializationGeneration)
        window.dispatchEvent(new Event('wenbu:account-changed'));
    }
  })();
  await initialized;
}
export function readAccountCache<T = unknown>(kind: RecordKind): T[] {
  return read(cacheKey(kind), []);
}
export function guestRecords(kind: RecordKind): unknown[] {
  return read(legacyKey(kind), []);
}
/** A connected account is not evidence that this particular revision was saved. */
export function recordSaveState(kind: RecordKind, content: { id: string }) {
  const owner = state.user?.id;
  if (!owner)
    return readAccountCache<{ id: string }>(kind).some((r) => r.id === content.id) ? 'browser' : 'unsaved';
  const key = kind + ':' + content.id;
  const pending = queue(owner).find((p) => p.kind === kind && p.id === content.id);
  if (pending) return pending.error ? 'error' : 'pending';
  if (read<Index>(temporaryKey(owner), {})[key]) return 'browser';
  if (index(owner)[key]?.json === serialize(content)) return 'cloud';
  return 'unsaved';
}
function serialize(value: unknown) {
  return JSON.stringify(value);
}
export function writeAccountCache(kind: RecordKind, entries: { id: string }[]) {
  if (!state.ready) throw new AccountClientError('account_loading');
  const owner = state.user?.id,
    old = readAccountCache(kind) as { id: string }[];
  const json = serialize(entries);
  if (new TextEncoder().encode(json).length > 10485760) throw new AccountClientError('local_storage_full');
  if (owner) {
    let pending = queue(owner);
    const revisions = index(owner);
    const temporary = read<Index>(temporaryKey(owner), {});
    for (const entry of entries) {
      const key = kind + ':' + entry.id;
      if (kind === 'session' && activeRuns.has(entry.id)) continue;
      // Empty drafts remain local until the user actually starts a conversation.
      if (kind === 'session' && (entry as { messages?: unknown[] }).messages?.length === 0 && !revisions[key])
        continue;
      if (revisions[key]?.json === serialize(entry)) continue;
      if (!state.cloudHistory) {
        temporary[key] = { revision: revisions[key]?.revision || 0, json: serialize(entry) };
        continue;
      }
      if (temporary[key]?.json === serialize(entry)) continue;
      const existing = pending.find((p) => p.kind === kind && p.id === entry.id);
      // Never replace an in-flight request's payload under its idempotency key.
      pending = pending.filter((p) => p !== existing);
      pending.push({
        owner,
        kind,
        id: entry.id,
        revision: existing?.revision ?? temporary[key]?.revision ?? revisions[key]?.revision ?? 0,
        requestId: crypto.randomUUID(),
        content: entry,
        source: existing?.source || 'current',
        error: existing?.error,
      });
      delete temporary[key];
    }
    for (const entry of old.filter((e) => !entries.some((n) => n.id === e.id))) {
      pending = pending.filter((p) => !(p.kind === kind && p.id === entry.id));
      if (revisions[kind + ':' + entry.id])
        pending.push({
          owner,
          kind,
          id: entry.id,
          revision: revisions[kind + ':' + entry.id].revision,
          requestId: crypto.randomUUID(),
          source: 'current',
        });
      delete temporary[kind + ':' + entry.id];
    }
    // Save the outbox before the cache: quota errors never erase the only pending copy.
    setQueue(owner, pending);
    localStorage.setItem(temporaryKey(owner), serialize(temporary));
    publish({ temporary: Object.keys(temporary).length });
    clearTimeout(timer);
    timer = setTimeout(() => void flushAccount(), 600);
  }
  cacheWrite(cacheKey(kind), json);
}
async function recordManifest(path: string, owner: string) {
  const records: Omit<CloudRecord, 'content'>[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: { records: Omit<CloudRecord, 'content'>[]; nextCursor?: string | null } =
      await accountRequest<{ records: Omit<CloudRecord, 'content'>[]; nextCursor?: string | null }>(
        path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        'GET',
        undefined,
        owner,
      );
    records.push(...page.records);
    cursor = page.nextCursor || null;
    if (cursor) {
      if (seen.has(cursor)) throw new AccountClientError('export_changed');
      seen.add(cursor);
    }
  } while (cursor);
  const ids = records.map((r) => r.kind + ':' + r.id);
  if (new Set(ids).size !== ids.length) throw new AccountClientError('export_changed');
  return { records, createdAt: new Date().toISOString() };
}
export async function refreshCloud() {
  const owner = state.user?.id;
  if (!owner) return;
  const manifest = await recordManifest('/api/account/records', owner);
  const records: CloudRecord[] = [];
  for (let i = 0; i < manifest.records.length; i += 4) {
    const part = await Promise.all(
      manifest.records
        .slice(i, i + 4)
        .map((r) =>
          accountRequest<CloudRecord>(`/api/account/records/${r.kind}/${r.id}`, 'GET', undefined, owner),
        ),
    );
    records.push(...part);
  }
  if (state.user?.id !== owner) return;
  const pending = queue(owner),
    next: Index = {};
  for (const r of records) next[r.kind + ':' + r.id] = { revision: r.revision, json: serialize(r.content) };
  for (const kind of ['journal', 'session'] as const) {
    const values = records.filter((r) => r.kind === kind).map((r) => r.content as { id: string });
    for (const [key, temp] of Object.entries(read<Index>(temporaryKey(owner), {}))) {
      if (key.startsWith(kind + ':')) {
        const value = JSON.parse(temp.json) as { id: string };
        const i = values.findIndex((r) => r.id === value.id);
        if (i >= 0) values.splice(i, 1);
        values.unshift(value);
      }
    }
    for (const p of pending.filter((p) => p.kind === kind)) {
      const i = values.findIndex((r) => r.id === p.id);
      if (i >= 0) values.splice(i, 1);
      if (p.content) values.unshift(p.content as { id: string });
    }
    // Paused history and active streams keep their local working copy.
    for (const value of readAccountCache(kind) as { id: string }[]) {
      if (kind === 'session' && activeRuns.has(value.id)) {
        const i = values.findIndex((r) => r.id === value.id);
        if (i >= 0) values.splice(i, 1);
        values.unshift(value);
      }
    }
    cacheWrite(cacheKey(kind, owner), serialize(values));
  }
  cacheWrite(indexKey(owner), serialize(next));
  // Subscribers must see the refreshed records, including explicit guest imports.
  publish();
}
export async function flushAccount() {
  if (flushing) {
    await flushing;
    return flushAccount();
  }
  const owner = state.user?.id;
  if (!owner) return;
  const task = (async () => {
    publish({ syncing: true });
    try {
      for (const p of queue(owner)) {
        if (state.user?.id !== owner) break;
        if (!queue(owner).some((q) => q.requestId === p.requestId)) continue;
        if (p.owner !== owner || p.error || activeRuns.has(p.id) || (!state.cloudHistory && p.content))
          continue;
        try {
          const result = await accountRequest<{ revision: number }>(
            `/api/account/records/${p.kind}/${p.id}`,
            p.content ? 'PUT' : 'DELETE',
            p.content
              ? { requestId: p.requestId, revision: p.revision, content: p.content, source: p.source }
              : undefined,
            p.owner,
          );
          const revisions = index(owner),
            key = p.kind + ':' + p.id;
          if (p.content) revisions[key] = { revision: result.revision, json: serialize(p.content) };
          else delete revisions[key];
          cacheWrite(indexKey(owner), serialize(revisions));
          // Edits queued while this request was in flight inherit its new revision.
          setQueue(
            owner,
            queue(owner)
              .filter((q) => q.requestId !== p.requestId)
              .map((q) =>
                q.kind === p.kind && q.id === p.id ? { ...q, revision: result.revision ?? 0 } : q,
              ),
          );
        } catch (error) {
          const code = error instanceof AccountClientError ? error.code : 'connection_failed';
          setQueue(
            owner,
            queue(owner).map((q) => (q.requestId === p.requestId ? { ...q, error: code } : q)),
          );
          publish({ error: code });
          if (!(error instanceof AccountClientError) || error.status === 401 || error.status >= 500) break;
        }
      }
    } finally {
      if (state.user?.id === owner) {
        try {
          const info = await accountRequest<Pick<AccountState, 'user' | 'storage'>>(
            '/api/account',
            'GET',
            undefined,
            owner,
          );
          if (info.user?.id === owner && state.user?.id === owner) publish({ storage: info.storage });
        } catch {
          /* Content acknowledgement is independent of this usage refresh. */
        }
        publish({ syncing: false, pending: queue(owner).length });
      }
    }
  })();
  flushing = task;
  try {
    await task;
  } finally {
    if (flushing === task) flushing = undefined;
  }
}
export function retryAccount() {
  const owner = state.user?.id;
  if (owner) {
    setQueue(
      owner,
      queue(owner).map((p) => ({ ...p, error: undefined })),
    );
    publish({ error: '' });
    return flushAccount();
  }
}
export function pendingRecords() {
  return state.user ? queue(state.user.id) : [];
}
export async function resolvePending(requestId: string, action: 'copy' | 'discard') {
  const owner = state.user?.id;
  if (!owner) return;
  const pending = queue(owner),
    item = pending.find((p) => p.requestId === requestId);
  if (!item) return;
  let rest = pending.filter((p) => p.requestId !== requestId);
  if (action === 'copy' && item.content) {
    const id = crypto.randomUUID();
    rest = [
      ...rest,
      {
        ...item,
        id,
        content: { ...(item.content as object), id },
        revision: 0,
        requestId: crypto.randomUUID(),
        source: 'current',
        error: undefined,
      },
    ];
  }
  setQueue(owner, rest);
  await refreshCloud();
  window.dispatchEvent(new Event('wenbu:records-changed'));
  await flushAccount();
}
export async function importRecord(
  kind: RecordKind,
  content: { id: string },
  source: 'current' | 'legacy' = 'legacy',
) {
  const owner = state.user?.id;
  if (!owner) throw new AccountClientError('sign_in_required');
  const existing = queue(owner).filter((p) => !(p.kind === kind && p.id === content.id));
  setQueue(owner, [
    ...existing,
    {
      owner,
      kind,
      id: content.id,
      content,
      source,
      // A guest copy has no acknowledged cloud revision. Never overwrite a newer cloud conversation.
      revision: 0,
      requestId: crypto.randomUUID(),
    },
  ]);
  await flushAccount();
  await refreshCloud();
  window.dispatchEvent(new CustomEvent('wenbu:records-changed', { detail: { kind, id: content.id } }));
  const pending = queue(owner).find((p) => p.kind === kind && p.id === content.id);
  if (pending) throw new AccountClientError(pending.error || 'sync_pending');
}
export function beginCloudRun(id: string) {
  activeRuns.add(id);
}
export function endCloudRun(id: string) {
  activeRuns.delete(id);
}
export async function prepareCloudRun(content: { id: string }): Promise<Record<string, string>> {
  await initializeAccount();
  const owner = state.user?.id;
  if (!owner) return {};
  if (!state.cloudHistory) return { 'X-Wenbu-Owner': owner };
  beginCloudRun(content.id);
  try {
    await flushAccount();
    const previous = queue(owner).find((p) => p.kind === 'session' && p.id === content.id);
    if (previous?.error) throw new AccountClientError(previous.error);
    const p: Pending = {
      owner,
      kind: 'session',
      id: content.id,
      content,
      revision: previous?.revision ?? index(owner)['session:' + content.id]?.revision ?? 0,
      requestId: crypto.randomUUID(),
      source: 'current',
    };
    setQueue(owner, [...queue(owner).filter((q) => !(q.kind === 'session' && q.id === content.id)), p]);
    const saved = await accountRequest<{ revision: number }>(
      `/api/account/records/session/${content.id}`,
      'PUT',
      { requestId: p.requestId, revision: p.revision, content, source: 'current' },
      owner,
    );
    acknowledgeCloudSession(content.id, saved.revision, content, owner);
    setQueue(
      owner,
      queue(owner).filter((q) => q.requestId !== p.requestId),
    );
    const temps = read<Index>(temporaryKey(owner), {});
    delete temps['session:' + content.id];
    localStorage.setItem(temporaryKey(owner), serialize(temps));
    publish({ temporary: Object.keys(temps).length });
    return {
      'X-Wenbu-Conversation': content.id,
      'X-Wenbu-Revision': String(saved.revision),
      'X-Wenbu-Owner': owner,
    };
  } catch (error) {
    endCloudRun(content.id);
    throw error;
  }
}
export function acknowledgeCloudSession(
  id: string,
  revision: number,
  content: unknown,
  owner = state.user?.id,
) {
  if (!owner || state.user?.id !== owner) return;
  const revisions = index(owner);
  revisions['session:' + id] = { revision, json: serialize(content) };
  cacheWrite(indexKey(owner), serialize(revisions));
}
export async function signOut() {
  if (activeRuns.size) throw new AccountClientError('active_conversation');
  if (pendingRecords().length || state.temporary) throw new AccountClientError('pending_before_signout');
  const owner = state.user?.id;
  await accountRequest('/api/auth/sign-out', 'POST', {});
  window.dispatchEvent(new Event('wenbu:account-changing'));
  if (owner)
    for (const key of [
      cacheKey('journal', owner),
      cacheKey('session', owner),
      indexKey(owner),
      queueKey(owner),
      temporaryKey(owner),
    ]) {
      cloudCache.delete(key);
      localStorage.removeItem(key);
    }
  publish({ user: null, pending: 0, temporary: 0, error: '' });
  localStorage.setItem('wenbu.account.changed', crypto.randomUUID());
  window.dispatchEvent(new Event('wenbu:account-changed'));
}
export async function finishDeletedAccount() {
  const owner = state.user?.id;
  window.dispatchEvent(new Event('wenbu:account-changing'));
  if (owner)
    for (const key of [
      cacheKey('journal', owner),
      cacheKey('session', owner),
      indexKey(owner),
      queueKey(owner),
      temporaryKey(owner),
    ]) {
      cloudCache.delete(key);
      localStorage.removeItem(key);
    }
  activeRuns = new Set();
  try {
    await accountRequest('/api/auth/sign-out', 'POST', {});
  } catch {
    /* The server has already revoked every session. */
  }
  publish({ user: null, pending: 0, temporary: 0, error: '' });
  localStorage.setItem('wenbu.account.changed', crypto.randomUUID());
  window.dispatchEvent(new Event('wenbu:account-changed'));
}
export function openAccount(
  intent?: AccountIntent,
  entry: AccountEntry = intent ? 'account-save' : 'account-header',
) {
  window.dispatchEvent(
    new CustomEvent<AccountOpenRequest>('wenbu:account-open', { detail: { intent, entry } }),
  );
}
export function downloadAccount(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportTemporary() {
  if (state.user)
    downloadAccount(
      { owner: state.user.id, records: read<Index>(temporaryKey(state.user.id), {}) },
      'wenbu-browser-only.json',
    );
}
export async function discardTemporary() {
  if (state.user) {
    localStorage.removeItem(temporaryKey(state.user.id));
    publish({ temporary: 0 });
    await refreshCloud();
    window.dispatchEvent(new Event('wenbu:records-changed'));
  }
}
export async function exportAccount() {
  const owner = state.user?.id;
  if (!owner) throw new AccountClientError('sign_in_required');
  const manifest = await recordManifest('/api/account/export', owner);
  const records: CloudRecord[] = [];
  for (const r of manifest.records) {
    const item = await accountRequest<CloudRecord>(
      `/api/account/records/${r.kind}/${r.id}`,
      'GET',
      undefined,
      owner,
    );
    if (item.revision !== r.revision) throw new AccountClientError('export_changed');
    records.push(item);
  }
  const after = await recordManifest('/api/account/export', owner);
  if (serialize(after.records) !== serialize(manifest.records))
    throw new AccountClientError('export_changed');
  if (state.user?.id !== owner) throw new AccountClientError('account_changed');
  downloadAccount(
    {
      schema: 'wenbu.account.export.v1',
      createdAt: manifest.createdAt,
      complete: true,
      records,
      pending: pendingRecords(),
      browserOnly: read<Index>(temporaryKey(owner), {}),
    },
    'wenbu-account.json',
  );
}
if (typeof window !== 'undefined') {
  window.addEventListener('wenbu:analytics-preference', () => {
    if (state.user)
      void accountRequest('/api/account/preferences', 'PATCH', {
        analyticsEnabled: analyticsEnabled(),
      }).catch(() => publish({ error: 'preference_sync_failed' }));
  });
  window.addEventListener('online', () => void retryAccount());
  window.addEventListener('storage', (e) => {
    if (e.key === 'wenbu.account.changed') void initializeAccount(true);
  });
  window.addEventListener('beforeunload', (e) => {
    if (pendingRecords().length) e.preventDefault();
  });
}
