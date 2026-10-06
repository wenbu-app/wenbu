import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Bookmark,
  Download,
  Check,
  LoaderCircle,
  SlidersHorizontal,
  Feather,
  Cloud,
} from 'lucide-react';
import type { Locale, ToolKind } from '../lib/schema';
import type { Reading } from '../lib/tools';
import { choose, href } from '../lib/i18n';
import { agentContext, downloadJson, readJournal, writeJournal, type Answer } from '../lib/journal';
import ReadingView from './ReadingView';
import FeedbackTrigger from './FeedbackTrigger';
import { readingExcerpt, answerExcerpt } from '../lib/feedback-excerpt';
import { analyticsHeaders, track, type Correlation } from '../lib/analytics';
import '../styles/reading-motion.css';
import {
  accountSnapshot,
  accountInstance,
  subscribeAccount,
  initializeAccount,
  openAccount,
  recordSaveState,
} from '../lib/account-client';
import { accountError } from './AccountPanel';
import { UserFacingError, uiErrorMessage } from '../lib/ui-error';
import { readingConversation } from '../lib/reading-conversation';
import { persistSessions, restoreSessions } from '../lib/agent-session';

async function post<T>(
  path: string,
  input: unknown,
  signal?: AbortSignal,
  action: 'example' | 'calculate' | 'none' = 'none',
  correlation: Correlation = {},
  onReceipt?: (receipt: string) => void,
): Promise<T> {
  await initializeAccount();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...analyticsHeaders(correlation),
      'X-Wenbu-Action': action,
      ...(accountInstance() ? { 'X-Wenbu-Instance': accountInstance()! } : {}),
      ...(accountSnapshot().user ? { 'X-Wenbu-Owner': accountSnapshot().user!.id } : {}),
      'X-Wenbu-Request-Id': correlation.operation || crypto.randomUUID(),
    },
    body: JSON.stringify(input),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new UserFacingError(accountError(data.error?.code, document.documentElement.lang.startsWith('zh')));
  const receipt = response.headers.get('X-Wenbu-Receipt');
  if (receipt) onReceipt?.(receipt);
  return data;
}
export default function ToolDesk({ kind, locale }: { kind: ToolKind; locale: Locale }) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const account = useSyncExternalStore(subscribeAccount, accountSnapshot, accountSnapshot);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [boundary, setBoundary] = useState<'midnight' | 'zi'>('midnight');
  const [solar, setSolar] = useState(false);
  const [longitude, setLongitude] = useState('');
  const [count, setCount] = useState<1 | 3>(3);
  const [reversals, setReversals] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [castMode, setCastMode] = useState<'random' | 'manual'>('random');
  const [lines, setLines] = useState([7, 8, 7, 8, 7, 8]);
  const [result, setResult] = useState<Reading | null>(null);
  const [exampleResult, setExampleResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [handoffError, setHandoffError] = useState('');
  const [provenance, setProvenance] = useState('');
  const [remaining, setRemaining] = useState<number>();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [includeBirth, setIncludeBirth] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const aiAbort = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const operation = useRef<string | undefined>(undefined);
  const interpretation = useRef<string | undefined>(undefined);
  const entryId = useRef<string | null>(null);
  const receipt = useRef<string | undefined>(undefined);
  useEffect(() => {
    void initializeAccount();
    const reset = () => {
      if (!accountSnapshot().user) return;
      aiAbort.current?.abort();
      setResult(null);
      setAnswer(undefined);
      setSaved(false);
      receipt.current = undefined;
    };
    window.addEventListener('wenbu:account-changing', reset);
    const savedToAccount = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string; id: string }>).detail;
      if (detail.kind === 'journal' && detail.id === entryId.current) setSaved(true);
    };
    window.addEventListener('wenbu:record-saved', savedToAccount);
    return () => {
      window.removeEventListener('wenbu:account-changing', reset);
      window.removeEventListener('wenbu:record-saved', savedToAccount);
    };
  }, []);
  useEffect(() => () => aiAbort.current?.abort(), []);
  function invalidateAnswer() {
    aiAbort.current?.abort();
    setAiBusy(false);
    setAnswer(undefined);
    setSaved(false);
  }
  function changeQuestion(value: string) {
    setQuestion(value);
    invalidateAnswer();
  }
  function changeContext(value: string) {
    setContext(value);
    invalidateAnswer();
  }
  const input = () =>
    kind === 'bazi'
      ? {
          date,
          time: unknown ? null : time,
          timezone,
          dayBoundary: boundary,
          solarTime: solar && !unknown,
          ...(solar && !unknown ? { longitude: Number(longitude) } : {}),
          locale,
        }
      : kind === 'ziwei'
        ? { date, time, sex, locale }
        : kind === 'tarot'
          ? { count, reversals, locale }
          : { ...(castMode === 'manual' ? { lines } : {}), locale };
  async function run(demo = false) {
    if (lock.current) return;
    lock.current = true;
    const operationId = crypto.randomUUID();
    operation.current = operationId;
    interpretation.current = undefined;
    track('tool_started', { tool: kind, operation: operationId, action: demo ? 'example' : 'calculate' });
    setBusy(true);
    setError('');
    setAiError('');
    setAnswer(undefined);
    setProvenance('');
    setSaved(false);
    setExportOpen(false);
    setIncludeBirth(false);
    setNote('');
    setRemaining(undefined);
    setConsent(false);
    setResult(null);
    entryId.current = null;
    receipt.current = undefined;
    aiAbort.current?.abort();
    setAiBusy(false);
    let payload = input();
    if (demo && (kind === 'bazi' || kind === 'ziwei')) {
      setDate('2000-08-16');
      setTime('03:30');
      setTimezone('Asia/Shanghai');
      setUnknown(false);
      setSolar(false);
      setBoundary('midnight');
      payload =
        kind === 'bazi'
          ? {
              date: '2000-08-16',
              time: '03:30',
              timezone: 'Asia/Shanghai',
              dayBoundary: 'midnight',
              solarTime: false,
              locale,
            }
          : { date: '2000-08-16', time: '03:30', sex, locale };
    }
    try {
      const data = await post<Reading>(
        `/api/v1/${kind}`,
        payload,
        undefined,
        demo ? 'example' : 'calculate',
        { operation: operationId },
        (value) => {
          receipt.current = value;
        },
      );
      setResult(data);
      setExampleResult(demo);
      track('result_viewed', { tool: kind, operation: operationId, status: 'complete' });
      entryId.current = crypto.randomUUID();
      setSelected([]);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        }),
      );
    } catch (e) {
      track('client_error', { tool: kind, operation: operationId, status: 'error' });
      setError(
        uiErrorMessage(
          e,
          t(
            kind === 'tarot'
              ? '抽牌暂未完成，问题和设置仍保留。请联网后重新选牌或随机抽取。'
              : '暂时无法取得结果。你的输入仍在，请联网后重试。',
            kind === 'tarot'
              ? 'The draw did not finish. Your question and settings are retained; reconnect and pick again or draw at random.'
              : 'We couldn’t get a result. Your input is still here; reconnect and try again.',
          ),
        ),
      );
      setSelected([]);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function selectCard(i: number) {
    if (busy || selected.includes(i)) return;
    const next = [...selected, i];
    setSelected(next);
    if (next.length === count) void run();
  }
  async function ask() {
    if (!result || aiBusy || !consent || question.trim().length < 2) return;
    const aiOperation = crypto.randomUUID();
    const correlation = { operation: aiOperation, parentOperation: operation.current };
    interpretation.current = aiOperation;
    track('ai_requested', { tool: kind, ...correlation });
    setAiBusy(true);
    setAiError('');
    const controller = new AbortController();
    aiAbort.current = controller;
    const readingInput =
      result.kind === 'tarot'
        ? { cards: result.cards.map((c) => ({ id: c.id, reversed: c.reversed })) }
        : result.kind === 'iching'
          ? { lines: result.lines, locale }
          : result.input;
    try {
      const data = await post<{ answer: Answer; remaining: number; provenance: { servedModel: string } }>(
        '/api/v1/interpret',
        { kind, input: readingInput, question, context, locale, consent: true },
        controller.signal,
        'none',
        correlation,
        (value) => {
          receipt.current = value;
        },
      );
      if (controller.signal.aborted) return;
      setAnswer(data.answer);
      track('ai_result_viewed', { tool: kind, ...correlation, status: 'complete' });
      setRemaining(data.remaining);
      setProvenance(data.provenance.servedModel);
      setSaved(false);
    } catch (e) {
      track('client_error', {
        tool: kind,
        ...correlation,
        status: controller.signal.aborted ? 'cancelled' : 'error',
      });
      if (!controller.signal.aborted)
        setAiError(
          uiErrorMessage(
            e,
            t(
              '解读暂未完成，原始结果仍保留。请稍后重试。',
              'The reading did not finish. Your original result is retained; please try again.',
            ),
          ),
        );
    } finally {
      if (aiAbort.current === controller) setAiBusy(false);
    }
  }
  function save(destination: 'browser' | 'account' = 'browser') {
    if (!result || (saved && destination !== 'account')) return;
    try {
      const entries = readJournal();
      const id = entryId.current ?? crypto.randomUUID();
      entryId.current = id;
      const previous = entries.find((e) => e.id === id);
      writeJournal([
        {
          id,
          createdAt: previous?.createdAt ?? new Date().toISOString(),
          context,
          provenance: answer ? provenance : undefined,
          kind,
          result,
          question,
          note,
          answer,
          receipt: receipt.current,
        },
        ...entries.filter((e) => e.id !== id),
      ]);
      setSaved(true);
      if (destination === 'account' && !accountSnapshot().user && accountSnapshot().enabled) {
        const current = readJournal().find((e) => e.id === id);
        if (current)
          openAccount(
            {
              kind: 'journal',
              content: current,
              label:
                question ||
                t(
                  { bazi: '八字命盘', iching: '易经卦象', tarot: '塔罗牌阵', ziwei: '紫微星盘' }[kind],
                  {
                    bazi: 'BaZi chart',
                    iching: 'I Ching reading',
                    tarot: 'Tarot reading',
                    ziwei: 'Zi Wei chart',
                  }[kind],
                ),
            },
            'account-save',
          );
      }
      track('journal_saved', {
        tool: kind,
        operation: interpretation.current ?? operation.current,
        action: 'save',
      });
    } catch {
      setAiError(
        t('浏览器无法保存，请使用导出备份。', 'Browser storage is unavailable. Please export a backup.'),
      );
    }
  }
  function continueInAgent() {
    if (!result || aiBusy || busy) return;
    try {
      const entries = readJournal();
      const id = entryId.current ?? crypto.randomUUID();
      entryId.current = id;
      const entry = {
        id,
        createdAt: entries.find((item) => item.id === id)?.createdAt ?? new Date().toISOString(),
        kind,
        result,
        question,
        context,
        note,
        answer,
        provenance: answer ? provenance : undefined,
        receipt: receipt.current,
      };
      writeJournal([entry, ...entries.filter((item) => item.id !== id)]);
      const session = readingConversation(entry, locale);
      persistSessions([session, ...restoreSessions()]);
      track('context_exported', { tool: kind, action: 'export', operation: operation.current });
      window.location.assign(href(locale, 'agent') + '?session=' + encodeURIComponent(session.id));
    } catch {
      setHandoffError(
        t(
          '暂时无法带入对话，原结果仍在。你也可以导出后继续。',
          'Could not carry this reading into a conversation. Your result is still here; you can export it instead.',
        ),
      );
    }
  }
  const savedEntry = saved ? readJournal().find((e) => e.id === entryId.current) : undefined;
  const saveState = savedEntry ? recordSaveState('journal', savedEntry) : 'unsaved';
  function saveControls() {
    return (
      <>
        {!account.user && account.enabled && (
          <button type="button" className="button primary" onClick={() => save('account')} disabled={aiBusy}>
            <Cloud size={16} />
            {t('免费保存到账号', 'Save to a free account')}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          onClick={() => save()}
          disabled={saved || aiBusy || !account.ready}
        >
          {saved ? <Check size={15} /> : <Bookmark size={15} />}
          {account.user
            ? t(saved ? '已留存' : '保存到手记', saved ? 'Reading retained' : 'Save to journal')
            : t(
                saved ? '已保存在此浏览器' : '保存在此浏览器',
                saved ? 'Saved in this browser' : 'Save in this browser',
              )}
        </button>
      </>
    );
  }
  return (
    <div className={`tool-desk tool-${kind}`}>
      <div className="tool-form-panel">
        <div className="step-label">
          <span>01</span>
          {t(
            kind === 'bazi' || kind === 'ziwei' ? '从你的出生时刻开始' : '给自己片刻安静',
            kind === 'bazi' || kind === 'ziwei' ? 'Begin with your birth details' : 'Take a quiet moment',
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          {kind === 'bazi' || kind === 'ziwei' ? (
            <>
              <div className="field-pair">
                <label className="field">
                  {t('公历出生日期', 'Birth date · Gregorian')}
                  <input
                    aria-label={t('公历出生日期', 'Birth date')}
                    type="date"
                    min="1901-01-01"
                    max="2099-12-31"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  {t('出生时间', 'Birth time')}
                  <input
                    aria-label={t('出生时间', 'Birth time')}
                    type="time"
                    required={!unknown}
                    disabled={unknown}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </label>
              </div>
              {kind === 'bazi' ? (
                <>
                  <label className="check-field">
                    <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
                    {t('不确定出生时间（不生成时柱）', 'I do not know the time (omit hour pillar)')}
                  </label>
                  <label className="field">
                    {t('出生地时区', 'Time zone at birth')}
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {[
                        ['Asia/Shanghai', '中国大陆 / China'],
                        ['Asia/Hong_Kong', '香港 / Hong Kong'],
                        ['Asia/Taipei', '台北 / Taipei'],
                        ['Asia/Singapore', '新加坡 / Singapore'],
                        ['Asia/Tokyo', '东京 / Tokyo'],
                        ['Asia/Seoul', '首尔 / Seoul'],
                        ['Asia/Kolkata', '印度 / India'],
                        ['Europe/London', '伦敦 / London'],
                        ['Europe/Paris', '巴黎 / Paris'],
                        ['America/New_York', '纽约 / New York'],
                        ['America/Los_Angeles', '洛杉矶 / Los Angeles'],
                        ['Australia/Sydney', '悉尼 / Sydney'],
                        ['UTC', 'UTC'],
                        ['+08:00', 'UTC+08:00 · 固定偏移 / fixed offset'],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="advanced">
                    <summary>
                      <SlidersHorizontal size={14} />
                      {t('历法选项', 'Calendar options')}
                    </summary>
                    <label className="field">
                      {t('其他 IANA 时区或 UTC 偏移', 'Other IANA time zone or UTC offset')}
                      <input
                        value={timezone}
                        maxLength={80}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="Asia/Shanghai"
                      />
                    </label>
                    <label className="field">
                      {t('换日规则', 'Day boundary')}
                      <select
                        value={boundary}
                        onChange={(e) => setBoundary(e.target.value as 'midnight' | 'zi')}
                      >
                        <option value="midnight">{t('零点换日（默认）', 'Midnight (default)')}</option>
                        <option value="zi">{t('子初 23:00 换日', 'Zi hour · 23:00')}</option>
                      </select>
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={solar}
                        disabled={unknown}
                        onChange={(e) => setSolar(e.target.checked)}
                      />
                      {t('使用近似真太阳时', 'Approximate apparent solar time')}
                    </label>
                    {solar && !unknown && (
                      <label className="field">
                        {t('出生地经度（东正西负）', 'Longitude (east + / west −)')}
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="any"
                          required
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          placeholder="121.47"
                        />
                      </label>
                    )}
                    <p>
                      {t(
                        '节气按绝对时刻判断。夏令时模糊时间需输入明确偏移。真太阳时是近似值，边界时刻建议对照。',
                        'Solar terms use absolute instants. Ambiguous DST times require an explicit offset. Solar correction is approximate; compare charts near boundaries.',
                      )}
                    </p>
                  </details>
                </>
              ) : (
                <>
                  <label className="field">
                    {t('传统排盘参数', 'Traditional chart parameter')}
                    <select value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')}>
                      <option value="female">{t('女', 'Female')}</option>
                      <option value="male">{t('男', 'Male')}</option>
                    </select>
                  </label>
                  <p className="form-note">
                    {t(
                      '用于传统顺逆行计算。输入当地钟表时间，本工具不做太阳时校正。',
                      'Used for the traditional direction rule. Enter local civil time; this tool does not apply solar correction.',
                    )}
                  </p>
                </>
              )}
              <button className="button primary full" type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    {t('展开我的命盘', 'Reveal my chart')}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <button
                className="text-button demo-button"
                type="button"
                onClick={() => void run(true)}
                disabled={busy}
              >
                {t('先看一份示例命盘', 'Explore an example first')} <ArrowUpRight size={14} />
              </button>
            </>
          ) : (
            <>
              <label className="field">
                {t('此刻，你想问什么？（可选）', 'What is on your mind? (optional)')}
                <textarea
                  value={question}
                  onChange={(e) => changeQuestion(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder={t(
                    '例如：面对新的机会，我可以注意什么？',
                    'For example: what could I pay attention to as I consider a new opportunity?',
                  )}
                />
              </label>
              <p className="form-note">
                {t(
                  '起卦或抽牌时，问题留在本页。只有主动请求解读才会发送。',
                  'Your question stays on this page until you request an AI reading.',
                )}
              </p>
              {kind === 'tarot' ? (
                <>
                  <div className="segmented" aria-label={t('牌阵', 'Spread')}>
                    <button
                      type="button"
                      aria-pressed={count === 1}
                      onClick={() => {
                        setCount(1);
                        track('setting_changed', { tool: kind, setting: 'tarot-count', variant: 'one' });
                        setSelected([]);
                      }}
                    >
                      {t('一张 · 当下', 'One · Reflection')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={count === 3}
                      onClick={() => {
                        setCount(3);
                        track('setting_changed', { tool: kind, setting: 'tarot-count', variant: 'three' });
                        setSelected([]);
                      }}
                    >
                      {t('三张 · 探索', 'Three · Perspective')}
                    </button>
                  </div>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={reversals}
                      onChange={(e) => {
                        setReversals(e.target.checked);
                        track('setting_changed', {
                          tool: kind,
                          setting: 'tarot-reversals',
                          variant: e.target.checked ? 'reversals' : 'upright',
                        });
                      }}
                    />
                    {t('包含逆位', 'Include reversed cards')}
                  </label>
                  <div className="tarot-deck" aria-label={t('选牌区', 'Card selection')}>
                    {Array.from({ length: 7 }, (_, i) => (
                      <button
                        type="button"
                        key={i}
                        className={`card-back ${selected.includes(i) ? 'selected' : ''}`}
                        style={{ '--card-i': i - 3 } as React.CSSProperties}
                        aria-label={t(`选择第 ${i + 1} 张牌`, `Choose card ${i + 1}`)}
                        disabled={busy || selected.includes(i)}
                        onClick={() => selectCard(i)}
                      >
                        <span>✦</span>
                      </button>
                    ))}
                  </div>
                  <p className="deck-instruction" aria-live="polite">
                    {busy
                      ? t('正在展开牌面…', 'Revealing your cards…')
                      : t(
                          `从完整 78 张中抽 ${count} 张 · 已选 ${selected.length} 张`,
                          `Choose ${count} · ${selected.length} selected`,
                        )}
                  </p>
                  <a className="deck-gallery-link" href={href(locale, 'tarot/deck')}>
                    {t('翻阅 78 张牌图鉴', 'Browse all 78 cards')} ↗
                  </a>
                  <button type="submit" className="button primary full" disabled={busy}>
                    {t('为我抽牌', 'Draw for me')}
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <div className="segmented">
                    <button
                      type="button"
                      aria-pressed={castMode === 'random'}
                      onClick={() => {
                        setCastMode('random');
                        track('setting_changed', { tool: kind, setting: 'iching-cast', variant: 'random' });
                      }}
                    >
                      {t('在线起卦', 'Cast online')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={castMode === 'manual'}
                      onClick={() => {
                        setCastMode('manual');
                        track('setting_changed', { tool: kind, setting: 'iching-cast', variant: 'manual' });
                      }}
                    >
                      {t('录入铜钱结果', 'Enter coin results')}
                    </button>
                  </div>
                  {castMode === 'manual' ? (
                    <div className="manual-lines">
                      {lines.map((v, i) => (
                        <label className="field" key={i}>
                          {t(
                            `第 ${i + 1} 爻${i === 0 ? '（最下方）' : ''}`,
                            `Line ${i + 1}${i === 0 ? ' (bottom)' : ''}`,
                          )}
                          <select
                            value={v}
                            onChange={(e) =>
                              setLines(lines.map((x, j) => (i === j ? Number(e.target.value) : x)))
                            }
                          >
                            {[6, 7, 8, 9].map((n) => (
                              <option value={n} key={n}>
                                {n} ·{' '}
                                {t(
                                  ['老阴', '少阳', '少阴', '老阳'][n - 6],
                                  ['Old yin', 'Young yang', 'Young yin', 'Old yang'][n - 6],
                                )}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className={`coin-ritual ${busy ? 'casting' : ''}`} aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{ '--i': i } as React.CSSProperties}>
                          <i />
                          通宝
                        </span>
                      ))}
                    </div>
                  )}
                  <button className="button primary full" type="submit" disabled={busy}>
                    {busy ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <>
                        {castMode === 'manual'
                          ? t('读取这组六爻', 'Read these lines')
                          : t('静心，起一卦', 'Pause. Cast a hexagram.')}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  <p className="form-note centered">
                    {t('六爻自下而上，记录每一处变化。', 'Six lines, bottom to top. Each change recorded.')}
                  </p>
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </form>
        <div className="privacy-note">
          <span>◌</span>
          <p>
            {t(
              '无需姓名或注册即可查看完整结果。结果生成后，可选择保存在此浏览器或登录保存到账号。',
              'Get a complete result without a name or account. Then choose browser storage or sign in for cloud history.',
            )}
          </p>
        </div>
      </div>
      <div
        className="tool-result-panel"
        ref={resultRef}
        aria-busy={busy}
        tabIndex={-1}
        data-account-return-focus
      >
        <p className="tool-status" role="status" aria-atomic="true">
          {busy
            ? t('正在生成图景。', 'Preparing your reading.')
            : result
              ? t('图景已展开，可以查看结果。', 'Your reading is ready to explore.')
              : ''}
        </p>
        {!result ? (
          <div className="empty-reading">
            <div className="empty-orbit" aria-hidden="true">
              <i />
              <span>
                {kind === 'bazi' ? '命' : kind === 'iching' ? '易' : kind === 'tarot' ? '象' : '星'}
              </span>
              <i />
            </div>
            <span className="eyebrow">A MOMENT FOR YOURSELF</span>
            <h2>{t('答案之前，先看见自己。', 'Before an answer, a new perspective.')}</h2>
            <p>
              {t(
                {
                  bazi: '填写出生日期与时间，先看四柱的结构。记不清时辰，也可以继续。',
                  ziwei: '填写出生日期与时辰，查看十二宫星曜。原始星盘与计算约定会显示在这里。',
                  iching: '带着一个具体的问题，选自动起卦或记录六次掷币。卦象与动爻会显示在这里。',
                  tarot: '想一个正在面对的问题，再选一张或三张牌。可以自己选牌，也可以让系统随机抽取。',
                }[kind],
                {
                  bazi: 'Enter your birth date and time to see the four pillars. You can continue even if you do not know the hour.',
                  ziwei:
                    'Enter your birth date and time to see the twelve palaces. Your chart and calculation conventions will appear here.',
                  iching:
                    'Focus on one question, then use a random cast or record six coin tosses. Your hexagram and changing lines will appear here.',
                  tarot:
                    'Think of a situation, then choose one or three cards. Pick them yourself or let Wenbu draw at random.',
                }[kind],
              )}
            </p>
            <a className="text-link" href={href(locale, 'methodology')}>
              {t('了解计算方法', 'How the tools work')}
              <ArrowUpRight size={14} />
            </a>
          </div>
        ) : (
          <div className="reading-arrival">
            <div className="step-label reading-complete">
              <span>02</span>
              {t('图景已展开', 'Your reading is ready')}
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setResult(null);
                  invalidateAnswer();
                  setNote('');
                  entryId.current = null;
                }}
                aria-label={t('重新开始', 'Start again')}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {exampleResult && (
              <p className="reading-example-note">
                {t(
                  '示例命盘 · 使用示例出生资料，帮助你熟悉界面。',
                  'Example chart · These sample birth details help you explore the interface.',
                )}
              </p>
            )}
            <ReadingView result={result} locale={locale} />
            {!exampleResult && (
              <div className="reading-agent-continuation">
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || aiBusy}
                  onClick={continueInAgent}
                >
                  {t('带着这份结果继续聊', 'Discuss this result')} <ArrowRight size={16} />
                </button>
                <p className="form-note">
                  {t(
                    '把当前结果留存并带入新对话，不会重新抽取。发送消息后才开始 AI 解读。',
                    'Keep this result and bring it into a new conversation, without another draw. AI interpretation starts when you send a message.',
                  )}
                </p>
                {handoffError && (
                  <p className="error-message" role="alert">
                    {handoffError}
                  </p>
                )}
              </div>
            )}
            <FeedbackTrigger
              locale={locale}
              tool={kind}
              category="reading"
              operation={operation.current}
              excerpt={readingExcerpt(result, question, locale)}
            />
            <div className="reading-actions" data-saved={saved}>
              {saveControls()}
              <button className="text-button" type="button" onClick={() => setExportOpen(!exportOpen)}>
                <Download size={15} />
                {t('导出给 Agent', 'Export for an agent')}
              </button>
            </div>
            <p className="reading-saved-note" role="status">
              {saved &&
                t(
                  saveState === 'cloud'
                    ? '已保存到账号，可在其他设备继续。'
                    : saveState === 'pending'
                      ? '已在此浏览器留存，正在等待云端确认。'
                      : saveState === 'error'
                        ? '云端保存未完成。本机副本仍保留，请在账号中重试。'
                        : '已保存在此浏览器，可继续保存到账号。',
                  saveState === 'cloud'
                    ? 'Saved to your account. Continue on another device.'
                    : saveState === 'pending'
                      ? 'Retained here. Waiting for cloud confirmation.'
                      : saveState === 'error'
                        ? 'Cloud save did not finish. Your browser copy is retained; retry in your account.'
                        : 'Saved in this browser. You can also save it to your account.',
                )}
            </p>
            {exportOpen && (
              <div className="export-panel">
                <h3>{t('选择要交给 Agent 的上下文', 'Choose what your agent receives')}</h3>
                <p>
                  {t(
                    '导出包含命盘或牌面、当前问题和你填写的背景。只有你发送文件后，外部 Agent 才能读取。',
                    'The export includes the chart or cards, your current question and selected context. An external agent receives it only when you send the file.',
                  )}
                </p>
                {(kind === 'bazi' || kind === 'ziwei') && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={includeBirth}
                      onChange={(e) => setIncludeBirth(e.target.checked)}
                    />
                    {t('同时包含原始出生资料', 'Also include original birth details')}
                  </label>
                )}
                <pre>{JSON.stringify(agentContext(result, question, context, includeBirth), null, 2)}</pre>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    downloadJson(agentContext(result, question, context, includeBirth), 'wenbu-context.json')
                  }
                >
                  {t('下载 JSON 上下文', 'Download context JSON')}
                  <Download size={15} />
                </button>
              </div>
            )}
            <section className="interpretation">
              <div className="step-label">
                <span>03</span>
                {t('带着你的问题，继续探索', 'Bring your question into the picture')}
              </div>
              <h2>{t('让图景，贴近你的当下。', 'Make it personal. Make it useful.')}</h2>
              <label className="field">
                {t('你想探索的问题', 'Your question')}
                <textarea
                  rows={2}
                  value={question}
                  onChange={(e) => changeQuestion(e.target.value)}
                  maxLength={600}
                  placeholder={t('我该如何看待最近的变化？', 'How might I reflect on the changes around me?')}
                />
              </label>
              <details className="context-details">
                <summary>
                  {t('补充你希望使用的背景（可选）', 'Add context you choose to share (optional)')}
                </summary>
                <label className="field">
                  <span>
                    {t(
                      '只有你主动填写的内容才会被使用。',
                      'Only the information you enter here will be used.',
                    )}
                  </span>
                  <textarea
                    rows={3}
                    value={context}
                    onChange={(e) => changeContext(e.target.value)}
                    maxLength={1600}
                    placeholder={t(
                      '例如：正在适应新的团队，希望更好地表达自己的想法。',
                      'For example: I am settling into a new team and want to express my ideas more clearly.',
                    )}
                  />
                </label>
              </details>
              <label className="check-field consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  {t(
                    '将本次排盘、问题和选填背景发送给 AI 服务，生成解读。',
                    'Send this chart, question and selected context to the AI service for a reading.',
                  )}
                </span>
              </label>
              <button
                className="button primary"
                type="button"
                onClick={() => void ask()}
                aria-describedby="reading-request-hint"
                disabled={aiBusy || !consent || question.trim().length < 2}
              >
                {aiBusy ? (
                  <>
                    <LoaderCircle className="spin" size={17} />
                    {t('正在整理你的解读…', 'Considering your reading…')}
                  </>
                ) : (
                  <>
                    <Feather size={17} />
                    {t('获取免费解读', 'Get a free reading')}
                  </>
                )}
              </button>
              <p className="reading-request-hint" id="reading-request-hint" aria-live="polite">
                {aiBusy
                  ? t('正在结合图景与问题整理，请稍候。', 'Bringing your question and reading together.')
                  : question.trim().length < 2
                    ? t(
                        '先写下想探索的问题，再确认分享，即可开始解读。',
                        'Add your question, then confirm sharing to begin.',
                      )
                    : !consent
                      ? t('确认上方的分享选项，即可开始解读。', 'Confirm the sharing option above to begin.')
                      : t('准备好了，点击即可开始。', 'Ready when you are.')}
              </p>
              <p className="form-note">
                {t(
                  '访客或账号每日 5 次解读，登录会合并当天用量；另受共享网络和全站额度限制。工具与保存仍可使用。',
                  'Five AI readings per guest or account daily. Signing in carries over trial usage. Network and site limits also apply; tools and saving remain available.',
                )}
              </p>
              {aiError && (
                <p role="alert" className="error-message">
                  {aiError}
                </p>
              )}
              {answer && (
                <article className="ai-reading" aria-live="polite">
                  <span className="eyebrow">{t('AI 生成的象征性解读', 'AI-GENERATED REFLECTION')}</span>
                  <h2>{answer.title}</h2>
                  <p className="reading-summary">{answer.summary}</p>
                  {answer.observations.map((o, i) => (
                    <div className="observation" key={i}>
                      <span>0{i + 1}</span>
                      <div>
                        <h3>{o.basis}</h3>
                        <p>{o.reflection}</p>
                      </div>
                    </div>
                  ))}
                  <h3>{t('可以试着做的事', 'Small actions to try')}</h3>
                  <ul>
                    {answer.nextSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <blockquote>{answer.question}</blockquote>
                  <FeedbackTrigger
                    locale={locale}
                    tool={kind}
                    category="reading"
                    operation={interpretation.current}
                    excerpt={answerExcerpt(answer, question)}
                  />
                  <p className="form-note">
                    {t('Wenbu AI 解读', 'Wenbu AI reading')} ·{' '}
                    {t(`今日剩余 ${remaining} 次`, `Today: ${remaining} requests left`)}
                  </p>
                  <label className="field">
                    {t('留一句话给以后的自己', 'A note for your future self')}
                    <textarea
                      rows={2}
                      maxLength={1200}
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setSaved(false);
                      }}
                    />
                  </label>
                  <div className="reading-actions">{saveControls()}</div>
                </article>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
