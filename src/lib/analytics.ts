import { enqueue, pendingEvents, removeEvents, trimOutbox, type PendingEvent } from './analytics-outbox';
import { isAnalyticsTest } from './analytics-test';
import {
  actions,
  analyticsRelease,
  type settings,
  type variants,
  campaigns,
  mediums,
  referrerSource,
  safePage,
  sources,
  type ClientEvent,
  type tools,
  type statuses,
} from './analytics-contract';

export type Correlation = { operation?: string; parentOperation?: string; conversation?: string };
type Dimensions = Correlation & {
  destination?: string;
  setting?: (typeof settings)[number];
  variant?: (typeof variants)[number];
  tool?: (typeof tools)[number];
  mode?: 'none' | 'explore' | 'research';
  action?: (typeof actions)[number];
  status?: (typeof statuses)[number];
  value?: number;
  duration?: number;
};
type Session = { id: string; last: number; source: string; medium: string; campaign: string; entry: string };
const preferenceKey = 'wenbu.analytics.disabled';
let session: Session | undefined;
let visitor = '';
let initialized = false;
let sequence = 0;
let pageId: string | undefined;
let writes: Promise<void> = Promise.resolve();
let flushing = false;
let retryDelay = 1500;
let batchSize = 10;
let timer: ReturnType<typeof setTimeout> | undefined;
let memoryDisabled = false;

export function analyticsEnabled() {
  if (
    typeof window === 'undefined' ||
    memoryDisabled ||
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return false;
  try {
    return localStorage.getItem(preferenceKey) !== 'true';
  } catch {
    return false;
  }
}
export function setAnalyticsEnabled(enabled: boolean) {
  memoryDisabled = !enabled;
  try {
    localStorage.setItem(preferenceKey, String(!enabled));
    if (!enabled) {
      localStorage.removeItem('wenbu.analytics.visitor');
      sessionStorage.removeItem('wenbu.analytics.session');
    }
  } catch {
    /* Preference applies to this page even when storage is unavailable. */
  }
  if (!enabled) {
    void writes.then(() => removeEvents());
    session = undefined;
    visitor = '';
    clearTimeout(timer);
  }
  syncAnalyticsPreference();
  window.dispatchEvent(new Event('wenbu:analytics-preference'));
  if (enabled) track('page_view');
}
// Preference only: no identity or tracking value is sent in this cookie.
function syncAnalyticsPreference() {
  try {
    document.cookie = `wenbu_analytics=${analyticsEnabled() ? '' : 'off'}; Path=/; SameSite=Lax; Max-Age=${analyticsEnabled() ? 0 : 31536000}${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {
    /* Cookie restrictions must not break tools or client opt-out. */
  }
}
function identity() {
  if (!analyticsEnabled()) return;
  try {
    const now = Date.now();
    if (!visitor) {
      const stored = JSON.parse(localStorage.getItem('wenbu.analytics.visitor') || 'null');
      const v =
        stored && typeof stored.id === 'string' && stored.expires > now
          ? stored
          : { id: crypto.randomUUID(), expires: now + 30 * 86400000 };
      visitor = v.id;
      localStorage.setItem('wenbu.analytics.visitor', JSON.stringify(v));
    }
    if (!session)
      session = JSON.parse(sessionStorage.getItem('wenbu.analytics.session') || 'null') ?? undefined;
    if (!session || now - session.last > 30 * 60000) {
      const params = new URLSearchParams(location.search);
      const ref = referrerSource(document.referrer, location.origin);
      const source =
        sources.find((s) => s === params.get('utm_source')) ?? (ref === 'internal' ? 'direct' : ref);
      const medium =
        mediums.find((m) => m === params.get('utm_medium')) ??
        (['google', 'bing', 'baidu', 'duckduckgo'].includes(source)
          ? 'organic'
          : ['chatgpt', 'perplexity', 'claude', 'deepseek'].includes(source)
            ? 'ai'
            : source === 'direct'
              ? 'none'
              : 'referral');
      session = {
        id: crypto.randomUUID(),
        last: now,
        source,
        medium,
        campaign: campaigns.find((c) => c === params.get('utm_campaign')) ?? 'none',
        entry: safePage(location.pathname),
      };
    }
    session.last = now;
    sessionStorage.setItem('wenbu.analytics.session', JSON.stringify(session));
    return session;
  } catch {
    return;
  }
}
const validId = (value?: string) =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
export function analyticsContext(correlation: Correlation = {}) {
  const s = identity();
  return s
    ? {
        session: s.id,
        pageId: (pageId ??= crypto.randomUUID()),
        operation: validId(correlation.operation),
        parentOperation: validId(correlation.parentOperation),
        conversation: validId(correlation.conversation),
        release: analyticsRelease,
        visitor,
        source: s.source,
        medium: s.medium,
        campaign: s.campaign,
        entry: s.entry,
        page: safePage(location.pathname),
        locale: document.documentElement.lang.startsWith('zh') ? 'zh' : 'en',
        test: isAnalyticsTest(),
      }
    : undefined;
}
export function analyticsHeaders(correlation: Correlation = {}): Record<string, string> {
  const context = analyticsContext(correlation);
  return { 'X-Wenbu-Client': 'web', 'X-Wenbu-Analytics': context ? JSON.stringify(context) : 'off' };
}
export function track(event: ClientEvent, dimensions: Dimensions = {}) {
  if (typeof location !== 'undefined' && location.pathname.includes('/insights')) return;
  const context = analyticsContext(dimensions);
  if (!context) return;
  const entry: PendingEvent = {
    id: crypto.randomUUID(),
    event,
    ...dimensions,
    ...context,
    occurredAt: Date.now(),
    sequence: ++sequence,
    version: 2,
  };
  writes = writes
    .then(async () => {
      if (!analyticsEnabled()) return;
      await enqueue(entry);
      if (!analyticsEnabled()) await removeEvents();
    })
    .catch(() => undefined);
  if (!timer) timer = setTimeout(() => void flush(), 1500);
}
async function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (flushing || !analyticsEnabled()) return;
  flushing = true;
  let again = false;
  try {
    await writes;
    const trimmed = await trimOutbox();
    if (trimmed.expired)
      track('telemetry_gap', { variant: 'queue-expired', value: Math.min(100, trimmed.expired) });
    if (trimmed.overflow)
      track('telemetry_gap', { variant: 'queue-full', value: Math.min(100, trimmed.overflow) });
    const events = await pendingEvents(batchSize);
    if (!events.length || !analyticsEnabled()) return;
    again = true;
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
      credentials: 'omit',
    });
    if (response.ok) {
      await removeEvents(events.map((e) => e.id));
      batchSize = 10;
      retryDelay = 2200;
    } else if ([400, 413, 422].includes(response.status)) {
      // Isolate a stale or malformed entry without dropping the rest of its batch.
      if (events.length > 1) batchSize = 1;
      else {
        await removeEvents([events[0].id]);
        batchSize = 10;
        if (events[0].event !== 'telemetry_gap') track('telemetry_gap', { variant: 'rejected', value: 1 });
      }
      retryDelay = 1000;
    } else throw new Error('Delivery deferred');
  } catch {
    retryDelay = Math.min(60000, Math.max(5000, retryDelay * 2));
    again = true;
  } finally {
    flushing = false;
    if (again && analyticsEnabled()) {
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), retryDelay);
    }
  }
}
export function initializeAnalytics() {
  syncAnalyticsPreference();
  try {
    if (isAnalyticsTest())
      document.cookie =
        'wenbu_analytics_test=1; Path=/; SameSite=Lax; Max-Age=3600' +
        (location.protocol === 'https:' ? '; Secure' : '');
  } catch {
    /* Test classification remains available through request headers. */
  }
  if (initialized || location.pathname.includes('/insights')) return;
  initialized = true;
  if (!analyticsEnabled()) void removeEvents();
  window.addEventListener('online', () => void flush());
  window.addEventListener('storage', (e) => {
    if (e.key === preferenceKey) {
      memoryDisabled = e.newValue === 'true';
      syncAnalyticsPreference();
      if (memoryDisabled) {
        void writes.then(() => removeEvents());
        session = undefined;
        visitor = '';
        try {
          sessionStorage.removeItem('wenbu.analytics.session');
        } catch {
          /* The preference still applies in memory. */
        }
        clearTimeout(timer);
      }
    }
  });
  track('page_view');
  const depth = new Set<number>();
  let engaged = false;
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
  let visibleMs = 0;
  const updateVisible = () => {
    if (visibleSince) visibleMs += Date.now() - visibleSince;
    visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    if (!engaged && visibleMs >= 30000) {
      engaged = true;
      track('engaged', { duration: 30000 });
    }
  };
  setInterval(updateVisible, 15000);
  document.addEventListener('visibilitychange', () => {
    updateVisible();
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => {
    updateVisible();
    track('page_exit', { duration: Math.min(3600000, visibleMs) });
    void flush();
  });
  window.addEventListener(
    'scroll',
    () => {
      const height = document.documentElement.scrollHeight - innerHeight;
      if (height <= 0) return;
      const percent = (scrollY / height) * 100;
      for (const value of [50, 90])
        if (percent >= value && !depth.has(value)) {
          depth.add(value);
          track('scroll_depth', { value });
        }
    },
    { passive: true },
  );
  document.addEventListener('click', (e) => {
    const el = (e.target as Element)?.closest<HTMLElement>('[data-track]');
    const action = actions.find((a) => a === el?.dataset.track);
    if (action && action !== 'none')
      track(action === 'source' ? 'source_opened' : 'cta_click', {
        action,
        destination:
          el instanceof HTMLAnchorElement && el.origin === location.origin
            ? safePage(el.pathname)
            : '/other/',
      });
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    pageId = crypto.randomUUID();
    sequence = 0;
    depth.clear();
    engaged = false;
    visibleMs = 0;
    visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    track('page_view');
  });
  const forms = new WeakSet<Element>();
  document.addEventListener('focusin', (e) => {
    const form = (e.target as Element)?.closest('form');
    if (form && !forms.has(form)) {
      forms.add(form);
      track('form_started');
    }
  });
}
