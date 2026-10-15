import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  CircleAlert,
  Cloud,
  Download,
  History,
  LoaderCircle,
  MessageCircle,
  Moon,
  PenLine,
  Sunrise,
} from 'lucide-react';
import { dailyPractice, isDailyReading, type DailyClock, type DailyReading } from '../lib/daily';
import { dailyEntry } from '../lib/daily';
import { readJournal, writeJournal, downloadJson, type Entry } from '../lib/journal';
import {
  accountSnapshot,
  accountServerSnapshot,
  subscribeAccount,
  initializeAccount,
  openAccount,
  recordSaveState,
  accountInstance,
} from '../lib/account-client';
import { analyticsHeaders, track } from '../lib/analytics';
import { readingConversation } from '../lib/reading-conversation';
import { persistSessions, restoreSessions } from '../lib/agent-session';
import { useClientReady } from '../lib/use-client-ready';
import { href } from '../lib/i18n';
import { tarotArt } from '../data/tarot-art';
import type { Locale } from '../lib/schema';
import TarotCard from './TarotCard';

type DailyEntry = Entry & { result: DailyReading };
const isDailyEntry = (e: Entry): e is DailyEntry => isDailyReading(e.result);
function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
let memorySeed = '';
function browserSeed() {
  try {
    const previous = localStorage.getItem('wenbu.daily.seed');
    if (previous && /^[a-f\d-]{36}$/i.test(previous)) return previous;
    const seed = crypto.randomUUID();
    localStorage.setItem('wenbu.daily.seed', seed);
    return seed;
  } catch {
    return (memorySeed ||= crypto.randomUUID());
  }
}
function dateLabel(date: string, locale: Locale, compact = false) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(compact ? {} : { weekday: 'long' }),
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function DailyCard({ locale }: { locale: Locale }) {
  const zh = locale === 'zh',
    t = (a: string, b: string) => (zh ? a : b);
  const ready = useClientReady();
  const account = useSyncExternalStore(subscribeAccount, accountSnapshot, accountServerSnapshot);
  const [clock, setClock] = useState<DailyClock>();
  const [entry, setEntry] = useState<DailyEntry>();
  const [recent, setRecent] = useState<DailyEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [animate, setAnimate] = useState(false);
  const active = useRef(entry),
    draft = useRef(note),
    generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const surface = useRef<HTMLDivElement>(null),
    offer = useRef<HTMLDivElement>(null);
  const pendingView = useRef<{ event: 'daily_revealed' | 'daily_revisited'; operation?: string }>({
    event: 'daily_revisited',
  });
  const offerSeen = useRef(false),
    revealing = useRef(false);
  const seen = useRef(new Set<string>());
  const expires = useRef(0);
  active.current = entry;
  draft.current = note;

  async function request(action: 'status' | 'reveal', previous?: DailyEntry) {
    const owner = accountSnapshot().user?.id;
    const operation = crypto.randomUUID();
    const response = await fetch('/api/v1/daily', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...analyticsHeaders({ operation }),
        'X-Wenbu-Request-Id': operation,
        ...(owner ? { 'X-Wenbu-Owner': owner } : {}),
        ...(accountInstance() ? { 'X-Wenbu-Instance': accountInstance()! } : {}),
      },
      body: JSON.stringify({
        action,
        timezone: browserTimezone(),
        locale,
        seed: browserSeed(),
        ...(previous?.receipt ? { previous: { result: previous.result, receipt: previous.receipt } } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'request_failed');
    const data = (await response.json()) as { clock: DailyClock; result?: DailyReading };
    if (
      !data.clock ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.clock.date) ||
      !Number.isFinite(data.clock.nextAt) ||
      !Number.isFinite(data.clock.serverNow) ||
      (action === 'reveal' && !isDailyReading(data.result))
    )
      throw new Error('invalid_response');
    return { ...data, receipt: response.headers.get('X-Wenbu-Receipt') || undefined, operation };
  }
  function remember(list: DailyEntry[]) {
    const dates = new Set<string>();
    setRecent(
      list
        .sort((a, b) => b.result.daily.date.localeCompare(a.result.daily.date))
        .filter((item) => {
          if (dates.has(item.result.daily.date)) return false;
          dates.add(item.result.daily.date);
          return true;
        })
        .slice(0, 7),
    );
  }
  function applyClock(next: DailyClock) {
    expires.current = performance.now() + Math.max(0, next.nextAt - next.serverNow);
    setClock(next);
  }
  useEffect(() => {
    let mounted = true;
    const load = async (reset = false) => {
      const run = ++generation.current;
      if (reset) {
        setEntry(undefined);
        setNote('');
        setNoteSaved(false);
        setError('');
        setStorageError(false);
        setLoading(true);
      }
      try {
        await initializeAccount();
        const data = await request('status');
        if (!mounted || run !== generation.current) return;
        applyClock(data.clock);
        const entries = readJournal().filter(isDailyEntry);
        remember(entries);
        const today = entries.find((e) => e.result.daily.date === data.clock.date);
        if (today && (!active.current || reset)) {
          pendingView.current = { event: 'daily_revisited' };
          setEntry(today);
          setNote(today.note);
          setAnimate(false);
        }
        setError('');
      } catch {
        if (mounted && run === generation.current)
          setError(t('暂时无法确认今日日期，请重试。', 'We could not check today’s date. Please try again.'));
      } finally {
        if (mounted && run === generation.current) setLoading(false);
      }
    };
    const changing = () => {
      ++generation.current;
      active.current = undefined;
      revealing.current = false;
      setEntry(undefined);
      setNote('');
      setRecent([]);
      setBusy(false);
      setLoading(true);
    };
    const changed = () => {
      void load(true);
    };
    const records = () => {
      const list = readJournal().filter(isDailyEntry);
      remember(list);
      const current = active.current;
      if (current) {
        const updated = list.find((e) => e.id === current.id);
        if (updated && draft.current === current.note) {
          setEntry(updated);
          setNote(updated.note);
        }
      }
    };
    const foreground = () => {
      if (document.visibilityState === 'visible' && !revealing.current) void load();
    };
    const tick = window.setInterval(() => {
      if (
        expires.current &&
        performance.now() >= expires.current &&
        document.visibilityState === 'visible' &&
        !revealing.current
      ) {
        expires.current = 0;
        void load();
      }
    }, 15000);
    void load();
    window.addEventListener('wenbu:account-changing', changing);
    window.addEventListener('wenbu:account-changed', changed);
    window.addEventListener('wenbu:records-changed', records);
    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('focus', foreground);
    return () => {
      mounted = false;
      ++generation.current;
      clearInterval(tick);
      window.removeEventListener('wenbu:account-changing', changing);
      window.removeEventListener('wenbu:account-changed', changed);
      window.removeEventListener('wenbu:records-changed', records);
      document.removeEventListener('visibilitychange', foreground);
      window.removeEventListener('focus', foreground);
    };
    // Locale is fixed for this Astro island; event handlers use current account and entry refs.
  }, [locale]);

  useEffect(() => {
    if (!entry || !surface.current) return;
    const key = `${account.user?.id || 'guest'}:${entry.result.daily.date}`;
    if (seen.current.has(key)) return;
    let intersecting = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!intersecting || document.visibilityState !== 'visible' || seen.current.has(key)) return;
      timer = setTimeout(() => {
        seen.current.add(key);
        const view = pendingView.current;
        track(view.event, {
          tool: 'daily',
          action: view.event === 'daily_revealed' ? 'daily-reveal' : 'daily-history',
          operation: view.operation,
        });
      }, 1000);
    };
    const observer = new IntersectionObserver(
      ([view]) => {
        intersecting = view.isIntersecting && view.intersectionRatio >= 0.35;
        schedule();
      },
      { threshold: 0.35 },
    );
    observer.observe(surface.current);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [entry?.id, account.user?.id]);
  useEffect(() => {
    if (!entry || !offer.current || account.user || offerSeen.current) return;
    const observer = new IntersectionObserver(
      ([view]) => {
        if (view.isIntersecting && view.intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
          offerSeen.current = true;
          track('registration_offer_viewed', { tool: 'daily', action: 'daily-save' });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(offer.current);
    return () => observer.disconnect();
  }, [entry?.id, account.user, account.ready, account.enabled]);

  function persist(item: DailyEntry) {
    try {
      const entries = readJournal();
      writeJournal([item, ...entries.filter((e) => e.id !== item.id)]);
      remember([item, ...entries.filter(isDailyEntry).filter((e) => e.id !== item.id)]);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  }
  async function reveal() {
    if (revealing.current || !ready || !account.ready) return;
    // Preserve an unfinished reflection before moving to a new day.
    if (entry && note !== entry.note && !persist({ ...entry, note })) return;
    const run = ++generation.current;
    revealing.current = true;
    setBusy(true);
    setError('');
    track('tool_started', { tool: 'daily', action: 'daily-reveal' });
    try {
      const data = await request('reveal', entry);
      if (run !== generation.current) return;
      applyClock(data.clock);
      const saved = readJournal()
        .filter(isDailyEntry)
        .find((e) => e.result.daily.date === data.clock.date);
      const next = saved || (dailyEntry(data.result!, locale, data.receipt) as DailyEntry);
      const item = { ...next, result: data.result!, receipt: data.receipt };
      pendingView.current = {
        event: saved ? 'daily_revisited' : 'daily_revealed',
        operation: data.operation,
      };
      setEntry(item);
      setNote(item.note);
      setNoteSaved(false);
      setAnimate(!saved);
      persist(item);
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    } catch (e) {
      if (run !== generation.current) return;
      setError(
        e instanceof Error && e.message === 'rate_limited'
          ? t('请求有些频繁，请稍后再揭签。', 'Please wait a moment before trying again.')
          : t(
              '这次未能打开日签。重试仍会保留今天的同一张牌。',
              'Your card could not be opened. Trying again will keep the same card for today.',
            ),
      );
      track('client_error', { tool: 'daily', action: 'daily-reveal', status: 'error' });
    } finally {
      if (run === generation.current) {
        setBusy(false);
        revealing.current = false;
      }
    }
  }
  const reading = entry?.result;
  const practice = reading ? dailyPractice(reading, locale) : undefined;
  const card = reading?.cards[0];
  const old = !!reading && !!clock && reading.daily.date !== clock.date;
  const saveState = entry ? recordSaveState('journal', entry) : 'unsaved';
  const saveLabel =
    saveState === 'cloud'
      ? t('这一签已保存到云端', 'This card is saved to your account')
      : saveState === 'pending'
        ? t('这一签正在同步…', 'This card is syncing…')
        : saveState === 'error'
          ? t('云端同步待重试，浏览器副本仍保留', 'Cloud sync needs a retry; a browser copy is kept')
          : saveState === 'browser'
            ? t('已暂存此浏览器', 'Kept in this browser')
            : t('尚未保存，请导出备份', 'Not saved yet. Export a backup.');
  return (
    <div className="daily-workspace" aria-busy={busy || loading}>
      <div className="daily-dateline">
        <span>
          <Sunrise size={17} aria-hidden="true" />
          {clock ? (
            <time dateTime={clock.date}>{dateLabel(clock.date, locale)}</time>
          ) : (
            t('正在确认今日日期…', 'Checking today’s date…')
          )}
        </span>
        <span>
          {clock
            ? `${clock.timezone} · ${t('当地零点更新', 'renews at local midnight')}`
            : t('按你所在的时区', 'In your local timezone')}
        </span>
      </div>
      {old && (
        <div className="daily-new-day" role="status">
          <Sunrise size={18} />
          <span>
            {t('你正在回看', 'You are revisiting')} {reading!.daily.date}
            {t(' 的日签。今天已有新的一签。', '. Today’s card is ready when you are.')}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={busy || loading}
            onClick={() => void reveal()}
          >
            {t('打开今日日签', 'Open today’s card')} <ArrowRight size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="daily-error" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              if (entry && note !== entry.note && !persist({ ...entry, note })) return;
              window.location.reload();
            }}
          >
            {t('重新检查', 'Check again')}
          </button>
        </div>
      )}
      <div className={`daily-stage ${reading ? 'has-reading' : ''}`}>
        <div className="daily-art-area" ref={surface}>
          <div className="daily-orbit" aria-hidden="true">
            <i />
            <i />
            <span>WENBU · {t('一日一签', 'A MOMENT EACH DAY')}</span>
          </div>
          {reading ? (
            <div className={`daily-illustration ${animate ? 'daily-unfold' : ''}`} key={entry!.id}>
              <TarotCard card={reading.cards[0]} locale={locale} />
              <span className="daily-card-caption">
                {t('问卜原创牌面 · 正位', 'The Wenbu deck · upright')}
              </span>
            </div>
          ) : (
            <button
              className={`daily-card-back ${busy ? 'is-opening' : ''}`}
              type="button"
              onClick={() => void reveal()}
              disabled={!ready || loading || busy || !account.ready}
              aria-label={t('揭开今日日签', 'Reveal today’s card')}
            >
              <img src="/images/tarot/back.webp" width="600" height="900" alt="" decoding="async" />
              <span className="daily-back-prompt">
                {loading || !ready
                  ? t('准备日签…', 'Getting ready…')
                  : busy
                    ? t('正在打开…', 'Opening…')
                    : t('轻触揭签', 'Tap to reveal')}
              </span>
            </button>
          )}
        </div>
        <div className="daily-content" data-clarity-mask="true">
          {!reading ? (
            <>
              <span className="eyebrow">{t('不必先有一个问题', 'YOU DON’T NEED A QUESTION')}</span>
              <h2>{t('给今天，留一点新的视角。', 'A little perspective for your day.')}</h2>
              <p className="daily-intro">
                {t(
                  '安静片刻，翻开一张牌。带走一个可以试的小行动，晚些时候，再回来看看自己的发现。',
                  'Take a quiet moment and turn over a card. Try one small action, then come back later to see what you noticed.',
                )}
              </p>
              <button
                className="button vermillion daily-reveal-button"
                type="button"
                disabled={!ready || loading || busy || !account.ready || !clock}
                onClick={() => void reveal()}
              >
                {busy || loading ? <LoaderCircle size={17} className="daily-spin" /> : <Sunrise size={18} />}
                {busy
                  ? t('正在打开…', 'Opening your card…')
                  : loading || !ready
                    ? t('准备日签…', 'Getting ready…')
                    : t('揭开今日日签', 'Reveal today’s card')}{' '}
                {!busy && !loading && <ArrowRight size={17} />}
              </button>
              <div className="daily-promise">
                <span>{t('免费 · 无需注册', 'Free · No account needed')}</span>
                <span>{t('不用填写资料 · 不消耗对话回合', 'No forms · No Agent turns used')}</span>
              </div>
              <ol className="daily-steps">
                <li>
                  <span>01</span>
                  {t('揭一张牌', 'Turn a card')}
                </li>
                <li>
                  <span>02</span>
                  {t('做一件小事', 'Try one thing')}
                </li>
                <li>
                  <span>03</span>
                  {t('留一句回看', 'Reflect later')}
                </li>
              </ol>
            </>
          ) : (
            <>
              <span className="eyebrow daily-result-kicker">
                {t('这一签，留给', 'YOUR CARD FOR')}{' '}
                <time dateTime={reading.daily.date}>{dateLabel(reading.daily.date, locale)}</time>
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {zh ? card!.zh : card!.en}
                <span className="daily-card-number">
                  {card!.arcana === 'major' ? t('大阿卡纳', 'MAJOR ARCANA') : t('小阿卡纳', 'MINOR ARCANA')}
                </span>
              </h2>
              <p className="daily-keywords">{zh ? card!.keywordsZh : card!.keywordsEn}</p>
              <div className="daily-action">
                <span>
                  <Sunrise size={18} />
                  {t('今天，试一件小事', 'ONE SMALL THING TO TRY')}
                </span>
                <p>{practice!.action}</p>
              </div>
              <div className="daily-reflection">
                <span>
                  <Moon size={17} />
                  {t('晚些时候，问问自己', 'A QUESTION FOR LATER')}
                </span>
                <p>{practice!.question}</p>
              </div>
              <p className="daily-symbol-note">
                {t(
                  '把它当作观察生活的提示。牌面不决定今天会发生什么。',
                  'Use this as a prompt to notice your day. The card does not decide what will happen.',
                )}
              </p>
              <div className="daily-result-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || loading || !account.ready}
                  onClick={() => {
                    const next = { ...entry!, note };
                    if (!persist(next)) return;
                    setEntry(next);
                    try {
                      const session = readingConversation(next, locale);
                      persistSessions([session, ...restoreSessions()]);
                      track('daily_agent_opened', { tool: 'daily', action: 'daily-agent' });
                      window.location.assign(
                        `${href(locale, 'agent')}?session=${encodeURIComponent(session.id)}`,
                      );
                    } catch {
                      setError(
                        t(
                          '未能带入对话，日签仍在。请导出备份或重试。',
                          'Could not open a conversation. Your card is still here; export a backup or try again.',
                        ),
                      );
                    }
                  }}
                >
                  <MessageCircle size={17} />
                  {t('带着这张牌聊聊', 'Talk about this card')}
                  <ArrowRight size={16} />
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    downloadJson(
                      { version: 1, entry: { ...entry!, note } },
                      `wenbu-daily-${reading.daily.date}.json`,
                    );
                    track('cta_click', { tool: 'daily', action: 'daily-export' });
                  }}
                >
                  <Download size={16} />
                  {t('导出这一签', 'Export card')}
                </button>
              </div>
              <p className="daily-handoff-note">
                {t(
                  '只带入这张牌和你写下的记录；发送消息后才使用对话回合。',
                  'Only this card and your note are carried over. A turn is used when you send a message.',
                )}
              </p>
            </>
          )}
        </div>
      </div>
      {reading && (
        <section className="daily-note-area" aria-labelledby="daily-note-heading" data-clarity-mask="true">
          <div className="daily-note-heading">
            <div>
              <span className="eyebrow">{t('属于你的部分', 'THE PART THAT IS YOURS')}</span>
              <h3 id="daily-note-heading">
                <PenLine size={19} />
                {t('今天，后来怎样了？', 'How did the day unfold?')}
              </h3>
            </div>
            <span className="daily-save-state" role="status">
              {saveState === 'cloud' ? <Cloud size={15} /> : <BookmarkPlus size={15} />}
              {saveLabel}
            </span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = { ...entry!, note: note.trim() };
              if (persist(next)) {
                setEntry(next);
                setNote(next.note);
                setNoteSaved(true);
                track('daily_reflection_saved', { tool: 'daily', action: 'daily-reflection' });
              }
            }}
          >
            <label className="sr-only" htmlFor="daily-note">
              {t('日签回看笔记', 'Your daily reflection')}
            </label>
            <textarea
              id="daily-note"
              maxLength={2000}
              rows={3}
              value={note}
              placeholder={t(
                '记下一件真实发生的小事，或一个想留住的念头。可以晚些再写。',
                'A small thing that happened, or a thought you want to keep. You can write this later.',
              )}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteSaved(false);
              }}
            />
            <div className="daily-note-footer">
              <span>
                {t('可选 · 你的笔记不会用于访问统计', 'Optional · Your note is never sent to analytics')}
              </span>
              <button
                className="button secondary"
                type="submit"
                disabled={!note.trim() || (note === entry!.note && !storageError)}
              >
                {noteSaved ? <Check size={16} /> : <PenLine size={16} />}
                {noteSaved ? t('已记下', 'Noted') : t('记下这一刻', 'Keep this note')}
              </button>
            </div>
          </form>
          {storageError && (
            <p className="error-message" role="alert">
              {t(
                '浏览器存储不可用，暂未保存。日签仍可查看，请用上方按钮导出备份。',
                'Browser storage is unavailable, so this is not saved yet. You can still read the card and export a backup above.',
              )}
            </p>
          )}
          {!account.user && account.ready && account.enabled && (
            <div className="daily-account-offer" ref={offer}>
              <BookmarkPlus size={21} />
              <div>
                <strong>{t('留住今天，换个设备也能回看。', 'Keep today’s card wherever you return.')}</strong>
                <p>
                  {t(
                    '邮箱验证码登录；首次验证会创建免费账号。只保存你选择的这一签。',
                    'Sign in with an email code. Your first sign-in creates a free account and saves this selected entry.',
                  )}
                </p>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  const next = { ...entry!, note };
                  if (!persist(next)) return;
                  setEntry(next);
                  track('registration_offer_clicked', { tool: 'daily', action: 'daily-save' });
                  openAccount(
                    { kind: 'journal', content: next, label: t('这一张日签', 'This daily card') },
                    'account-save',
                  );
                }}
              >
                {t('免费保存到账号', 'Save to a free account')}
                <ArrowRight size={15} />
              </button>
            </div>
          )}
          {!!account.user &&
            (saveState === 'pending' || saveState === 'error' || saveState === 'browser') && (
              <button
                type="button"
                className="text-button"
                onClick={() => openAccount(undefined, 'account-history')}
              >
                <Cloud size={16} />
                {t('查看云端保存状态', 'Check cloud save status')}
              </button>
            )}
        </section>
      )}
      {recent.length > 0 && (
        <section className="daily-history" aria-label={t('最近的日签', 'Recent daily cards')}>
          <div>
            <span className="eyebrow">
              <History size={15} />
              {t('最近的日签', 'RECENT DAILY CARDS')}
            </span>
            <a className="text-link" data-track="daily-history" href={href(locale, 'journal')}>
              {t('去手记回看', 'Open your journal')}
              <ArrowRight size={15} />
            </a>
          </div>
          <div className="daily-history-list">
            {recent.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === entry?.id}
                onClick={() => {
                  if (entry && draft.current !== entry.note && !persist({ ...entry, note: draft.current }))
                    return;
                  pendingView.current = { event: 'daily_revisited' };
                  setEntry(item);
                  setNote(item.note);
                  setNoteSaved(false);
                  setAnimate(false);
                  heading.current?.focus({ preventScroll: true });
                }}
              >
                <img
                  src={tarotArt[item.result.cards[0].id].replace('.webp', '-small.webp')}
                  width="42"
                  height="63"
                  alt=""
                  loading="lazy"
                />
                <span>
                  <time dateTime={item.result.daily.date}>
                    {dateLabel(item.result.daily.date, locale, true)}
                  </time>
                  <small>{zh ? item.result.cards[0].zh : item.result.cards[0].en}</small>
                </span>
              </button>
            ))}
          </div>
          <p>
            {t(
              '来过的日子，都值得记下。不必连续，也不必补签。',
              'Every visit can be worth keeping. No streak to protect, no days to make up.',
            )}
          </p>
        </section>
      )}
    </div>
  );
}
