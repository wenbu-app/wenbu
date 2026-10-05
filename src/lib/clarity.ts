import { analyticsEnabled } from './analytics';

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
const project = 'yqzdf8z0sr';
const deniedStorage = { ad_Storage: 'denied', analytics_Storage: 'denied' };
let initialized = false;
let script: HTMLScriptElement | undefined;
let stopped = false;
let accountOpen = false;

export function initializeClarity() {
  if (
    initialized ||
    location.hostname !== 'wenbu.app' ||
    /^\/(en\/)?(insights|move)(\/|$)/.test(location.pathname)
  )
    return;
  initialized = true;
  const host = window as Window & { clarity?: Clarity };
  const allowed = () => {
    try {
      return (
        analyticsEnabled() &&
        !accountOpen &&
        sessionStorage.getItem('wenbu.analytics.test') !== 'true' &&
        !/(?:^|;\s*)wenbu_analytics_test=1(?:;|$)/.test(document.cookie ?? '')
      );
    } catch {
      return false;
    }
  };
  const sync = () => {
    if (!allowed()) {
      if (script && !stopped) {
        host.clarity?.('consentv2', deniedStorage);
        host.clarity?.('stop');
        stopped = true;
      }
      return;
    }
    if (script) {
      if (stopped) {
        host.clarity?.('start');
        host.clarity?.('consentv2', deniedStorage);
        stopped = false;
      }
      return;
    }
    // The official asynchronous queue. Never share first-party visitor IDs or private text.
    host.clarity =
      host.clarity ||
      Object.assign(
        (...args: unknown[]) => {
          host.clarity!.q!.push(args);
        },
        { q: [] as unknown[][] },
      );
    // Cookie-less measurement; the existing opt-out stops recording entirely.
    host.clarity('consentv2', deniedStorage);
    host.clarity('set', 'locale', document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
    script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${project}`;
    script.dataset.wenbuClarity = project;
    script.addEventListener('load', () => {
      if (!allowed()) sync();
    });
    document.head.appendChild(script);
  };
  window.addEventListener('wenbu:analytics-preference', sync);
  window.addEventListener('wenbu:account-dialog', (event) => {
    accountOpen = !!(event as CustomEvent<{ open: boolean }>).detail?.open;
    sync();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'wenbu.analytics.disabled' || event.key === null) sync();
  });
  window.addEventListener('pageshow', sync);
  sync();
}
