import FeedbackTrigger from './FeedbackTrigger';
import { toolDetail } from '../lib/agent-outcome';
import { openFeedback } from '../lib/feedback-contract';
import { analyticsHeaders, track } from '../lib/analytics';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Compass,
  Download,
  History,
  Menu,
  MessageSquare,
  PanelRight,
  Plus,
  Search,
  Square,
  Trash2,
  X,
  LoaderCircle,
  Bookmark,
  Pause,
  Play,
} from 'lucide-react';
import type { Locale } from '../lib/schema';
import { choose, href } from '../lib/i18n';
import { downloadJson, readJournal, writeJournal, type Entry } from '../lib/journal';
import {
  consumeSse,
  type AgentSession,
  type AgentEvent,
  type AgentArtifact,
  type AgentSource,
  type AgentBirth,
  type AgentMessage,
} from '../lib/agent-protocol';
import {
  artifactMarkdown,
  contextHistory,
  hasLaterReport,
  downloadMarkdown,
  newMessage,
  newSession,
  persistSessions,
  readingReference,
  restoreSessions,
  sessionArtifacts,
  updateMessage,
} from '../lib/agent-session';
import AgentMarkdown from './AgentMarkdown';
import AgentReport from './AgentReport';
import AgentTrace from './AgentTrace';
import InstrumentGlyph, { ReadingDeskIllustration, type InstrumentKind } from './InstrumentGlyph';
import AgentRitual, { useAgentMotion } from './AgentRitual';
import ReadingView from './ReadingView';
import { tarotArt } from '../data/tarot-art';
import { isolatedTrialSession } from '../lib/reading-conversation';
import { readReportVisual } from '../lib/agent-report';
import { prepareAgentSubmission, quickTrialChoice, type ConversationChoice } from '../lib/agent-guidance';
import { shouldSendMessage } from '../lib/agent-keyboard';
import { useClientReady } from '../lib/use-client-ready';
import { UserFacingError, uiErrorMessage } from '../lib/ui-error';
import AgentOnboarding from './AgentOnboarding';
import AgentConversationGuide from './AgentConversationGuide';
import '../styles/agent.css';
import '../styles/agent-motion.css';
import '../styles/agent-visuals.css';
import '../styles/agent-guidance.css';
import '../styles/agent-entry.css';
import AgentExample from './AgentExample';
import AgentBirthFields from './AgentBirthFields';
import AgentAnswerText from './AgentAnswerText';
import { isCompletedAnswer, sessionDeliverables, sessionSavePreview } from '../lib/agent-deliverables';
import { guideText, withoutBirthMessage } from '../lib/agent-guidance';
import {
  initializeAccount,
  accountSnapshot,
  accountInstance,
  openAccount,
  prepareCloudRun,
  endCloudRun,
  acknowledgeCloudSession,
  AccountClientError,
} from '../lib/account-client';
import CloudSaveStatus from './CloudSaveStatus';
import AccountSavePrompt from './AccountSavePrompt';
import { accountError } from './AccountPanel';

class ChartBoundary extends Component<{ children: ReactNode; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="agent-notice">{this.props.fallback}</p> : this.props.children;
  }
}
const defaultBirth: AgentBirth = {
  date: '',
  time: '',
  timezone: 'Asia/Shanghai',
  dayBoundary: 'midnight',
  solarTime: false,
};

export default function AgentWorkspace({ locale }: { locale: Locale }) {
  const interactive = useClientReady();
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const submissionFocus = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const motion = useAgentMotion();
  const [currentTurn, setCurrentTurn] = useState<string[]>([]);
  const [arrivingArtifacts, setArrivingArtifacts] = useState<string[]>([]);
  const reducedMotionRef = useRef(motion.reduced);
  reducedMotionRef.current = motion.reduced;
  const [remaining, setRemaining] = useState<number>();
  const [sidebar, setSidebar] = useState(false);
  const [mobilePane, setMobilePane] = useState<'chat' | 'results'>('chat');
  const previousPane = useRef(mobilePane);
  const showResults = useRef<HTMLButtonElement>(null);
  const backToConversation = useRef<HTMLButtonElement>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const exampleDialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<'results' | 'sources'>('results');
  const [selectedArtifact, setSelectedArtifact] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [birthKind, setBirthKind] = useState<'bazi' | 'ziwei'>('bazi');
  const [resumeAfterContext, setResumeAfterContext] = useState(false);
  const [contextDraft, setContextDraft] = useState<AgentSession['context']>({
    note: '',
    useBirth: false,
    journalIds: [],
  });
  const [journals, setJournals] = useState<Entry[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const panelScroll = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [atLatest, setAtLatest] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusAfterContext = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const sessionRef = useRef(sessions);
  const loadedOwner = useRef<string | undefined>(undefined);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const pending = useRef<{
    controller: AbortController;
    sessionId: string;
    messageId: string;
    generationId: string;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = sessions.find((s) => s.id === activeId);
  const artifacts = active ? sessionArtifacts(active) : [];
  const deliverables = active ? sessionDeliverables(active) : [];
  const sourceMap = new Map<string, AgentSource>();
  for (const message of active?.messages ?? [])
    for (const source of message.sources) sourceMap.set(source.id, source);
  const sources = [...sourceMap.values()];
  const artifact =
    deliverables.find((a) => a.id === selectedArtifact) ?? deliverables[deliverables.length - 1];
  useEffect(() => {
    if (panelScroll.current) panelScroll.current.scrollTop = 0;
  }, [artifact?.id, panel, activeId]);
  const birth = contextDraft.birth ?? defaultBirth;
  const contextCount =
    (active?.context.useBirth ? 1 : 0) +
    (active?.context.journalIds.length ?? 0) +
    (active?.context.note.trim() ? 1 : 0);

  function replaceSessions(next: AgentSession[]) {
    sessionRef.current = next;
    setSessions(next);
  }
  function mutateSession(id: string, change: (session: AgentSession) => AgentSession) {
    replaceSessions(sessionRef.current.map((s) => (s.id === id ? change(s) : s)));
  }
  function patchMessage(sessionId: string, messageId: string, change: (m: AgentMessage) => AgentMessage) {
    mutateSession(sessionId, (s) => ({
      ...s,
      updatedAt: new Date().toISOString(),
      messages: s.messages.map((m) => (m.id === messageId ? change(m) : m)),
    }));
  }
  useEffect(() => {
    let mounted = true;
    const load = (event?: Event) => {
      if (!mounted || pending.current) return;
      loadedOwner.current = accountSnapshot().user?.id || 'guest';
      const saved = restoreSessions();
      const initial = saved.length ? saved : [newSession(locale)];
      replaceSessions(initial);
      const preferred = (event as CustomEvent<{ kind?: string; id?: string }> | undefined)?.detail;
      const requested = !event ? new URLSearchParams(window.location.search).get('session') : null;
      const selected = preferred?.kind === 'session' ? preferred.id : requested || activeIdRef.current;
      setActiveId(initial.some((s) => s.id === selected) ? selected! : initial[0].id);
      setJournals(readJournal());
      setLoaded(true);
    };
    const changing = () => {
      pending.current?.controller.abort();
      pending.current = null;
      setBusy(false);
      setLoaded(false);
      sessionRef.current = [];
      loadedOwner.current = undefined;
      setSessions([]);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    void initializeAccount().then(() => load());
    window.addEventListener('wenbu:account-changing', changing);
    window.addEventListener('wenbu:account-changed', load);
    window.addEventListener('wenbu:records-changed', load);
    const flush = () => {
      if (loadedOwner.current !== (accountSnapshot().user?.id || 'guest')) return;
      try {
        persistSessions(sessionRef.current);
      } catch {
        /* Page is leaving; the visible saving state was handled while active. */
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      mounted = false;
      window.removeEventListener('wenbu:account-changing', changing);
      window.removeEventListener('wenbu:account-changed', load);
      window.removeEventListener('wenbu:records-changed', load);
      pending.current?.controller.abort();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, [locale]);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => {
        try {
          persistSessions(sessionRef.current);
          setStorageError(false);
        } catch {
          setStorageError(true);
        }
      },
      busy ? 180 : 0,
    );
  }, [sessions, loaded, busy]);
  useEffect(() => {
    if (scroll.current && (!active?.messages.length || stickToBottom.current))
      scroll.current.scrollTop = active?.messages.length ? scroll.current.scrollHeight : 0;
  }, [active?.messages, busy]);
  useEffect(() => {
    if (previousPane.current === mobilePane) return;
    previousPane.current = mobilePane;
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    (mobilePane === 'results' ? backToConversation : showResults).current?.focus();
  }, [mobilePane]);
  useEffect(() => {
    setArrivingArtifacts([]);
  }, [motion.reduced]);
  useEffect(() => {
    if (!arrivingArtifacts.length) return;
    // Presentation lifetime only. Result delivery never waits for CSS events.
    const timer = setTimeout(() => setArrivingArtifacts([]), 1000);
    return () => clearTimeout(timer);
  }, [arrivingArtifacts]);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = Math.min(170, Math.max(58, textarea.current.scrollHeight)) + 'px';
  }, [draft]);
  useEffect(() => {
    if (exampleOpen) exampleDialog.current?.showModal();
    else exampleDialog.current?.close();
  }, [exampleOpen]);
  function closeExample() {
    // Close the top-layer dialog before handing off to another dialog or the composer.
    exampleDialog.current?.close();
    setExampleOpen(false);
  }
  function startFromExample(kind: 'tarot' | 'research') {
    closeExample();
    setMobilePane('chat');
    if (kind === 'tarot') void send(quickTrialChoice(locale));
    else openContext(true, 'bazi');
  }
  function focusComposer() {
    setMobilePane('chat');
    requestAnimationFrame(() => textarea.current?.focus());
  }
  useEffect(() => {
    if (contextOpen) dialog.current?.showModal();
    else {
      dialog.current?.close();
      // The modal makes the conversation inert until close(), so restore shortcut focus now.
      const submitted =
        submissionFocus.current &&
        scroll.current?.querySelector<HTMLElement>(`[data-message-id="${submissionFocus.current}"]`);
      if (submitted) {
        submissionFocus.current = null;
        submitted.focus({ preventScroll: true });
      }
      if (focusAfterContext.current) {
        focusAfterContext.current = false;
        textarea.current?.focus();
      }
    }
  }, [contextOpen]);

  useEffect(() => {
    if (!sidebar) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [
        ...(sidebarRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])',
        ) ?? []),
      ].filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebar(false);
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || !sidebarRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !sidebarRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [sidebar]);

  function stop() {
    const running = pending.current;
    if (!running) return;
    track('agent_stopped', {
      tool: 'agent',
      status: 'cancelled',
      operation: running.messageId,
      conversation: running.sessionId,
    });
    pending.current = null;
    running.controller.abort();
    patchMessage(running.sessionId, running.messageId, (m) => ({
      ...m,
      status: 'stopped',
      tools: m.tools.map((tool) => (tool.status === 'running' ? { ...tool, status: 'stopped' } : tool)),
    }));
    setBusy(false);
  }
  function selectSession(id: string) {
    stop();
    setCurrentTurn([]);
    setArrivingArtifacts([]);
    setActiveId(id);
    setSelectedArtifact('');
    setDraft('');
    setSidebar(false);
    setMobilePane('chat');
    setNotice('');
    stickToBottom.current = true;
  }
  function createSession() {
    stop();
    const next = newSession(locale);
    replaceSessions([next, ...sessionRef.current]);
    selectSession(next.id);
  }
  function removeSession(id: string) {
    if (deleteId !== id) {
      setDeleteId(id);
      return;
    }
    if (pending.current?.sessionId === id) stop();
    const rest = sessionRef.current.filter((s) => s.id !== id);
    if (!rest.length) rest.push(newSession(locale));
    replaceSessions(rest);
    if (activeId === id) selectSession(rest[0].id);
    setDeleteId('');
  }
  function openContext(resume = false, kind: 'bazi' | 'ziwei' = 'bazi') {
    setBirthKind(kind);
    track('context_opened', { tool: 'agent', action: 'context' });
    if (!active) return;
    setResumeAfterContext(resume);
    setContextDraft({
      ...active.context,
      useBirth: resume || active.context.useBirth,
      birth: active.context.birth ? { ...active.context.birth } : { ...defaultBirth },
      journalIds: [...active.context.journalIds],
    });
    setJournals(readJournal());
    setContextOpen(true);
  }
  function patchBirth(change: Partial<AgentBirth>) {
    setContextDraft((c) => ({
      ...c,
      birth: {
        ...(c.birth ?? defaultBirth),
        ...change,
        ...(change.time === null ? { solarTime: false, longitude: undefined } : {}),
      },
    }));
  }
  function openArtifact(id: string) {
    track('artifact_opened', {
      tool: 'agent',
      conversation: activeId,
      operation: active?.messages.find((m) => m.artifacts.some((a) => a.id === id) || `answer:${m.id}` === id)
        ?.id,
    });
    setArrivingArtifacts([]);
    setSelectedArtifact(id);
    setPanel('results');
    setMobilePane('results');
  }

  async function send(choice?: ConversationChoice) {
    const current = sessionRef.current.find((s) => s.id === activeId);
    if (!loaded || !current || pending.current) return;
    const submission = prepareAgentSubmission(draft, choice);
    if (!submission) {
      if ((choice?.text ?? draft).trim().length > 3000)
        setNotice(
          t(
            '消息超过 3000 字，请精简后发送。',
            'This message exceeds 3,000 characters. Shorten it before sending.',
          ),
        );
      return;
    }
    const session = choice?.freshContext ? isolatedTrialSession(current, locale) : current;
    if (session !== current) {
      replaceSessions([session, ...sessionRef.current]);
      setActiveId(session.id);
      setSelectedArtifact('');
    }
    const mode = submission.mode ?? session.mode;
    if (session.messages.length >= 160) {
      setNotice(
        t(
          '这段探索已很长，请导出后开启新对话。',
          'This conversation is long. Export it and start a new one.',
        ),
      );
      return;
    }
    if (session.context.useBirth && !session.context.birth?.date) {
      openContext();
      return;
    }
    setNotice('');
    setDraft(submission.draft);
    const user = newMessage('user', submission.text);
    if (choice) submissionFocus.current = user.id;
    const assistant = newMessage('assistant', '');
    const correlation = { operation: assistant.id, conversation: session.id };
    track('agent_started', {
      ...correlation,
      tool: 'agent',
      mode,
      action: submission.action,
    });
    if (choice?.action === 'clarification' || choice?.action === 'followup')
      track('suggestion_selected', { tool: 'agent', action: choice.action, ...correlation });
    setBusy(true);
    setMobilePane('chat');
    stickToBottom.current = true;
    setCurrentTurn([user.id, assistant.id]);
    const controller = new AbortController();
    const generationId = crypto.randomUUID();
    pending.current = { controller, sessionId: session.id, messageId: assistant.id, generationId };
    const isCurrent = () => pending.current?.generationId === generationId && !controller.signal.aborted;
    const history = contextHistory(session.messages);
    const savedReadings = sessionArtifacts(session)
      .filter((a) => a.type === 'chart')
      .map((a) => a.input);
    const selectedJournals = readJournal().filter((j) => session.context.journalIds.includes(j.id));
    const readings = [...savedReadings, ...selectedJournals.map((j) => readingReference(j.result))].slice(-6);
    const contextNote = [
      session.context.note,
      ...selectedJournals.map(
        (j) =>
          `${t('我选择的手记', 'Selected journal')}: ${j.question}\n${j.note}\n${j.answer?.summary ?? ''}`,
      ),
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 5000);
    mutateSession(session.id, (s) => ({
      ...s,
      mode,
      title: s.messages.length ? s.title : submission.text.slice(0, 30),
      updatedAt: new Date().toISOString(),
      messages: [...s.messages, user, assistant],
    }));
    let terminal = false;
    let cloudRevision: number | undefined;
    try {
      const savedSession = sessionRef.current.find((s) => s.id === session.id)!;
      const cloudHeaders = await prepareCloudRun(savedSession);
      if (!isCurrent()) return;
      const response = await fetch('/api/v1/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...analyticsHeaders(correlation),
          ...cloudHeaders,
          'X-Wenbu-Request-Id': assistant.id,
          ...(accountInstance() ? { 'X-Wenbu-Instance': accountInstance()! } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: submission.text,
          history,
          locale,
          mode,
          consent: true,
          context: {
            note: contextNote,
            ...(session.context.useBirth ? { birth: session.context.birth } : {}),
            readings,
            reports: sessionArtifacts(session)
              .filter((a) => a.type === 'report')
              .slice(-2)
              .map(({ title, summary, sections, questions, visual }) => ({
                title,
                summary,
                sections,
                questions,
                visual: readReportVisual(visual),
              })),
            sourceIds: [...new Set(session.messages.flatMap((m) => m.sources.map((s) => s.id)))].slice(-12),
          },
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string; code?: string } };
        throw new UserFacingError(accountError(data.error?.code || '', locale === 'zh'));
      }
      if (!response.body) throw new Error('No response stream');
      await consumeSse(
        response.body,
        (data) => {
          if (!isCurrent()) return;
          const event = JSON.parse(data) as AgentEvent;
          if (event.type === 'cloud') {
            if (event.receipt) mutateSession(session.id, (s) => ({ ...s, receipt: event.receipt }));
            cloudRevision = event.revision;
            if (event.status === 'pending')
              setNotice(accountError(event.code || 'connection_failed', locale === 'zh'));
            return;
          }
          if (event.type === 'start') setRemaining(event.remaining);
          if (event.type === 'done' && event.status === 'complete') setSelectedArtifact('');
          if (event.type === 'done' || event.type === 'error') {
            terminal = true;
            track('agent_received', {
              ...correlation,
              tool: 'agent',
              mode,
              status: event.type === 'done' ? event.status : 'error',
            });
          }
          if (event.type === 'artifact') {
            setSelectedArtifact(event.artifact.id);
            setPanel('results');
            if (!reducedMotionRef.current)
              setArrivingArtifacts((ids) => [...ids, event.artifact.id].slice(-12));
          }
          patchMessage(session.id, assistant.id, (m) => updateMessage(m, event));
        },
        controller.signal,
      );
      if (!terminal && isCurrent())
        throw new UserFacingError(
          t(
            '连接在完成前中断，已收到的结果仍保留。',
            'The connection ended before completion. Received results are retained.',
          ),
        );
    } catch (error) {
      if (isCurrent()) track('client_error', { tool: 'agent', ...correlation, status: 'error' });
      if (isCurrent())
        patchMessage(session.id, assistant.id, (m) =>
          updateMessage(m, {
            type: 'error',
            code: 'client_error',
            message:
              error instanceof AccountClientError
                ? accountError(error.code, locale === 'zh')
                : uiErrorMessage(
                    error,
                    t(
                      '连接在完成前中断，已收到的结果仍保留。请检查网络后继续。',
                      'The connection ended before completion. Received results are retained; check your connection and continue.',
                    ),
                  ),
          }),
        );
    } finally {
      endCloudRun(session.id);
      if (cloudRevision && isCurrent())
        acknowledgeCloudSession(
          session.id,
          cloudRevision,
          sessionRef.current.find((s) => s.id === session.id),
        );
      if (pending.current?.generationId === generationId) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function saveChart(item: AgentArtifact) {
    if (item.type !== 'chart' || !active) return;
    try {
      const entries = readJournal();
      const id = 'agent-' + item.id;
      const report = [...artifacts].reverse().find((a) => a.type === 'report');
      writeJournal([
        {
          id,
          createdAt: item.createdAt,
          kind: item.reading.kind,
          result: item.reading,
          question: active.messages.find((m) => m.role === 'user')?.text ?? '',
          note: report?.type === 'report' ? report.summary : '',
          provenance: 'Wenbu Agent',
        },
        ...entries.filter((e) => e.id !== id),
      ]);
      track('journal_saved', { tool: item.reading.kind, action: 'save' });
      setNotice(t('已存入我的手记。', 'Saved to your journal.'));
    } catch {
      setStorageError(true);
    }
  }
  return (
    <div
      className={`agent-workspace ${sidebar ? 'sidebar-open' : ''} mobile-${mobilePane}`}
      data-motion={motion.reduced ? 'quiet' : 'on'}
    >
      {sidebar && (
        <button
          className="agent-sidebar-backdrop"
          aria-label={t('关闭会话列表', 'Close conversations')}
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        role={sidebar ? 'dialog' : undefined}
        aria-modal={sidebar ? true : undefined}
        className="agent-sidebar"
        aria-label={t('会话列表', 'Conversations')}
      >
        <div className="agent-sidebar-heading">
          <span className="eyebrow">YOUR EXPLORATIONS</span>
          <button
            className="agent-icon-button mobile-only"
            aria-label={t('关闭会话列表', 'Close conversations')}
            onClick={() => setSidebar(false)}
          >
            <X size={17} />
          </button>
        </div>
        <button className="agent-new" onClick={createSession} disabled={!loaded}>
          <Plus size={17} />
          {t('开始新的探索', 'New exploration')}
        </button>
        <label className="agent-session-search">
          <Search size={14} />
          <input
            aria-label={t('搜索会话', 'Search conversations')}
            placeholder={t('找一段对话', 'Find a conversation')}
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
          />
        </label>
        <div className="agent-session-list">
          {sessions
            .filter((s) => s.title.toLowerCase().includes(sessionSearch.toLowerCase()))
            .map((s) => (
              <div key={s.id} className={`agent-session-row ${s.id === activeId ? 'is-active' : ''}`}>
                <button
                  onClick={() => selectSession(s.id)}
                  aria-current={s.id === activeId ? 'page' : undefined}
                >
                  <MessageSquare size={14} />
                  <span>{s.title}</span>
                </button>
                <button
                  className={`agent-delete ${deleteId === s.id ? 'confirm-delete' : ''}`}
                  aria-label={
                    deleteId === s.id
                      ? t('确认删除此对话', 'Confirm delete conversation')
                      : t('删除此对话', 'Delete conversation')
                  }
                  title={t('删除此对话', 'Delete conversation')}
                  onClick={() => removeSession(s.id)}
                >
                  {deleteId === s.id ? <Check size={13} /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          {!sessions.length && (
            <p className="agent-quiet">{t('你的探索会留在这里。', 'Your explorations will live here.')}</p>
          )}
        </div>
        <div className="agent-sidebar-bottom">
          <span className="eyebrow">THE INSTRUMENTS</span>
          <div className="agent-instruments">
            {[
              ['bazi', '八字', 'BaZi'],
              ['iching', '易经', 'I Ching'],
              ['tarot', '塔罗', 'Tarot'],
              ['ziwei', '紫微', 'Zi Wei'],
            ].map(([p, zh, en]) => (
              <a key={p} href={href(locale, p)}>
                <InstrumentGlyph kind={p as InstrumentKind} size={26} />
                {t(zh, en)}
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
          <a className="agent-sidebar-library" href={href(locale, 'learn')}>
            <BookOpen size={14} />
            {t('翻阅知识手册', 'Browse the library')}
            <ArrowUpRight size={12} />
          </a>
          <CloudSaveStatus
            locale={locale}
            intent={active?.messages.length ? { kind: 'session', content: active } : undefined}
          />
        </div>
      </aside>
      <section
        className="agent-conversation"
        tabIndex={-1}
        data-account-return-focus
        aria-label={t('命理 Agent 对话', 'Wenbu Agent conversation')}
      >
        <div className="agent-chat-toolbar">
          <button
            className="agent-icon-button mobile-only"
            aria-label={t('打开会话列表', 'Open conversations')}
            onClick={() => setSidebar(true)}
          >
            <Menu size={19} />
          </button>
          <div className="agent-conversation-name">
            <span className="agent-small-seal">问</span>
            <span>{active?.messages.length ? active.title : t('命理 Agent', 'Wenbu Agent')}</span>
            <span className="agent-beta">{t('研习室', 'STUDIO')}</span>
          </div>
          <div className="agent-toolbar-actions">
            <button
              className="agent-icon-button"
              aria-label={t('反馈', 'Feedback')}
              title={t('反馈', 'Feedback')}
              onClick={() => openFeedback({ tool: 'agent', conversation: activeId })}
            >
              <MessageSquare size={16} />
            </button>
            <button
              className="agent-motion-toggle"
              aria-label={
                motion.systemReduced
                  ? t('系统已开启减少动效', 'Reduced motion is enabled by your system')
                  : motion.reduced
                    ? t('开启动效', 'Enable motion')
                    : t('暂停动效', 'Pause motion')
              }
              title={
                motion.systemReduced
                  ? t('遵循系统的减少动态效果设置', 'Following your system motion preference')
                  : t('仅切换动效，不影响生成', 'Change motion without interrupting the response')
              }
              aria-pressed={!motion.reduced}
              disabled={!motion.ready || motion.systemReduced}
              onClick={() => {
                setArrivingArtifacts([]);
                motion.toggle();
              }}
            >
              {motion.reduced ? <Play size={12} /> : <Pause size={12} />}
              <span>{t('动效', 'Motion')}</span>
            </button>
            <button
              className="agent-icon-button"
              aria-label={t('导出完整会话（含已分享资料）', 'Export conversation including shared context')}
              title={t('导出完整会话（含已分享资料）', 'Export conversation including shared context')}
              disabled={!active?.messages.length}
              onClick={() =>
                active &&
                downloadJson(
                  { version: 1, exportedAt: new Date().toISOString(), session: active },
                  'wenbu-conversation.json',
                )
              }
            >
              <Download size={16} />
            </button>
            <button
              ref={showResults}
              className="agent-icon-button mobile-only"
              aria-label={t('查看探索结果', 'Show results')}
              aria-controls="agent-results-pane"
              aria-expanded={mobilePane === 'results'}
              onClick={() => setMobilePane('results')}
            >
              <PanelRight size={18} />
              {deliverables.length > 0 && <span className="agent-count">{deliverables.length}</span>}
            </button>
          </div>
        </div>
        {storageError && (
          <div className="agent-storage-error" role="alert">
            {t(
              '浏览器保存失败，新内容暂未存下。请先导出会话，再清理不需要的记录。',
              'Browser saving failed. Export this conversation before removing older records.',
            )}
            <button onClick={() => active && downloadJson(active, 'wenbu-conversation.json')}>
              {t('导出', 'Export')}
            </button>
          </div>
        )}
        {notice && (
          <div className="agent-notice" role="status">
            <span key={notice}>{notice}</span>
            <button
              className="agent-icon-button"
              aria-label={t('关闭提示', 'Dismiss')}
              onClick={() => setNotice('')}
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div
          className="agent-chat-scroll"
          ref={scroll}
          tabIndex={-1}
          aria-label={t('对话内容', 'Conversation messages')}
          onScroll={() => {
            if (scroll.current) {
              stickToBottom.current =
                scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 110;
              setAtLatest(stickToBottom.current);
            }
          }}
        >
          {!active?.messages.length ? (
            <>
              {!!active?.context.journalIds.length && (
                <section className="agent-handoff-note" aria-label={t('带入的结果', 'Your existing reading')}>
                  <h1>{t('这份结果，接着聊。', 'Continue with your reading.')}</h1>
                  <p>
                    {journals
                      .filter((item) => active.context.journalIds.includes(item.id))
                      .map((item) =>
                        item.result.kind === 'tarot'
                          ? item.result.cards.map((card) => t(card.zh, card.en)).join(' · ')
                          : item.question || t('已生成的命盘或卦象', 'Your existing chart or hexagram'),
                      )
                      .join(' / ')}
                  </p>
                  <p>
                    {t(
                      '当前结果已选为资料。确认发送后，AI 才会开始解读。可在“我的资料”中查看或取消。',
                      'This result is selected as context. Send a message to begin the AI interpretation, or review and remove it in Context.',
                    )}
                  </p>
                  <button
                    className="text-button"
                    type="button"
                    disabled={!loaded || busy}
                    onClick={() =>
                      void send({
                        action: 'followup',
                        text: t(
                          '沿用我带入的结果和问题，先解释结构，再给一个可以尝试的小步骤，不重新抽取。',
                          'Use the reading and question I brought with me. Explain its structure, then suggest one small step to try. Do not draw again.',
                        ),
                      })
                    }
                  >
                    {t('解读这份结果', 'Interpret this reading')} <ArrowUpRight size={14} />
                  </button>
                  <button className="text-button" type="button" onClick={() => openContext()}>
                    {t('查看或调整资料', 'Review selected context')}
                  </button>
                </section>
              )}
              {!active?.context.journalIds.length && (
                <AgentOnboarding
                  key={activeId}
                  locale={locale}
                  disabled={!loaded || busy}
                  exampleReady={interactive}
                  hasDraft={!!draft.trim()}
                  onStart={(choice) => void send(choice)}
                  onBirth={() => openContext(true, 'bazi')}
                  onExample={() => {
                    setExampleOpen(true);
                    track('agent_example_opened', { tool: 'agent', action: 'example', mode: 'explore' });
                  }}
                />
              )}
            </>
          ) : (
            <div className="agent-message-list">
              <h1 className="sr-only">{t('命理 Agent', 'Wenbu Agent')}</h1>
              {active.messages.map((message, i) => (
                <article
                  key={message.id}
                  data-message-id={message.id}
                  tabIndex={message.role === 'user' ? -1 : undefined}
                  ref={(node) => {
                    if (node && submissionFocus.current === message.id && !dialog.current?.open) {
                      submissionFocus.current = null;
                      node.focus({ preventScroll: true });
                    }
                  }}
                  className={`agent-message role-${message.role} ${currentTurn.includes(message.id) ? 'is-current-turn' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className="agent-author">
                      <span className="agent-small-seal">问</span>
                      <strong>wenbu</strong>
                      <span>
                        {message.status === 'running'
                          ? t('正在探索', 'Exploring')
                          : t('与你一起思考', 'A shared exploration')}
                      </span>
                    </div>
                  )}
                  {message.role === 'assistant' &&
                    message.status !== 'waiting' &&
                    (message.status === 'running' || currentTurn.includes(message.id)) && (
                      <AgentRitual message={message} locale={locale} />
                    )}
                  {message.plan && (
                    <details className="agent-plan" open={message.status === 'running'}>
                      <summary>
                        <Compass size={14} />
                        {t('探索步骤', 'The approach')}
                        <span>
                          {message.plan.filter((p) => p.status === 'complete').length}/{message.plan.length}
                        </span>
                        <ChevronDown size={13} />
                      </summary>
                      <ol>
                        {message.plan.map((step, n) => (
                          <li key={n} className={step.status}>
                            {step.status === 'complete' ? (
                              <Check size={13} />
                            ) : step.status === 'active' ? (
                              <LoaderCircle
                                size={13}
                                className={message.status === 'running' ? 'spin' : ''}
                              />
                            ) : (
                              <Circle size={11} />
                            )}
                            <span>{step.title}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {message.tools.some(
                    (tool) =>
                      tool.name !== 'update_plan' && (tool.name !== 'ask_user' || tool.status !== 'complete'),
                  ) && (
                    <AgentTrace message={message} locale={locale}>
                      {message.tools
                        .filter((tool) => tool.name !== 'update_plan')
                        .map((tool) => {
                          const laterReport = hasLaterReport(message, tool.id);
                          return (
                            <details
                              key={tool.id}
                              className={`agent-tool-event ${laterReport ? 'earlier-attempt' : tool.status}`}
                            >
                              <summary>
                                {laterReport ? (
                                  <History size={13} />
                                ) : tool.status === 'running' ? (
                                  <LoaderCircle size={13} className="spin" />
                                ) : tool.status === 'complete' ? (
                                  <Check size={13} />
                                ) : (
                                  <Circle size={12} />
                                )}
                                <span>
                                  {laterReport ? t('报告整理 · 已修复', 'Report · recovered') : tool.label}
                                </span>
                                <small>
                                  {laterReport
                                    ? t('报告已生成', 'Report saved')
                                    : tool.status === 'running'
                                      ? t('进行中', 'Running')
                                      : tool.status === 'error'
                                        ? t('本次未成功', 'Attempt failed')
                                        : tool.status === 'stopped'
                                          ? t('已停止', 'Stopped')
                                          : t('完成', 'Done')}
                                </small>
                                <ChevronRight size={12} />
                              </summary>
                              {laterReport && (
                                <p className="agent-attempt-outcome">
                                  {t(
                                    '最初的稿件未通过检查。之后已修正问题并保存报告；这里保留修复前的过程记录。',
                                    'The original draft did not pass its checks. A corrected report was saved; this entry preserves the earlier attempt.',
                                  )}
                                </p>
                              )}
                              {!laterReport && <p>{toolDetail(tool, locale)}</p>}
                            </details>
                          );
                        })}
                    </AgentTrace>
                  )}
                  {message.text && (
                    <AgentAnswerText
                      message={message}
                      conversation={active.id}
                      locale={locale}
                      allowedUrls={sources.map((source) => source.url)}
                    />
                  )}
                  {isCompletedAnswer(message) && !message.artifacts.length && (
                    <div className="agent-artifact-links">
                      <button onClick={() => openArtifact(`answer:${message.id}`)}>
                        <InstrumentGlyph kind="report" size={38} />
                        <span>
                          <small>
                            {t('保留原文，无需重新生成', 'The original answer, ready to revisit')}
                          </small>
                          <strong>{t('查看这份答复', 'Open this answer')}</strong>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  )}
                  {message.role === 'assistant' &&
                    message.status === 'complete' &&
                    !message.question &&
                    message.text && (
                      <FeedbackTrigger
                        locale={locale}
                        tool="agent"
                        category="reading"
                        operation={message.id}
                        conversation={active?.id}
                        excerpt={
                          (active?.messages
                            .slice(0, active.messages.indexOf(message))
                            .reverse()
                            .find((m) => m.role === 'user')?.text ?? '') +
                          '\n\n' +
                          message.text
                        }
                      />
                    )}
                  {!!message.artifacts.length && (
                    <div className="agent-artifact-links">
                      {message.artifacts.map((a) => (
                        <button
                          key={a.id}
                          className={arrivingArtifacts.includes(a.id) ? 'is-arriving' : ''}
                          onClick={() => openArtifact(a.id)}
                        >
                          {a.type === 'chart' &&
                          a.reading.kind === 'tarot' &&
                          tarotArt[a.reading.cards[0]?.id] ? (
                            <img
                              className="agent-result-thumbnail"
                              src={tarotArt[a.reading.cards[0].id].replace('.webp', '-small.webp')}
                              alt=""
                              width="40"
                              height="64"
                              loading="lazy"
                            />
                          ) : (
                            <InstrumentGlyph
                              kind={a.type === 'chart' ? a.reading.kind : 'report'}
                              size={38}
                            />
                          )}
                          <span>
                            <small>
                              {a.type === 'chart'
                                ? isCompletedAnswer(message)
                                  ? t('牌面或命盘 · 本次解读', 'Reading and interpretation')
                                  : t('可查看的原始结果', 'Original result')
                                : t('已整理的研究札记', 'Research note')}
                            </small>
                            <strong>
                              {a.type === 'chart' &&
                              a.reading.kind === 'tarot' &&
                              a.reading.cards.length === 1
                                ? t(a.reading.cards[0].zh, a.reading.cards[0].en) +
                                  ' · ' +
                                  t(
                                    a.reading.cards[0].reversed ? '逆位' : '正位',
                                    a.reading.cards[0].reversed ? 'Reversed' : 'Upright',
                                  )
                                : a.title}
                            </strong>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    </div>
                  )}
                  {!!message.sources.length && (
                    <button
                      className="agent-source-count"
                      onClick={() => {
                        setArrivingArtifacts([]);
                        setPanel('sources');
                        setMobilePane('results');
                      }}
                    >
                      <BookOpen size={13} />
                      {message.sources.length}{' '}
                      {t('份已读取资料', message.sources.length === 1 ? 'source read' : 'sources read')}
                      <ArrowUpRight size={11} />
                    </button>
                  )}
                  {i === active.messages.length - 1 && (
                    <AgentConversationGuide
                      key={message.id}
                      message={message}
                      hasDraft={!!draft.trim()}
                      locale={locale}
                      disabled={busy}
                      onReply={(choice) => void send(choice)}
                      onCustom={() => {
                        setMobilePane('chat');
                        textarea.current?.focus();
                      }}
                      onBirth={() => openContext(true, message.question?.birthKind ?? 'bazi')}
                    />
                  )}
                  {i === active.messages.length - 1 &&
                    !busy &&
                    message.status === 'complete' &&
                    !message.question &&
                    (message.artifacts.length > 0 || isCompletedAnswer(message)) && (
                      <AccountSavePrompt
                        key={active.id}
                        locale={locale}
                        intent={{
                          kind: 'session',
                          content: active,
                          label: sessionSavePreview(active, locale),
                        }}
                      />
                    )}
                  {message.status === 'error' && (
                    <div className="agent-turn-error" role="alert">
                      <p>{message.error}</p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void send({
                            text: t('沿用已有结果继续', 'Continue with existing results'),
                            action: 'followup',
                          })
                        }
                      >
                        {t('沿用已有结果继续', 'Continue with existing results')} →
                      </button>
                    </div>
                  )}
                  {message.status === 'stopped' && (
                    <p className="agent-stopped">
                      {t('已停止 · 已产生的内容保留在此', 'Stopped · completed work is retained')}
                    </p>
                  )}
                  {message.status === 'limited' && (
                    <p className="agent-stopped">
                      {t(
                        '本回合已达到执行上限，可针对已有结果继续。',
                        'This turn reached a limit. Continue with the existing results.',
                      )}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="agent-composer-area">
          {!atLatest && !!active?.messages.length && (
            <button
              type="button"
              className="agent-jump-latest"
              onClick={() => {
                stickToBottom.current = true;
                if (scroll.current) {
                  scroll.current.scrollTop = scroll.current.scrollHeight;
                  scroll.current.focus({ preventScroll: true });
                }
                setAtLatest(true);
              }}
            >
              <ChevronDown size={14} />
              {t('回到最新消息', 'Jump to latest')}
            </button>
          )}
          <form
            className={`agent-composer ${busy ? 'is-working' : ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void send();
            }}
          >
            <textarea
              ref={textarea}
              value={draft}
              maxLength={3000}
              rows={2}
              disabled={!loaded}
              aria-label={t('向命理 Agent 提问', 'Ask Wenbu Agent')}
              aria-describedby="agent-input-help"
              placeholder={
                active?.messages.length
                  ? t('补充你的情况，或继续追问……', 'Add context, or ask a follow-up…')
                  : t('写下你的问题，不必想好怎么问……', 'Write what’s on your mind. A few words are enough…')
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  shouldSendMessage(
                    {
                      key: e.key,
                      shiftKey: e.shiftKey,
                      ctrlKey: e.ctrlKey,
                      metaKey: e.metaKey,
                      isComposing: e.nativeEvent.isComposing,
                      // Safari can report the legacy IME confirmation code without isComposing.
                      keyCode: (e.nativeEvent as { keyCode?: number }).keyCode,
                    },
                    window.matchMedia('(pointer: coarse)').matches,
                  )
                ) {
                  e.preventDefault();
                  if (!busy) void send();
                }
              }}
            />
            {!active?.messages.length && (
              <p className="agent-mode-help">
                {active?.mode === 'research'
                  ? t(
                      '研习：查阅资料与出处，整理有依据的札记。',
                      'Research: read sources and build a referenced note.',
                    )
                  : t(
                      '对话：先理清问题，需要时再使用排盘与抽取工具。',
                      'Explore: think through a question, with reading tools when useful.',
                    )}
              </p>
            )}
            <div className="agent-composer-controls">
              <div className="agent-mode-picker" role="group" aria-label={t('探索方式', 'Exploration mode')}>
                <button
                  type="button"
                  className={active?.mode === 'explore' ? 'selected' : ''}
                  aria-pressed={active?.mode === 'explore'}
                  disabled={!loaded}
                  title={t(
                    '围绕你的问题对话，按需使用排盘与抽取工具',
                    'Talk through your question and use reading tools when needed',
                  )}
                  onClick={() => active && mutateSession(active.id, (s) => ({ ...s, mode: 'explore' }))}
                >
                  <Compass size={13} />
                  {t('对话', 'Explore')}
                </button>
                <button
                  type="button"
                  className={active?.mode === 'research' ? 'selected' : ''}
                  aria-pressed={active?.mode === 'research'}
                  disabled={!loaded}
                  title={t(
                    '查阅资料、核对出处，整理研究札记',
                    'Read sources and prepare a referenced research note',
                  )}
                  onClick={() => active && mutateSession(active.id, (s) => ({ ...s, mode: 'research' }))}
                >
                  <BookOpen size={13} />
                  {t('研习', 'Research')}
                </button>
              </div>
              <button
                type="button"
                className={`agent-context-trigger ${contextCount ? 'has-context' : ''}`}
                onClick={() => openContext()}
              >
                <Plus size={14} />
                {t('我的资料', 'Context')}
                {contextCount > 0 && <span>{contextCount}</span>}
              </button>
              <span className="agent-provider">Wenbu</span>
              {busy ? (
                <button
                  className="agent-send stop"
                  type="button"
                  aria-label={t('停止生成', 'Stop generating')}
                  onClick={stop}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="agent-send"
                  type="submit"
                  disabled={!loaded || !draft.trim()}
                  aria-label={t('发送消息', 'Send message')}
                >
                  <ArrowUp size={19} />
                </button>
              )}
            </div>
          </form>
          <p id="agent-input-help" className="agent-input-help">
            <span className="keyboard-fine">
              {t('Enter 发送 · Shift + Enter 换行', 'Enter to send · Shift + Enter for a new line')}
            </span>
            <span className="keyboard-coarse">
              {t('回车换行 · 点箭头发送', 'Return for a new line · Tap the arrow to send')}
            </span>
          </p>
          <div className="agent-composer-foot">
            <span>
              {t(
                '发送即同意由 AI 处理本次对话与所选资料。',
                'Sending allows AI processing of this conversation and selected context.',
              )}
            </span>
            <span>
              {remaining === undefined
                ? t('每日 12 回合', '12 turns / day')
                : t(
                    `今日余 ${remaining} 回合`,
                    `${remaining} ${remaining === 1 ? 'turn' : 'turns'} left today`,
                  )}
            </span>
          </div>
        </div>
      </section>
      <aside
        id="agent-results-pane"
        className="agent-result-pane"
        aria-label={t('探索结果与资料', 'Results and sources')}
      >
        <div className="agent-panel-toolbar">
          <button
            ref={backToConversation}
            className="agent-icon-button mobile-only"
            aria-label={t('返回对话', 'Back to conversation')}
            onClick={() => setMobilePane('chat')}
          >
            <ChevronRight className="rotate-180" size={19} />
          </button>
          <div className="agent-panel-tabs" role="group" aria-label={t('结果面板内容', 'Result panel view')}>
            <button
              className={panel === 'results' ? 'selected' : ''}
              aria-pressed={panel === 'results'}
              onClick={() => {
                setArrivingArtifacts([]);
                setPanel('results');
              }}
            >
              {t('探索结果', 'Results')}
              <span>{deliverables.length || '—'}</span>
            </button>
            <button
              className={panel === 'sources' ? 'selected' : ''}
              aria-pressed={panel === 'sources'}
              onClick={() => {
                setArrivingArtifacts([]);
                setPanel('sources');
              }}
            >
              {t('参考资料', 'Sources')}
              <span>{sources.length || '—'}</span>
            </button>
          </div>
        </div>
        <div className="agent-panel-scroll" ref={panelScroll}>
          {panel === 'sources' ? (
            sources.length ? (
              <div className="agent-sources">
                <span className="eyebrow">THE READING DESK</span>
                <h2>
                  {t('每一种说法，', 'Every perspective,')}
                  <br />
                  <em>{t('有迹可循。', 'a source to follow.')}</em>
                </h2>
                <p className="agent-quiet">
                  {t(
                    '站内说明与已读取的参考网页分别标注。网页读取为有限文本片段。',
                    'Original library notes and fetched reference excerpts are labeled separately.',
                  )}
                </p>
                {sources.map((source, index) => (
                  <div className="agent-source-card" key={source.id}>
                    <div className="agent-source-mark">
                      <InstrumentGlyph kind="library" size={40} />
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <span className="agent-source-type">
                        {source.kind === 'reference'
                          ? t('已读取网页片段', 'Web excerpt read')
                          : t('问卜原创资料', 'Wenbu library note')}
                      </span>
                      <a data-track="source" href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.title}
                        <ArrowUpRight size={14} />
                      </a>
                      <details className="source-excerpt">
                        <summary>
                          {t('阅读资料摘录', 'Read the excerpt')}
                          <ChevronDown size={12} />
                        </summary>
                        <p>{source.excerpt}</p>
                      </details>
                      <small>{new URL(source.url).hostname}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel locale={locale} kind="sources" />
            )
          ) : artifact ? (
            <div className="agent-artifact-view">
              {deliverables.length > 1 && (
                <label className="agent-artifact-select">
                  <History size={14} />
                  <select
                    aria-label={t('选择结果或报告版本', 'Choose result or report version')}
                    value={artifact.id}
                    onChange={(e) => {
                      setArrivingArtifacts([]);
                      setSelectedArtifact(e.target.value);
                    }}
                  >
                    {deliverables.map((a, i) => (
                      <option key={a.id} value={a.id}>
                        {String(i + 1).padStart(2, '0')} · {a.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
              )}
              <div
                key={artifact.id}
                className={`agent-artifact-content ${arrivingArtifacts.includes(artifact.id) ? 'is-arriving' : ''}`}
                data-kind={artifact.type === 'chart' ? artifact.reading.kind : 'report'}
              >
                <div className="agent-artifact-heading">
                  <span className="agent-result-seal" aria-hidden="true">
                    {artifact.type === 'chart' ? '象' : '录'}
                  </span>
                  <span className="eyebrow">
                    {artifact.type === 'chart' ? 'CALCULATED, THEN CONSIDERED' : 'A WENBU FIELD NOTE'}
                  </span>
                  <h2>{artifact.title}</h2>
                  <p>
                    {artifact.type === 'chart'
                      ? t(
                          '由排盘工具生成 · 可复核原始结构',
                          'Generated by the calculation tools · inspect the structure',
                        )
                      : artifact.type === 'answer'
                        ? t(
                            '本次对话的原文答复，与聊天记录保持一致。',
                            'The original answer from this conversation, unchanged.',
                          )
                        : t(
                            '本次对话的整理，引用与适用范围见下方',
                            'A note from this conversation. Review the sources and limits below.',
                          )}
                  </p>
                </div>
                {artifact.type === 'chart' ? (
                  <div className="agent-chart">
                    <ChartBoundary
                      key={artifact.id}
                      fallback={t(
                        '这份本地结果无法显示，请重新排盘。',
                        'This saved result cannot be displayed. Calculate it again.',
                      )}
                    >
                      <ReadingView key={artifact.id} result={artifact.reading} locale={locale} />
                    </ChartBoundary>
                    {artifact.answer && (
                      <section
                        className="agent-prose agent-outcome-answer"
                        aria-label={t('本次解读', 'Your interpretation')}
                      >
                        <span className="eyebrow">
                          {t('本次解读 · 对话原文', 'YOUR INTERPRETATION · ORIGINAL ANSWER')}
                        </span>
                        <AgentMarkdown
                          locale={locale}
                          text={artifact.answer.text}
                          allowedUrls={sources.map((source) => source.url)}
                        />
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            focusComposer();
                          }}
                        >
                          {t('带着这个结果继续聊', 'Continue with this result')} <ArrowUpRight size={14} />
                        </button>
                      </section>
                    )}
                  </div>
                ) : artifact.type === 'answer' ? (
                  <div className="agent-prose agent-answer-note">
                    <AgentMarkdown
                      locale={locale}
                      text={artifact.text}
                      allowedUrls={sources.map((source) => source.url)}
                    />
                  </div>
                ) : (
                  <AgentReport
                    key={artifact.id}
                    report={artifact}
                    sources={sources}
                    locale={locale}
                    busy={busy}
                    onQuestion={(text) => void send({ text, action: 'followup' })}
                  />
                )}
                <div className="agent-artifact-actions">
                  <button
                    onClick={() => {
                      downloadMarkdown(
                        artifact.type === 'answer'
                          ? artifact.text
                          : artifactMarkdown(artifact, sources) +
                              (artifact.type === 'chart' && artifact.answer
                                ? '\n\n' + artifact.answer.text
                                : ''),
                      );
                      track('report_exported', { tool: 'agent', action: 'export', conversation: activeId });
                    }}
                  >
                    <Download size={14} />
                    {t('导出', 'Export')}
                  </button>
                  {artifact.type === 'chart' && (
                    <button
                      onClick={() =>
                        artifact.answer && active
                          ? openAccount(
                              { kind: 'session', content: active, label: sessionSavePreview(active, locale) },
                              'account-save',
                            )
                          : saveChart(artifact)
                      }
                    >
                      <Bookmark size={14} />
                      {artifact.answer
                        ? t('保存对话与结果', 'Save conversation and result')
                        : t('存入手记', 'Save to journal')}
                    </button>
                  )}
                  <span>{t('文化探索 · 保留判断', 'Cultural reflection')}</span>
                </div>
              </div>
            </div>
          ) : (
            <AgentExample
              locale={locale}
              ready={interactive}
              disabled={!loaded || busy}
              onPractice={startFromExample}
              onStart={focusComposer}
            />
          )}
        </div>
        <div className="agent-panel-foot">
          <span>WENBU RESEARCH STUDIO</span>
          <a href={href(locale, 'methodology')}>{t('计算与依据', 'Our methods')} ↗</a>
        </div>
      </aside>
      <dialog
        ref={exampleDialog}
        className="agent-example-dialog"
        aria-labelledby="agent-example-title"
        onCancel={() => setExampleOpen(false)}
        onClose={() => setExampleOpen(false)}
        onClick={(event) => {
          if (event.target === exampleDialog.current) closeExample();
        }}
      >
        <div className="agent-example-dialog-heading">
          <h2 id="agent-example-title">{t('完整示例', 'Complete example')}</h2>
          <button
            className="agent-icon-button"
            type="button"
            aria-label={t('关闭示例', 'Close example')}
            onClick={closeExample}
          >
            <X size={20} />
          </button>
        </div>
        {exampleOpen && (
          <div className="agent-example-dialog-body">
            <AgentExample
              locale={locale}
              ready={interactive}
              disabled={!loaded || busy}
              onPractice={startFromExample}
              onStart={() => {
                closeExample();
                focusComposer();
              }}
            />
          </div>
        )}
      </dialog>
      <dialog
        className="agent-context-dialog"
        ref={dialog}
        onCancel={() => setContextOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setContextOpen(false);
        }}
        aria-labelledby="agent-context-title"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (active) mutateSession(active.id, (s) => ({ ...s, context: contextDraft }));
            focusAfterContext.current = !resumeAfterContext || busy;
            setContextOpen(false);
            if (resumeAfterContext && !busy) {
              void send({
                text: contextDraft.useBirth
                  ? t('出生资料已补充，请继续。', 'I’ve added my birth details. Please continue.')
                  : guideText(withoutBirthMessage, locale),
                action: 'clarification',
              });
            } else {
              setNotice(
                t(
                  '资料已更新，下一条消息会使用你选择的内容。',
                  'Context updated. Your next message will use your selection.',
                ),
              );
            }
          }}
        >
          <div className="agent-dialog-heading">
            <div>
              <span className="eyebrow">CONTEXT, ON YOUR TERMS</span>
              <h2 id="agent-context-title">{t('带上与你有关的资料。', 'Bring the context that matters.')}</h2>
            </div>
            <button
              type="button"
              className="agent-icon-button"
              aria-label={t('关闭资料窗口', 'Close context')}
              onClick={() => setContextOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
          <p className="agent-quiet">
            {t(
              '只把你选择的内容用于本次会话。资料会随消息交给 AI 服务处理；记录是否同步到云端，取决于你的账号保存设置。',
              'Only your selection is used in this conversation and processed by the AI service with your message. Cloud storage follows your account’s history setting.',
            )}
          </p>
          <label className="agent-context-toggle">
            <input
              type="checkbox"
              checked={contextDraft.useBirth}
              onChange={(e) => setContextDraft((c) => ({ ...c, useBirth: e.target.checked }))}
            />
            <span>
              <strong>{t('使用出生资料', 'Use birth information')}</strong>
              <small>{t('八字与紫微需要的计算信息', 'For BaZi and Zi Wei calculations')}</small>
            </span>
          </label>
          {contextDraft.useBirth && (
            <AgentBirthFields
              locale={locale}
              birth={birth}
              kind={birthKind}
              onKind={setBirthKind}
              onChange={patchBirth}
            />
          )}
          <label className="agent-context-note">
            {t('你希望 Agent 知道的背景', 'What would you like the agent to know?')}
            <textarea
              maxLength={2500}
              rows={3}
              value={contextDraft.note}
              onChange={(e) => setContextDraft((c) => ({ ...c, note: e.target.value }))}
              placeholder={t(
                '例如：我正在比较两种工作安排，希望先看清自己重视什么。',
                'For example: I am considering two work arrangements and want to understand my priorities.',
              )}
            />
          </label>
          <div className="agent-journal-picker">
            <div>
              <strong>{t('从我的手记中选择', 'Choose from your journal')}</strong>
              <small>
                {t(
                  '含原始结果、已保存的出生资料及笔记',
                  'Includes the original result, saved birth details and notes',
                )}
              </small>
            </div>
            {journals.length ? (
              journals.slice(0, 20).map((j) => (
                <label key={j.id}>
                  <input
                    type="checkbox"
                    checked={contextDraft.journalIds.includes(j.id)}
                    disabled={!contextDraft.journalIds.includes(j.id) && contextDraft.journalIds.length >= 3}
                    onChange={(e) =>
                      setContextDraft((c) => ({
                        ...c,
                        journalIds: e.target.checked
                          ? [...c.journalIds, j.id]
                          : c.journalIds.filter((id) => id !== j.id),
                      }))
                    }
                  />
                  <span>
                    {j.question || t('未命名的手记', 'Untitled entry')}
                    <small>
                      {j.kind.toUpperCase()} · {j.createdAt.slice(0, 10)}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p>
                {t(
                  '还没有手记。可以先使用任一工具并保存结果。',
                  'No journal entries yet. Save a result from any of the original tools.',
                )}{' '}
                <a href={href(locale, 'journal')}>{t('我的手记', 'My journal')} ↗</a>
              </p>
            )}
          </div>
          <p className="agent-quiet">
            {t(
              '关闭选项不会移除本会话已经分享的内容。想从空白资料开始，请新建对话。',
              'Deselecting does not remove information already shared in this conversation. Start a new conversation for a fresh context.',
            )}
          </p>
          <details className="agent-context-preview">
            <summary>
              {t('查看将使用的资料', 'Preview the selected context')}
              <ChevronDown size={13} />
            </summary>
            <pre>
              {JSON.stringify(
                {
                  birth: contextDraft.useBirth ? contextDraft.birth : undefined,
                  note: contextDraft.note,
                  journals: journals
                    .filter((j) => contextDraft.journalIds.includes(j.id))
                    .map((j) => ({ question: j.question, note: j.note, result: j.result })),
                },
                null,
                2,
              )}
            </pre>
            <p>
              {t(
                '还会保留本会话最近 16 条消息、6 份命盘结果和 2 版报告。记录的保存位置由账号设置决定；导出会话包含已分享的资料。',
                'The agent also receives up to 16 recent messages, 6 recent charts and 2 report versions. History storage follows your account setting. Conversation exports include shared details.',
              )}
            </p>
          </details>
          <div className="agent-dialog-actions">
            <button type="button" onClick={() => setContextOpen(false)}>
              {t('取消', 'Cancel')}
            </button>
            <button className="primary" type="submit">
              {resumeAfterContext && !busy
                ? contextDraft.useBirth
                  ? t('发送资料并继续', 'Send context and continue')
                  : t('不提供出生资料，先看通用示例', 'Skip birth details and see a general example')
                : t('使用所选资料', 'Use selected context')}
              <Check size={15} />
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
function EmptyPanel({ locale, kind }: { locale: Locale; kind: 'results' | 'sources' }) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  return (
    <div className="agent-panel-empty">
      <span className="eyebrow">{kind === 'results' ? 'YOUR FIELD NOTES' : 'A TRACEABLE PERSPECTIVE'}</span>
      <ReadingDeskIllustration />
      <h2>
        {kind === 'results'
          ? t('让探索，留下脉络。', 'Give your exploration a shape.')
          : t('循着依据，读得更深。', 'A source for deeper reading.')}
      </h2>
      <p>
        {kind === 'results'
          ? t(
              '命盘、卦象与研究札记会在这里展开。你可以边聊边看，随时回到之前的结果。',
              'Charts, casts and research notes appear here. Keep talking while you inspect the results, and return to earlier versions.',
            )
          : t(
              'Agent 读取过的手册与参考网页会保留在这里，便于核对与继续阅读。',
              'Library notes and reference pages read by the agent will be collected here, ready to check and revisit.',
            )}
      </p>
      <div className="agent-empty-legend">
        <span>{t('命盘', 'CHARTS')}</span>
        <span>{t('资料', 'SOURCES')}</span>
        <span>{t('札记', 'NOTES')}</span>
      </div>
    </div>
  );
}
