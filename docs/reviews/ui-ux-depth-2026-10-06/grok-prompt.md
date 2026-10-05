Read-only review. No tools or subagents. Review this supplied Wenbu patch for concrete defects in focus, keyboard/IME behavior, journal owner boundaries and success/error state, feedback receipts and retries, accessibility and responsive layout. Do not change files. Return prioritized findings or no blocking defects.
diff --git a/src/components/AgentReport.tsx b/src/components/AgentReport.tsx
index 4976fb2..68ca6ae 100644
--- a/src/components/AgentReport.tsx
+++ b/src/components/AgentReport.tsx
@@ -145,11 +145,11 @@ export default function AgentReport({
           <div className="report-overview-counts">
             <span>
               <b>{report.sections.length}</b>
-              {zh ? '个章节' : 'sections'}
+              {zh ? '个章节' : report.sections.length === 1 ? 'section' : 'sections'}
             </span>
             <span>
               <b>{sourceCount}</b>
-              {zh ? '份引用资料' : 'cited sources'}
+              {zh ? '份引用资料' : sourceCount === 1 ? 'cited source' : 'cited sources'}
             </span>
             {visual && (
               <span>
diff --git a/src/components/AgentRitual.tsx b/src/components/AgentRitual.tsx
index c4b7229..319a044 100644
--- a/src/components/AgentRitual.tsx
+++ b/src/components/AgentRitual.tsx
@@ -201,14 +201,16 @@ export default function AgentRitual({ message, locale }: { message: AgentMessage
           <div className="agent-ritual-facts">
             {message.sources.length > 0 && (
               <span key={`sources-${message.sources.length}`}>
-                {zh ? `已读 ${message.sources.length} 份资料` : `${message.sources.length} sources read`}
+                {zh
+                  ? `已读 ${message.sources.length} 份资料`
+                  : `${message.sources.length} ${message.sources.length === 1 ? 'source' : 'sources'} read`}
               </span>
             )}
             {message.artifacts.length > 0 && (
               <span key={`results-${message.artifacts.length}`}>
                 {zh
                   ? `已生成 ${message.artifacts.length} 份结果`
-                  : `${message.artifacts.length} results received`}
+                  : `${message.artifacts.length} ${message.artifacts.length === 1 ? 'result' : 'results'} received`}
               </span>
             )}
           </div>
diff --git a/src/components/AgentWorkspace.tsx b/src/components/AgentWorkspace.tsx
index f0952c2..279a932 100644
--- a/src/components/AgentWorkspace.tsx
+++ b/src/components/AgentWorkspace.tsx
@@ -60,6 +60,7 @@ import AgentRitual, { useAgentMotion } from './AgentRitual';
 import ReadingView from './ReadingView';
 import { readReportVisual } from '../lib/agent-report';
 import { prepareAgentSubmission, type ConversationChoice } from '../lib/agent-guidance';
+import { shouldSendMessage } from '../lib/agent-keyboard';
 import AgentOnboarding from './AgentOnboarding';
 import AgentConversationGuide from './AgentConversationGuide';
 import '../styles/agent.css';
@@ -112,6 +113,9 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
   const [remaining, setRemaining] = useState<number>();
   const [sidebar, setSidebar] = useState(false);
   const [mobilePane, setMobilePane] = useState<'chat' | 'results'>('chat');
+  const previousPane = useRef(mobilePane);
+  const showResults = useRef<HTMLButtonElement>(null);
+  const backToConversation = useRef<HTMLButtonElement>(null);
   const [panel, setPanel] = useState<'results' | 'sources'>('results');
   const [selectedArtifact, setSelectedArtifact] = useState('');
   const [sessionSearch, setSessionSearch] = useState('');
@@ -129,6 +133,7 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
   const textarea = useRef<HTMLTextAreaElement>(null);
   const scroll = useRef<HTMLDivElement>(null);
   const stickToBottom = useRef(true);
+  const [atLatest, setAtLatest] = useState(true);
   const dialog = useRef<HTMLDialogElement>(null);
   const focusAfterContext = useRef(false);
   const sidebarRef = useRef<HTMLElement>(null);
@@ -236,6 +241,12 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
     if (scroll.current && (!active?.messages.length || stickToBottom.current))
       scroll.current.scrollTop = active?.messages.length ? scroll.current.scrollHeight : 0;
   }, [active?.messages, busy]);
+  useEffect(() => {
+    if (previousPane.current === mobilePane) return;
+    previousPane.current = mobilePane;
+    if (!window.matchMedia('(max-width: 700px)').matches) return;
+    (mobilePane === 'results' ? backToConversation : showResults).current?.focus();
+  }, [mobilePane]);
   useEffect(() => {
     setArrivingArtifacts([]);
   }, [motion.reduced]);
@@ -770,8 +781,11 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
               <Download size={16} />
             </button>
             <button
+              ref={showResults}
               className="agent-icon-button mobile-only"
               aria-label={t('查看探索结果', 'Show results')}
+              aria-controls="agent-results-pane"
+              aria-expanded={mobilePane === 'results'}
               onClick={() => setMobilePane('results')}
             >
               <PanelRight size={18} />
@@ -805,10 +819,14 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
         <div
           className="agent-chat-scroll"
           ref={scroll}
+          tabIndex={-1}
+          aria-label={t('对话内容', 'Conversation messages')}
           onScroll={() => {
-            if (scroll.current)
+            if (scroll.current) {
               stickToBottom.current =
                 scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 110;
+              setAtLatest(stickToBottom.current);
+            }
           }}
         >
           {!active?.messages.length ? (
@@ -980,7 +998,7 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
                           <span>
                             <small>
                               {a.type === 'chart'
-                                ? t('可查看的原始结果', 'Verified result')
+                                ? t('可查看的原始结果', 'Original result')
                                 : t('已整理的研究札记', 'Research note')}
                             </small>
                             <strong>{a.title}</strong>
@@ -1000,7 +1018,8 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
                       }}
                     >
                       <BookOpen size={13} />
-                      {message.sources.length} {t('份已读取资料', 'sources read')}
+                      {message.sources.length}{' '}
+                      {t('份已读取资料', message.sources.length === 1 ? 'source read' : 'sources read')}
                       <ArrowUpRight size={11} />
                     </button>
                   )}
@@ -1066,6 +1085,23 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
           )}
         </div>
         <div className="agent-composer-area">
+          {!atLatest && !!active?.messages.length && (
+            <button
+              type="button"
+              className="agent-jump-latest"
+              onClick={() => {
+                stickToBottom.current = true;
+                if (scroll.current) {
+                  scroll.current.scrollTop = scroll.current.scrollHeight;
+                  scroll.current.focus({ preventScroll: true });
+                }
+                setAtLatest(true);
+              }}
+            >
+              <ChevronDown size={14} />
+              {t('回到最新消息', 'Jump to latest')}
+            </button>
+          )}
           <form
             className={`agent-composer ${busy ? 'is-working' : ''}`}
             onSubmit={(event) => {
@@ -1080,6 +1116,7 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
               rows={2}
               disabled={!loaded}
               aria-label={t('向命理 Agent 提问', 'Ask Wenbu Agent')}
+              aria-describedby="agent-input-help"
               placeholder={
                 active?.messages.length
                   ? t('补充你的情况，或继续追问……', 'Add context, or ask a follow-up…')
@@ -1087,17 +1124,31 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
               }
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => {
-                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
+                if (
+                  shouldSendMessage(
+                    {
+                      key: e.key,
+                      shiftKey: e.shiftKey,
+                      ctrlKey: e.ctrlKey,
+                      metaKey: e.metaKey,
+                      isComposing: e.nativeEvent.isComposing,
+                      keyCode: e.nativeEvent.keyCode,
+                    },
+                    window.matchMedia('(pointer: coarse)').matches,
+                  )
+                ) {
                   e.preventDefault();
                   if (!busy) void send();
                 }
               }}
             />
             <div className="agent-composer-controls">
-              <div className="agent-mode-picker" aria-label={t('探索方式', 'Exploration mode')}>
+              <div className="agent-mode-picker" role="group" aria-label={t('探索方式', 'Exploration mode')}>
                 <button
                   type="button"
                   className={active?.mode === 'explore' ? 'selected' : ''}
+                  aria-pressed={active?.mode === 'explore'}
+                  disabled={!loaded}
                   title={t(
                     '围绕你的问题对话，按需使用排盘与抽取工具',
                     'Talk through your question and use reading tools when needed',
@@ -1110,6 +1161,8 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
                 <button
                   type="button"
                   className={active?.mode === 'research' ? 'selected' : ''}
+                  aria-pressed={active?.mode === 'research'}
+                  disabled={!loaded}
                   title={t(
                     '查阅资料、核对出处，整理研究札记',
                     'Read sources and prepare a referenced research note',
@@ -1151,6 +1204,14 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
               )}
             </div>
           </form>
+          <p id="agent-input-help" className="agent-input-help">
+            <span className="keyboard-fine">
+              {t('Enter 发送 · Shift + Enter 换行', 'Enter to send · Shift + Enter for a new line')}
+            </span>
+            <span className="keyboard-coarse">
+              {t('回车换行 · 点箭头发送', 'Return for a new line · Tap the arrow to send')}
+            </span>
+          </p>
           <div className="agent-composer-foot">
             <span>
               {t(
@@ -1161,23 +1222,32 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
             <span>
               {remaining === undefined
                 ? t('每日 12 回合', '12 turns / day')
-                : t(`今日余 ${remaining} 回合`, `${remaining} turns left today`)}
+                : t(
+                    `今日余 ${remaining} 回合`,
+                    `${remaining} ${remaining === 1 ? 'turn' : 'turns'} left today`,
+                  )}
             </span>
           </div>
         </div>
       </section>
-      <aside className="agent-result-pane" aria-label={t('探索结果与资料', 'Results and sources')}>
+      <aside
+        id="agent-results-pane"
+        className="agent-result-pane"
+        aria-label={t('探索结果与资料', 'Results and sources')}
+      >
         <div className="agent-panel-toolbar">
           <button
+            ref={backToConversation}
             className="agent-icon-button mobile-only"
             aria-label={t('返回对话', 'Back to conversation')}
             onClick={() => setMobilePane('chat')}
           >
             <ChevronRight className="rotate-180" size={19} />
           </button>
-          <div className="agent-panel-tabs">
+          <div className="agent-panel-tabs" role="group" aria-label={t('结果面板内容', 'Result panel view')}>
             <button
               className={panel === 'results' ? 'selected' : ''}
+              aria-pressed={panel === 'results'}
               onClick={() => {
                 setArrivingArtifacts([]);
                 setPanel('results');
@@ -1188,6 +1258,7 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
             </button>
             <button
               className={panel === 'sources' ? 'selected' : ''}
+              aria-pressed={panel === 'sources'}
               onClick={() => {
                 setArrivingArtifacts([]);
                 setPanel('sources');
@@ -1287,8 +1358,8 @@ export default function AgentWorkspace({ locale }: { locale: Locale }) {
                           'Generated by the calculation tools · inspect the structure',
                         )
                       : t(
-                          '基于所读资料与本次对话整理',
-                          'Prepared from the sources read and this conversation',
+                          '本次对话的整理，引用与适用范围见下方',
+                          'A note from this conversation. Review the sources and limits below.',
                         )}
                   </p>
                 </div>
diff --git a/src/components/FeedbackWidget.astro b/src/components/FeedbackWidget.astro
index a3790c9..f5999a7 100644
--- a/src/components/FeedbackWidget.astro
+++ b/src/components/FeedbackWidget.astro
@@ -6,21 +6,6 @@ const { locale } = Astro.props as { locale: Locale };
 const t = (zh: string, en: string) => choose(locale, zh, en);
 ---

-<button class="feedback-launch" data-feedback-open hidden type="button" aria-haspopup="dialog">
-  <svg
-    width="17"
-    height="17"
-    viewBox="0 0 24 24"
-    fill="none"
-    stroke="currentColor"
-    stroke-width="1.5"
-    aria-hidden="true"
-  >
-    <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3H20Z" />
-    <path d="M7 9h8M7 13h5" />
-  </svg>
-  {t('反馈', 'Feedback')}
-</button>
 <dialog id="feedback-dialog" class="feedback-dialog" aria-labelledby="feedback-title" data-locale={locale}>
   <button
     type="button"
@@ -40,7 +25,8 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
       )}
     </p>
     <form id="feedback-form">
-      <fieldset class="feedback-rating">
+      <p id="feedback-error" class="error-message" data-feedback-error role="alert" hidden></p>
+      <fieldset class="feedback-rating" aria-describedby="feedback-error">
         <legend>{t('这次体验如何？', 'How was this experience?')}</legend>
         {[
           ['helpful', '有帮助', 'Helpful', '↗'],
@@ -74,6 +60,7 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
         {t('留下一句话', 'Leave us a note')}
         <textarea
           name="message"
+          aria-describedby="feedback-error"
           rows="3"
           maxlength="3000"
           placeholder={t(
@@ -115,7 +102,6 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
         )}{' '}
         <a href={href(locale, 'privacy')}>{t('隐私说明', 'Privacy details')} ↗</a>
       </p>
-      <p class="error-message" data-feedback-error role="alert" hidden></p>
       <button class="button feedback-submit" type="submit">
         {t('发送反馈', 'Send feedback')} <span aria-hidden="true">↗</span>
       </button>
@@ -143,6 +129,7 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
   import { analyticsHeaders, track } from '../lib/analytics';
   import { safePage } from '../lib/analytics-contract';
   import { feedbackCategories, feedbackRatings, type FeedbackRequest } from '../lib/feedback-contract';
+  import { feedbackFailureMessage, feedbackReceipt, FeedbackDeliveryError } from '../lib/feedback-delivery';
   const dialog = document.querySelector<HTMLDialogElement>('#feedback-dialog')!;
   const form = dialog.querySelector<HTMLFormElement>('form')!;
   const zh = dialog.dataset.locale === 'zh';
@@ -166,6 +153,7 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
     id = crypto.randomUUID();
     form.reset();
     error.hidden = true;
+    field<HTMLTextAreaElement>('message').removeAttribute('aria-invalid');
     thanks.hidden = true;
     formView.hidden = false;
     field<HTMLSelectElement>('category').value = feedbackCategories.includes(value.category!)
@@ -207,6 +195,7 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
   form.addEventListener('input', () => {
     id = crypto.randomUUID();
     error.hidden = true;
+    field<HTMLTextAreaElement>('message').removeAttribute('aria-invalid');
   });
   share.addEventListener('change', () => {
     preview.hidden = !share.checked;
@@ -220,9 +209,12 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
     if (!String(data.get('message')).trim() && rating === 'none') {
       error.textContent = t('选一个评价，或留下一句话。', 'Choose a rating or leave a note.');
       error.hidden = false;
+      field<HTMLTextAreaElement>('message').setAttribute('aria-invalid', 'true');
+      field<HTMLTextAreaElement>('message').focus();
       return;
     }
     busy = true;
+    form.setAttribute('aria-busy', 'true');
     submit.disabled = true;
     submit.textContent = t('正在发送…', 'Sending…');
     error.hidden = true;
@@ -252,31 +244,19 @@ const t = (zh: string, en: string) => choose(locale, zh, en);
         body: JSON.stringify(body),
         signal: AbortSignal.timeout(20000),
       });
-      if (!response.ok)
-        throw new Error(
-          response.status === 429
-            ? t('提交得有些频繁，请一分钟后再试。', 'Please wait a minute before sending another note.')
-            : t(
-                '暂时没能保存，请稍后重试。内容还在这里。',
-                'We couldn’t save this yet. Your note is still here; please try again.',
-              ),
-        );
-      const receipt = await response.json();
-      dialog.querySelector<HTMLElement>('[data-feedback-receipt]')!.textContent = receipt.id;
+      if (!response.ok) throw new FeedbackDeliveryError(response.status);
+      const receipt = feedbackReceipt(await response.json(), id);
+      dialog.querySelector<HTMLElement>('[data-feedback-receipt]')!.textContent = receipt;
       formView.hidden = true;
       thanks.hidden = false;
       (thanks.querySelector('button') as HTMLButtonElement).focus();
     } catch (e) {
-      error.textContent =
-        e instanceof Error && e.name !== 'TimeoutError'
-          ? e.message
-          : t(
-              '连接超时，请重试。重复提交不会重复保存。',
-              'The connection timed out. You can retry without creating a duplicate.',
-            );
+      error.textContent = feedbackFailureMessage(e, zh ? 'zh' : 'en');
       error.hidden = false;
+      error.scrollIntoView({ block: 'nearest' });
     } finally {
       busy = false;
+      form.removeAttribute('aria-busy');
       submit.disabled = false;
       inputs.forEach((el) => (el.disabled = false));
       submit.textContent = t('发送反馈 ↗', 'Send feedback ↗');
diff --git a/src/components/Journal.tsx b/src/components/Journal.tsx
index 15c069d..81f4d87 100644
--- a/src/components/Journal.tsx
+++ b/src/components/Journal.tsx
@@ -1,5 +1,5 @@
 import { useEffect, useRef, useState } from 'react';
-import { Bookmark, Download, Trash2, ArrowUpRight, Search } from 'lucide-react';
+import { Bookmark, Download, Trash2, ArrowUpRight, Search, ArrowLeft } from 'lucide-react';
 import { readJournal, writeJournal, downloadJson, type Entry } from '../lib/journal';
 import { choose, href, toolInfo } from '../lib/i18n';
 import type { Locale } from '../lib/schema';
@@ -14,38 +14,57 @@ export default function Journal({ locale }: { locale: Locale }) {
   const [active, setActive] = useState<string | null>(null);
   const [query, setQuery] = useState('');
   const searchInput = useRef<HTMLInputElement>(null);
+  const detail = useRef<HTMLDivElement>(null);
+  const entryButtons = useRef(new Map<string, HTMLButtonElement>());
+  const focusDetail = useRef(false);
   const [removed, setRemoved] = useState<Entry | null>(null);
   const [error, setError] = useState('');
   useEffect(() => {
     let mounted = true;
-    const load = () => {
+    const load = (reset = false) => {
       if (mounted) {
-        setEntries(readJournal());
-        setActive(null);
-        setRemoved(null);
+        const next = readJournal();
+        setEntries(next);
+        setActive((id) => (!reset && next.some((entry) => entry.id === id) ? id : null));
+        if (reset) {
+          setRemoved(null);
+          setQuery('');
+          setError('');
+        }
         setReady(true);
       }
     };
-    void initializeAccount().then(load);
-    window.addEventListener('wenbu:account-changed', load);
-    window.addEventListener('wenbu:records-changed', load);
+    const accountChanged = () => load(true);
+    const recordsChanged = () => load();
+    void initializeAccount().then(() => load(true));
+    window.addEventListener('wenbu:account-changed', accountChanged);
+    window.addEventListener('wenbu:records-changed', recordsChanged);
     return () => {
       mounted = false;
-      window.removeEventListener('wenbu:account-changed', load);
-      window.removeEventListener('wenbu:records-changed', load);
+      window.removeEventListener('wenbu:account-changed', accountChanged);
+      window.removeEventListener('wenbu:records-changed', recordsChanged);
     };
   }, []);
+  useEffect(() => {
+    if (!active || !focusDetail.current) return;
+    focusDetail.current = false;
+    detail.current?.focus();
+  }, [active]);
   function update(list: Entry[]) {
     try {
       writeJournal(list);
       setEntries(list);
       setError('');
+      return true;
     } catch {
       setError(t('保存失败，请导出备份。', 'Storage failed. Please export a backup.'));
+      return false;
     }
   }
   const filtered = entries.filter((e) =>
-    `${e.question} ${e.note} ${e.answer?.title || ''}`.toLowerCase().includes(query.toLowerCase()),
+    `${e.question} ${e.note} ${e.answer?.title || ''} ${toolInfo[e.kind].zh} ${toolInfo[e.kind].en}`
+      .toLowerCase()
+      .includes(query.trim().toLowerCase()),
   );
   const current = entries.find((e) => e.id === active);
   return (
@@ -58,7 +77,7 @@ export default function Journal({ locale }: { locale: Locale }) {
             ref={searchInput}
             value={query}
             onChange={(e) => setQuery(e.target.value)}
-            placeholder={t('搜索问题或笔记', 'Search questions or notes')}
+            placeholder={t('搜索问题、笔记或工具', 'Search questions, notes or tools')}
             aria-label={t('搜索手记', 'Search journal')}
           />
         </label>
@@ -89,8 +108,7 @@ export default function Journal({ locale }: { locale: Locale }) {
           <button
             className="text-button"
             onClick={() => {
-              update([{ ...removed, id: crypto.randomUUID() }, ...entries]);
-              setRemoved(null);
+              if (update([{ ...removed, id: crypto.randomUUID() }, ...entries])) setRemoved(null);
             }}
           >
             {t('恢复为副本', 'Restore as a copy')}
@@ -109,17 +127,35 @@ export default function Journal({ locale }: { locale: Locale }) {
               'Save a reading and a note about how it felt. Your future self may notice something new.',
             )}
           </p>
-          <a className="button primary" href={href(locale, 'bazi')}>
-            {t('开始我的第一次探索', 'Begin a first reading')}
+          <a className="button primary" href={href(locale, 'agent')}>
+            {t('从一个问题开始', 'Start with a question')}
             <ArrowUpRight size={16} />
           </a>
+          <a className="text-link journal-tool-link" href={href(locale, 'learn/choose-a-tool')}>
+            {t('先了解四种工具', 'Explore the four tools')} ↗
+          </a>
         </div>
       ) : (
         <div className="journal-grid">
           <div className="journal-list">
             {filtered.map((e) => (
               <div className={`journal-entry ${active === e.id ? 'active' : ''}`} key={e.id}>
-                <button className="entry-open" onClick={() => setActive(e.id)}>
+                <button
+                  className="entry-open"
+                  aria-pressed={active === e.id}
+                  ref={(node) => {
+                    if (node) entryButtons.current.set(e.id, node);
+                    else entryButtons.current.delete(e.id);
+                  }}
+                  onClick={() => {
+                    const mobile = window.matchMedia('(max-width: 800px)').matches;
+                    if (active === e.id && mobile) detail.current?.focus();
+                    else {
+                      focusDetail.current = mobile;
+                      setActive(e.id);
+                    }
+                  }}
+                >
                   <span className="eyebrow">
                     {t(toolInfo[e.kind].zh, toolInfo[e.kind].en)} ·{' '}
                     {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
@@ -134,9 +170,10 @@ export default function Journal({ locale }: { locale: Locale }) {
                   className="icon-button"
                   aria-label={t('移除这条手记', 'Remove this entry')}
                   onClick={() => {
-                    update(entries.filter((x) => x.id !== e.id));
-                    setRemoved(e);
-                    if (active === e.id) setActive(null);
+                    if (update(entries.filter((x) => x.id !== e.id))) {
+                      setRemoved(e);
+                      if (active === e.id) setActive(null);
+                    }
                   }}
                 >
                   <Trash2 size={15} />
@@ -159,9 +196,21 @@ export default function Journal({ locale }: { locale: Locale }) {
               </div>
             )}
           </div>
-          <div className="journal-detail">
+          <div
+            className="journal-detail"
+            ref={detail}
+            tabIndex={-1}
+            aria-label={t('手记内容', 'Journal entry')}
+          >
             {current ? (
               <>
+                <button
+                  type="button"
+                  className="text-button journal-back"
+                  onClick={() => entryButtons.current.get(current.id)?.focus()}
+                >
+                  <ArrowLeft size={16} /> {t('返回手记列表', 'Back to entries')}
+                </button>
                 {current.question && (
                   <div className="reflection-callout">
                     <span>{t('当时的问题', 'YOUR ORIGINAL QUESTION')}</span>
diff --git a/src/components/ReadingView.tsx b/src/components/ReadingView.tsx
index c789027..241cd3b 100644
--- a/src/components/ReadingView.tsx
+++ b/src/components/ReadingView.tsx
@@ -35,7 +35,14 @@ export default function ReadingView({ result, locale }: { result: Reading; local
               </strong>
               <span className="pillar-pinyin">{p.pinyin ?? '—'}</span>
               <span className="pillar-element">
-                {p.value ? `${p.stemElement} · ${p.branchElement}` : t('不推定时柱', 'Not inferred')}
+                {p.value
+                  ? [p.stemElement, p.branchElement]
+                      .map((element) => {
+                        const label = result.elements.find((item) => item.zh === element);
+                        return locale === 'en' ? (label?.en ?? element) : element;
+                      })
+                      .join(' · ')
+                  : t('不推定时柱', 'Not inferred')}
               </span>
               <span className="pillar-hidden">
                 {t('藏干', 'Hidden')} {p.hidden?.join(' ') || '—'}
diff --git a/src/components/TarotCard.tsx b/src/components/TarotCard.tsx
index 7042272..4eb0c18 100644
--- a/src/components/TarotCard.tsx
+++ b/src/components/TarotCard.tsx
@@ -16,6 +16,7 @@ export default function TarotCard({
 }) {
   const dialog = useRef<HTMLDialogElement>(null);
   const [failed, setFailed] = useState(false);
+  const [fullFailed, setFullFailed] = useState(false);
   const [opened, setOpened] = useState(false);
   const name = locale === 'zh' ? card.zh : card.en;
   const orientation =
@@ -36,6 +37,7 @@ export default function TarotCard({
         className={`tarot-face illustrated ${card.reversed ? 'reversed' : ''}`}
         aria-label={locale === 'zh' ? `放大查看${name} · ${orientation}` : `Inspect ${name} · ${orientation}`}
         onClick={() => {
+          setFullFailed(false);
           setOpened(true);
           dialog.current?.showModal();
           track('card_inspected', { tool: 'tarot', action: 'inspect' });
@@ -79,15 +81,32 @@ export default function TarotCard({
           >
             <X size={20} />
           </button>
-          {opened && (
+          {opened && !fullFailed && src ? (
             <img
               className={card.reversed ? 'is-reversed' : undefined}
               src={src}
               alt={`${name} · ${orientation}`}
               width="600"
               height="900"
+              onError={() => setFullFailed(true)}
             />
-          )}
+          ) : opened ? (
+            <div className="tarot-art-retry" role="status">
+              <span className="card-unavailable">
+                {name}
+                <small>
+                  {locale === 'zh'
+                    ? '插画暂未载入，牌义仍可阅读。'
+                    : 'Artwork could not load. You can still read the card meaning.'}
+                </small>
+              </span>
+              {src && (
+                <button className="button secondary" type="button" onClick={() => setFullFailed(false)}>
+                  {locale === 'zh' ? '重新载入插画' : 'Retry artwork'}
+                </button>
+              )}
+            </div>
+          ) : null}
           <div className="tarot-lightbox-copy">
             <span className="eyebrow">
               WENBU · {card.arcana === 'major' ? 'MAJOR ARCANA' : card.suit.toUpperCase()}
diff --git a/src/components/TarotGallery.tsx b/src/components/TarotGallery.tsx
index 3648401..0bbe864 100644
--- a/src/components/TarotGallery.tsx
+++ b/src/components/TarotGallery.tsx
@@ -7,13 +7,14 @@ export default function TarotGallery({ locale }: { locale: Locale }) {
   const [suit, setSuit] = useState('all');
   const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
   const groups = [
-    ['all', '全部', 'All 78'],
+    ['all', '全部', 'All cards'],
     ['major', '大阿卡纳', 'Major arcana'],
     ['wands', '权杖', 'Wands'],
     ['cups', '圣杯', 'Cups'],
     ['swords', '宝剑', 'Swords'],
     ['pentacles', '星币', 'Pentacles'],
   ];
+  const cards = tarotDeck.filter((card) => suit === 'all' || card.suit === suit);
   return (
     <section className="tarot-gallery shell">
       <div className="gallery-heading">
@@ -37,24 +38,21 @@ export default function TarotGallery({ locale }: { locale: Locale }) {
           </button>
         ))}
       </div>
+      <p className="gallery-count" role="status" aria-live="polite" aria-atomic="true">
+        {t(`显示 ${cards.length} 张牌`, `Showing ${cards.length} cards`)}
+      </p>
       <div className="tarot-gallery-grid">
-        {tarotDeck
-          .filter((card) => suit === 'all' || card.suit === suit)
-          .map((card) => (
-            <article key={card.id}>
-              <TarotCard
-                card={{ ...card, reversed: false, position: 'reflection' }}
-                locale={locale}
-                preview
-              />
-              <h2>{t(card.zh, card.en)}</h2>
-              <p>{t(card.keywordsZh, card.keywordsEn)}</p>
-              <small>
-                {t('逆位：', 'Reversed: ')}
-                {t(card.reversedZh, card.reversedEn)}
-              </small>
-            </article>
-          ))}
+        {cards.map((card) => (
+          <article key={card.id}>
+            <TarotCard card={{ ...card, reversed: false, position: 'reflection' }} locale={locale} preview />
+            <h2>{t(card.zh, card.en)}</h2>
+            <p>{t(card.keywordsZh, card.keywordsEn)}</p>
+            <small>
+              {t('逆位：', 'Reversed: ')}
+              {t(card.reversedZh, card.reversedEn)}
+            </small>
+          </article>
+        ))}
       </div>
       <p className="gallery-note">
         {t(
diff --git a/src/components/ToolDesk.tsx b/src/components/ToolDesk.tsx
index 44cb536..972babb 100644
--- a/src/components/ToolDesk.tsx
+++ b/src/components/ToolDesk.tsx
@@ -733,7 +733,7 @@ export default function ToolDesk({ kind, locale }: { kind: ToolKind; locale: Loc
         </p>
         {!result ? (
           <div className="empty-reading">
-            <div className="empty-orbit">
+            <div className="empty-orbit" aria-hidden="true">
               <i />
               <span>
                 {kind === 'bazi' ? '命' : kind === 'iching' ? '易' : kind === 'tarot' ? '象' : '星'}
@@ -744,8 +744,21 @@ export default function ToolDesk({ kind, locale }: { kind: ToolKind; locale: Loc
             <h2>{t('答案之前，先看见自己。', 'Before an answer, a new perspective.')}</h2>
             <p>
               {t(
-                '填入信息，或让一次随机的相遇，成为思考的起点。',
-                'Enter your details, or let a chance encounter become a starting point for reflection.',
+                {
+                  bazi: '填写出生日期与时间，先看四柱的结构。记不清时辰，也可以继续。',
+                  ziwei: '填写出生信息，查看十二宫。选定时间约定后，原始星盘会显示在这里。',
+                  iching: '带着一个具体的问题，选自动起卦或记录六次掷币。卦象与动爻会显示在这里。',
+                  tarot: '想一个正在面对的问题，再选一张或三张牌。可以自己选牌，也可以让系统随机抽取。',
+                }[kind],
+                {
+                  bazi: 'Enter your birth date and time to see the four pillars. You can continue even if you do not know the hour.',
+                  ziwei:
+                    'Enter your birth details and choose the time conventions. Your twelve-palace chart will appear here.',
+                  iching:
+                    'Focus on one question, then use a random cast or record six coin tosses. Your hexagram and changing lines will appear here.',
+                  tarot:
+                    'Think of a situation, then choose one or three cards. Pick them yourself or let Wenbu draw at random.',
+                }[kind],
               )}
             </p>
             <a className="text-link" href={href(locale, 'methodology')}>
diff --git a/src/layouts/Layout.astro b/src/layouts/Layout.astro
index 3936e3a..ec09fd5 100644
--- a/src/layouts/Layout.astro
+++ b/src/layouts/Layout.astro
@@ -298,6 +298,11 @@ const schema = {
             <a href={href(locale, 'free')}>{t('免费使用说明', 'Free-use policy')}</a>
             <a href={href(locale, 'agents')}>MCP / CLI / Skills</a>
             <a href="https://github.com/wenbu-app/wenbu">{t('开源项目', 'Open source')} ↗</a>
+            {path !== 'insights' && path !== 'move' && (
+              <button class="feedback-launch" data-feedback-open hidden type="button" aria-haspopup="dialog">
+                {t('反馈与建议', 'Feedback & suggestions')} ↗
+              </button>
+            )}
           </div>
         </div>
       </div>
diff --git a/src/styles/account.css b/src/styles/account.css
index 3369021..245de6a 100644
--- a/src/styles/account.css
+++ b/src/styles/account.css
@@ -43,7 +43,7 @@
   top: 14px;
 }
 .account-seal {
-  color: #ad4f36;
+  color: var(--red);
   border: 1px solid #b66248;
   display: grid;
   place-items: center;
@@ -63,7 +63,7 @@
 .account-intro {
   font-size: 0.92rem;
   line-height: 1.9;
-  color: #647267;
+  color: var(--muted);
 }
 .account-benefits {
   display: flex;
@@ -152,7 +152,7 @@
 }
 .account-storage > div > span:last-child {
   margin-left: auto;
-  color: #788475;
+  color: var(--muted);
 }
 .account-storage meter {
   width: 100%;
@@ -174,7 +174,7 @@
 .account-toggle small,
 .account-import small {
   display: block;
-  color: #788475;
+  color: var(--muted);
   font-size: 0.74rem;
   line-height: 1.7;
   margin-top: 5px;
@@ -251,7 +251,7 @@
   gap: 6px;
 }
 .account-conflict small {
-  color: #876346;
+  color: var(--warm-muted);
 }
 .account-conflict > div {
   display: flex;
@@ -327,7 +327,7 @@
   border-radius: 4px;
 }
 .account-save-prompt > svg {
-  color: #5d7354;
+  color: var(--muted);
   margin-top: 3px;
 }
 .account-save-prompt > div {
@@ -442,7 +442,7 @@
 .account-insights details p {
   font-size: 0.82rem;
   line-height: 1.8;
-  color: #6f7a68;
+  color: var(--muted);
 }
 .account-insights-filters {
   display: flex;
@@ -481,7 +481,7 @@
   font-weight: 400;
 }
 .account-insights-metrics small {
-  color: #788475;
+  color: var(--muted);
   line-height: 1.6;
 }
 .account-insights table {
@@ -493,7 +493,7 @@
 .account-insights caption {
   text-align: start;
   margin-bottom: 12px;
-  color: #6d7b64;
+  color: var(--muted);
 }
 .account-insights td,
 .account-insights th {
diff --git a/src/styles/agent-guidance.css b/src/styles/agent-guidance.css
index 6a3a4cd..4c8befb 100644
--- a/src/styles/agent-guidance.css
+++ b/src/styles/agent-guidance.css
@@ -7,7 +7,7 @@
   display: flex;
   gap: 9px;
   align-items: center;
-  color: #626f58;
+  color: var(--muted);
   font-size: 10px;
   letter-spacing: 0.06em;
 }
@@ -28,7 +28,7 @@
   text-wrap: balance;
 }
 .agent-onboarding > p {
-  color: #64705c;
+  color: var(--muted);
   margin-bottom: 22px;
 }
 .agent-starting-points {
@@ -76,7 +76,7 @@
 }
 .agent-starting-prompt svg {
   flex-shrink: 0;
-  color: #7c8d6d;
+  color: var(--muted);
   transition: transform 160ms;
 }
 .agent-workspace .agent-starting-points > button:hover:not(:disabled) {
@@ -117,7 +117,7 @@
   min-height: 44px;
   padding: 8px 0;
   list-style: none;
-  color: #626f58;
+  color: var(--muted);
   font-size: 11px;
   line-height: 1.65;
   cursor: pointer;
@@ -151,7 +151,7 @@
 }
 .agent-tool-starts button > svg {
   flex-shrink: 0;
-  color: #718563;
+  color: var(--muted);
 }
 .agent-tool-starts button > svg:last-child {
   margin-left: auto;
@@ -179,7 +179,7 @@
   gap: 8px;
   font-size: 11px;
   line-height: 1.65;
-  color: #607151;
+  color: var(--muted);
   margin-bottom: 12px;
 }
 .agent-conversation-guide-heading svg {
@@ -216,7 +216,7 @@
 }
 .agent-guidance-options > button > svg {
   flex-shrink: 0;
-  color: #637951;
+  color: var(--muted);
 }
 .agent-guidance-other {
   display: flex;
@@ -242,7 +242,7 @@
 }
 .agent-guidance-hint {
   font-size: 10px;
-  color: #637055;
+  color: var(--muted);
   line-height: 1.7;
   margin: 0;
 }
@@ -306,7 +306,7 @@
     margin: 14px 0 9px;
   }
   .agent-onboarding > p {
-    color: #64705c;
+    color: var(--muted);
     margin-bottom: 18px;
   }
   .agent-workspace .agent-starting-points > button {
diff --git a/src/styles/agent-motion.css b/src/styles/agent-motion.css
index d1de76d..9dcd650 100644
--- a/src/styles/agent-motion.css
+++ b/src/styles/agent-motion.css
@@ -33,13 +33,13 @@
   align-items: center;
   gap: 5px;
   padding: 8px 6px;
-  color: #777e6c;
+  color: var(--muted);
   font-size: 9px;
   white-space: nowrap;
   border-radius: 3px;
 }
 .agent-motion-toggle[aria-pressed='false'] {
-  color: #8a877c;
+  color: var(--muted);
 }
 .agent-motion-toggle:disabled {
   cursor: default;
@@ -169,7 +169,7 @@
   display: flex;
   align-items: center;
   gap: 7px;
-  color: #8b8b79;
+  color: var(--muted);
   font-size: 8px;
   letter-spacing: 1.8px;
   margin-bottom: 7px;
@@ -190,7 +190,7 @@
 .agent-ritual-detail {
   font-size: 10px;
   line-height: 1.8;
-  color: #7c826f;
+  color: var(--muted);
   margin: 0;
 }
 .agent-ritual-facts {
@@ -199,7 +199,7 @@
   gap: 6px 14px;
   margin-top: 9px;
   font-size: 9px;
-  color: #6e7c60;
+  color: var(--muted);
   font-variant-numeric: tabular-nums;
 }
 .agent-ritual-facts > span {
@@ -208,7 +208,7 @@
 .agent-ritual-facts > span + span::before {
   content: '·';
   margin-right: 12px;
-  color: #adab97;
+  color: var(--muted);
 }
 .agent-ritual[data-active='false'] {
   grid-template-columns: 42px minmax(0, 1fr);
@@ -231,7 +231,7 @@
   opacity: 0;
 }
 .agent-ritual[data-phase='interrupted'] .agent-ritual-title {
-  color: #806a56;
+  color: var(--warm-muted);
 }
 .agent-ritual[data-phase='settled'] .ritual-impression {
   animation: ritual-seal-arrive 550ms var(--ritual-ease);
@@ -276,7 +276,7 @@
   width: 25px;
   height: 28px;
   border: 1px solid #b47d66;
-  color: #a8634c;
+  color: var(--red);
   font: 17px var(--serif);
   transform: rotate(-5deg);
 }
diff --git a/src/styles/agent-visuals.css b/src/styles/agent-visuals.css
index a3196f1..f08240a 100644
--- a/src/styles/agent-visuals.css
+++ b/src/styles/agent-visuals.css
@@ -6,7 +6,7 @@
   display: flex;
   align-items: center;
   gap: 9px;
-  color: #8a7660;
+  color: var(--warm-muted);
 }
 .agent-welcome-kicker .eyebrow {
   font-size: 8px;
@@ -17,7 +17,7 @@
 }
 .instrument-glyph {
   flex: 0 0 auto;
-  color: #6a7e60;
+  color: var(--muted);
 }
 .glyph-ground {
   fill: #e5e9d9;
@@ -89,7 +89,7 @@
 }
 .trace-station small {
   font-size: 9px;
-  color: #7c8771;
+  color: var(--muted);
 }
 .trace-station + .trace-station::before {
   content: '';
@@ -107,7 +107,7 @@
   gap: 5px;
   margin-left: auto;
   font-size: 9px;
-  color: #6e7a63;
+  color: var(--muted);
 }
 .trace-disclosure svg {
   transition: transform 180ms;
@@ -123,7 +123,7 @@
   padding-top: 5px;
   border-top: 1px solid #dedfcf;
   font-size: 10px;
-  color: #986246;
+  color: var(--warm-muted);
 }
 .trace-exceptions > span {
   display: flex;
@@ -131,13 +131,13 @@
   align-items: center;
 }
 .trace-exceptions .trace-recovered {
-  color: #616f56;
+  color: var(--muted);
 }
 .agent-trace .agent-tool-log {
   margin: 4px 12px 12px 22px;
 }
 .agent-trace .agent-tool-event p {
-  color: #616f56;
+  color: var(--muted);
 }
 .agent-answer > ul {
   list-style: none;
@@ -190,7 +190,7 @@
   display: block;
   font-size: 8px;
   letter-spacing: 1.4px;
-  color: #77856b;
+  color: var(--muted);
   margin-bottom: 6px;
 }
 .report-overview-counts {
@@ -202,7 +202,7 @@
   display: inline-flex;
   align-items: baseline;
   gap: 5px;
-  color: #6c795f;
+  color: var(--muted);
   font-size: 9px;
 }
 .report-overview-counts b {
@@ -243,7 +243,7 @@
   margin-left: auto;
   font-size: 9px;
   letter-spacing: 1px;
-  color: #788869;
+  color: var(--muted);
   white-space: nowrap;
 }
 .diagram-items {
@@ -272,7 +272,7 @@
   align-items: center;
   font-size: 9px;
   letter-spacing: 0.7px;
-  color: #76866a;
+  color: var(--muted);
   margin-bottom: 10px;
 }
 .diagram-items > button {
@@ -300,7 +300,7 @@
 .diagram-node {
   display: grid;
   place-items: center;
-  color: #8c9c77;
+  color: var(--muted);
   flex-shrink: 0;
 }
 .diagram-node > svg {
@@ -337,7 +337,7 @@
   display: flex;
   gap: 4px;
   align-items: center;
-  color: #708360;
+  color: var(--muted);
   font-size: 10px;
   margin-top: auto;
   padding-top: 5px;
@@ -351,7 +351,7 @@
   padding: 0 13px 13px;
   font-size: 10px;
   line-height: 1.8;
-  color: #776e55;
+  color: var(--warm-muted);
 }
 .diagram-evidence {
   padding: 11px 13px 13px;
@@ -369,7 +369,7 @@
   align-items: baseline;
   flex-wrap: wrap;
   gap: 5px 7px;
-  color: #788766;
+  color: var(--muted);
   font-size: 9px;
   line-height: 1.7;
 }
@@ -380,7 +380,7 @@
 }
 .visual-citations > a {
   display: inline;
-  color: #627554;
+  color: var(--muted);
   text-decoration: underline;
   text-decoration-color: #aebb9d;
   text-underline-offset: 3px;
@@ -418,7 +418,7 @@
   height: 30px;
   border: 1px solid #b6c3a8;
   border-radius: 50%;
-  color: #59714b;
+  color: var(--muted);
   grid-row: 1 / 3;
   align-self: start;
 }
@@ -447,7 +447,7 @@
   gap: 7px;
   align-items: center;
   font-size: 9px;
-  color: #6a7b5d;
+  color: var(--muted);
   letter-spacing: 0.8px;
 }
 .report-chapters-heading > button {
@@ -472,7 +472,7 @@
 }
 .chapter-index {
   font: italic 16px var(--serif);
-  color: #a58a6a;
+  color: var(--warm-muted);
 }
 .visual-report .report-chapter h3 {
   margin: 0;
@@ -480,7 +480,7 @@
   font: 17px/1.6 var(--serif);
 }
 .report-chapter > summary > svg {
-  color: #899779;
+  color: var(--muted);
   flex: 0 0 auto;
   transition: transform 180ms;
 }
@@ -525,11 +525,11 @@
   overflow-wrap: anywhere;
 }
 .citation-unavailable {
-  color: #956345;
+  color: var(--warm-muted);
 }
 .agent-source-mark > span {
   font: italic 13px var(--serif);
-  color: #a4896b;
+  color: var(--warm-muted);
 }
 .source-excerpt > summary {
   list-style: none;
@@ -538,7 +538,7 @@
   align-items: center;
   cursor: pointer;
   font-size: 10px;
-  color: #687c59;
+  color: var(--muted);
   padding: 12px 0 7px;
 }
 .agent-source-card .source-excerpt p {
diff --git a/src/styles/agent.css b/src/styles/agent.css
index 1cfc594..24105ad 100644
--- a/src/styles/agent.css
+++ b/src/styles/agent.css
@@ -119,7 +119,7 @@
   margin: 0 6px 22px;
 }
 .agent-sidebar-heading .eyebrow {
-  color: #717366;
+  color: var(--muted);
   font-size: 8px;
 }
 .agent-new {
@@ -143,7 +143,7 @@
   align-items: center;
   gap: 8px;
   padding: 12px 8px 10px;
-  color: #74796c;
+  color: var(--muted);
   border-bottom: 1px solid var(--agent-line);
   margin: 8px 0 15px;
 }
@@ -202,7 +202,7 @@
   width: 25px;
   display: grid;
   place-items: center;
-  color: #787d71;
+  color: var(--muted);
   padding: 0;
 }
 .agent-session-row:hover .agent-delete,
@@ -218,7 +218,7 @@
   border-top: 1px solid var(--agent-line);
 }
 .agent-sidebar-bottom > .eyebrow {
-  color: #75796c;
+  color: var(--muted);
   font-size: 8px;
 }
 .agent-instruments {
@@ -264,7 +264,7 @@
 }
 .agent-local {
   font-size: 9px;
-  color: #737a6c;
+  color: var(--muted);
   margin: 16px 0 0;
   display: flex;
   gap: 6px;
@@ -321,7 +321,7 @@
 .agent-beta {
   font-size: 8px;
   letter-spacing: 1.1px;
-  color: #7c7e6e;
+  color: var(--muted);
   border: 1px solid #dddfd0;
   border-radius: 2px;
   padding: 1px 5px;
@@ -337,7 +337,7 @@
   display: inline-flex;
   align-items: center;
   justify-content: center;
-  color: #71796b;
+  color: var(--muted);
   border-radius: 3px;
   flex-shrink: 0;
 }
@@ -364,7 +364,7 @@
   margin: 0 auto;
 }
 .agent-welcome > .eyebrow {
-  color: #8a7660;
+  color: var(--warm-muted);
   font-size: 8px;
 }
 .agent-welcome h1 {
@@ -381,7 +381,7 @@
 .agent-welcome > p {
   font-size: 12px;
   line-height: 1.9;
-  color: #74796d;
+  color: var(--muted);
   margin-bottom: 26px;
 }
 .agent-composer-area {
@@ -425,7 +425,7 @@
   outline: none;
 }
 .agent-composer textarea::placeholder {
-  color: #8c9282;
+  color: var(--muted);
 }
 .agent-composer-controls {
   display: flex;
@@ -444,7 +444,7 @@
   gap: 4px;
   padding: 5px 8px;
   font-size: 10px;
-  color: #78806f;
+  color: var(--muted);
   border-radius: 3px;
   white-space: nowrap;
 }
@@ -458,7 +458,7 @@
   gap: 4px;
   padding: 5px 2px;
   font-size: 10px;
-  color: #75806b;
+  color: var(--muted);
   white-space: nowrap;
 }
 .agent-context-trigger.has-context {
@@ -476,7 +476,7 @@
 .agent-provider {
   margin-left: auto;
   font-size: 10px;
-  color: #727d68;
+  color: var(--muted);
   letter-spacing: -0.1px;
 }
 .agent-send {
@@ -495,7 +495,7 @@
 }
 .agent-send:disabled {
   background: #d8ddce !important;
-  color: #858f7b;
+  color: var(--muted);
   opacity: 1;
 }
 .agent-send.stop {
@@ -507,7 +507,7 @@
   gap: 8px;
   padding: 9px 3px 0;
   font-size: 9px;
-  color: #7e8476;
+  color: var(--muted);
 }
 .agent-composer-foot > span:last-child {
   white-space: nowrap;
@@ -543,7 +543,7 @@
   letter-spacing: -0.4px;
 }
 .agent-author > span:last-child {
-  color: #89907e;
+  color: var(--muted);
   font-size: 9px;
   margin-left: auto;
 }
@@ -586,7 +586,7 @@
   border-left: 2px solid #b8bea5;
   padding-left: 15px;
   margin: 18px 0;
-  color: #727b66;
+  color: var(--muted);
 }
 .agent-prose pre {
   max-width: 100%;
@@ -617,7 +617,7 @@
 }
 .agent-plan summary > span {
   margin-left: auto;
-  color: #88917b;
+  color: var(--muted);
   font-size: 9px;
 }
 .agent-plan ol {
@@ -630,7 +630,7 @@
   align-items: center;
   gap: 8px;
   padding: 5px 0;
-  color: #77816d;
+  color: var(--muted);
 }
 .agent-plan li.complete {
   color: #55674c;
@@ -654,7 +654,7 @@
   list-style: none;
   cursor: pointer;
   padding: 5px 0;
-  color: #718064;
+  color: var(--muted);
 }
 .agent-tool-event summary small {
   font-size: 8px;
@@ -667,7 +667,7 @@
   color: var(--red);
 }
 .agent-tool-event.earlier-attempt summary {
-  color: #70766b;
+  color: var(--muted);
 }
 .agent-tool-event.earlier-attempt summary small {
   color: #4c654c;
@@ -677,13 +677,13 @@
   color: #4c654c;
 }
 .agent-tool-event.running summary {
-  color: #857654;
+  color: var(--warm-muted);
 }
 .agent-tool-event p {
   font-size: 10px;
   padding: 4px 4px 8px 20px;
   line-height: 1.7;
-  color: #7e846e;
+  color: var(--muted);
   margin: 0;
 }
 .agent-arriving {
@@ -707,7 +707,7 @@
 }
 .agent-arriving > span {
   font-size: 10px;
-  color: #838c78;
+  color: var(--muted);
   margin-left: 8px;
 }
 .agent-artifact-links {
@@ -732,7 +732,7 @@
 .agent-artifact-links small {
   display: block;
   font-size: 8px;
-  color: #7b866d;
+  color: var(--muted);
   margin-bottom: 3px;
 }
 .agent-artifact-links strong {
@@ -744,14 +744,14 @@
 }
 .agent-artifact-links > button > svg:last-child {
   margin-left: auto;
-  color: #849176;
+  color: var(--muted);
 }
 .agent-source-count {
   display: flex;
   gap: 6px;
   align-items: center;
   font-size: 10px;
-  color: #78876a;
+  color: var(--muted);
   padding: 0 !important;
   margin: 14px 0 0;
 }
@@ -776,7 +776,7 @@
 }
 .agent-model-receipt {
   display: block;
-  color: #8a917e;
+  color: var(--muted);
   font-size: 8px;
   margin-top: 13px;
 }
@@ -793,7 +793,7 @@
   padding: 0;
 }
 .agent-stopped {
-  color: #907d67;
+  color: var(--warm-muted);
   font-size: 10px;
   margin: 14px 0 0;
 }
@@ -820,7 +820,7 @@
   padding: 2px 0 0;
   font-size: 11px;
   border-bottom: 2px solid transparent;
-  color: #7b8371;
+  color: var(--muted);
 }
 .agent-panel-tabs button.selected {
   border-color: var(--red);
@@ -828,7 +828,7 @@
 }
 .agent-panel-tabs button > span {
   font-size: 8px;
-  color: #969d8b;
+  color: var(--muted);
 }
 .agent-panel-scroll {
   flex: 1;
@@ -841,7 +841,7 @@
   padding: 49px 33px;
 }
 .agent-panel-empty > .eyebrow {
-  color: #89917a;
+  color: var(--muted);
   font-size: 8px;
 }
 .agent-panel-empty h2 {
@@ -851,7 +851,7 @@
   margin: 0 0 18px;
 }
 .agent-panel-empty > p {
-  color: #7f8674;
+  color: var(--muted);
   font-size: 11px;
   line-height: 1.95;
   max-width: 270px;
@@ -865,7 +865,7 @@
   margin-top: 33px;
   font-size: 9px;
   letter-spacing: 1.8px;
-  color: #90987f;
+  color: var(--muted);
 }
 .agent-empty-legend > span + span::before {
   content: '·';
@@ -882,11 +882,11 @@
 .agent-panel-foot > span {
   font-size: 7px;
   letter-spacing: 1.4px;
-  color: #8c947e;
+  color: var(--muted);
 }
 .agent-panel-foot > a {
   font-size: 9px;
-  color: #788567;
+  color: var(--muted);
 }
 .agent-artifact-view {
   padding: 24px 24px 30px;
@@ -899,7 +899,7 @@
   border-bottom: 1px solid #d2d8c5;
   padding-bottom: 13px;
   margin-bottom: 25px;
-  color: #849072;
+  color: var(--muted);
 }
 .agent-artifact-select select {
   appearance: none;
@@ -913,7 +913,7 @@
 }
 .agent-artifact-heading > .eyebrow {
   font-size: 7px;
-  color: #8d836c;
+  color: var(--warm-muted);
 }
 .agent-artifact-heading h2 {
   font-family: var(--serif);
@@ -923,7 +923,7 @@
 }
 .agent-artifact-heading > p {
   font-size: 9px;
-  color: #818872;
+  color: var(--muted);
   margin-bottom: 24px;
 }
 .agent-chart {
@@ -1084,7 +1084,7 @@
 }
 .agent-report-number {
   font: italic 16px var(--serif);
-  color: #a59074;
+  color: var(--warm-muted);
 }
 .agent-report h3 {
   font-size: 17px;
@@ -1106,7 +1106,7 @@
   gap: 4px;
   align-items: center;
   font-size: 9px;
-  color: #848369;
+  color: var(--warm-muted);
 }
 .agent-report-citations a:hover {
   color: var(--red);
@@ -1122,7 +1122,7 @@
 }
 .agent-report-questions .eyebrow {
   display: block;
-  color: #859072;
+  color: var(--muted);
   margin-bottom: 10px;
   font-size: 8px;
 }
@@ -1159,14 +1159,14 @@
 }
 .agent-artifact-actions > span {
   margin-left: auto;
-  color: #8c947e;
+  color: var(--muted);
   font-size: 8px;
 }
 .agent-sources {
   padding: 32px 25px;
 }
 .agent-sources > .eyebrow {
-  color: #8c826a;
+  color: var(--warm-muted);
   font-size: 8px;
 }
 .agent-sources > h2 {
@@ -1187,12 +1187,12 @@
 }
 .agent-source-number {
   font: italic 17px var(--serif);
-  color: #ab9377;
+  color: var(--warm-muted);
   margin-top: 9px;
 }
 .agent-source-type {
   font-size: 8px;
-  color: #8b967b;
+  color: var(--muted);
   display: block;
   margin-bottom: 5px;
 }
@@ -1208,7 +1208,7 @@
 }
 .agent-source-card p {
   font-size: 10px;
-  color: #7a856d;
+  color: var(--muted);
   margin: 9px 0;
   display: -webkit-box;
   -webkit-line-clamp: 4;
@@ -1217,7 +1217,7 @@
 }
 .agent-source-card small {
   font-size: 8px;
-  color: #929a84;
+  color: var(--muted);
 }
 .agent-notice,
 .agent-storage-error {
@@ -1243,7 +1243,7 @@
   white-space: nowrap;
 }
 .agent-quiet {
-  color: #7b8571;
+  color: var(--muted);
   font-size: 11px;
   line-height: 1.85;
 }
@@ -1269,7 +1269,7 @@
 }
 .agent-dialog-heading .eyebrow {
   font-size: 8px;
-  color: #8f816a;
+  color: var(--warm-muted);
 }
 .agent-dialog-heading h2 {
   font-family: var(--serif);
@@ -1303,7 +1303,7 @@
 .agent-journal-picker > div small {
   display: block;
   font-size: 10px;
-  color: #808970;
+  color: var(--muted);
   margin-top: 3px;
 }
 .agent-birth-grid {
@@ -1338,7 +1338,7 @@
 .agent-birth-grid > p {
   grid-column: 1 / -1;
   font-size: 10px;
-  color: #808c70;
+  color: var(--muted);
 }
 .agent-context-note {
   display: grid;
@@ -1362,13 +1362,13 @@
 }
 .agent-journal-picker > label small {
   display: block;
-  color: #8b927f;
+  color: var(--muted);
   font-size: 9px;
   margin-top: 3px;
 }
 .agent-journal-picker > p {
   font-size: 11px;
-  color: #869178;
+  color: var(--muted);
   margin: 12px 0;
 }
 .agent-journal-picker a {
@@ -1398,7 +1398,7 @@
 }
 .agent-context-preview > p {
   font-size: 10px;
-  color: #808d70;
+  color: var(--muted);
 }
 .agent-dialog-actions {
   display: flex;
@@ -1849,3 +1849,91 @@
     min-height: 36px;
   }
 }
+
+/* Quiet typography still needs readable text and dependable touch controls. */
+.agent-prose {
+  font-size: 15px;
+  line-height: 1.85;
+  overflow-wrap: anywhere;
+}
+.agent-tool-event summary small {
+  opacity: 1;
+}
+.agent-composer-area {
+  position: relative;
+}
+.agent-jump-latest {
+  position: absolute;
+  bottom: calc(100% + 8px);
+  left: 50%;
+  transform: translateX(-50%);
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  min-height: 40px;
+  padding: 8px 14px;
+  border: 1px solid var(--agent-line) !important;
+  border-radius: 24px;
+  background: var(--paper-light) !important;
+  color: var(--ink);
+  font-size: 12px;
+  white-space: nowrap;
+  box-shadow: 0 3px 12px #293b3310;
+}
+.agent-input-help {
+  color: var(--muted);
+  font-size: 11px;
+  line-height: 1.6;
+  margin: 6px 3px 0;
+  display: none;
+}
+.agent-composer-area:focus-within .agent-input-help {
+  display: block;
+}
+.keyboard-coarse {
+  display: none;
+}
+@media (pointer: coarse) {
+  .keyboard-fine {
+    display: none;
+  }
+  .keyboard-coarse {
+    display: inline;
+  }
+}
+@media (max-width: 700px) {
+  .agent-icon-button,
+  .agent-mode-picker button,
+  .agent-context-trigger,
+  .agent-jump-latest {
+    min-height: 44px;
+  }
+  .agent-icon-button {
+    min-width: 44px;
+  }
+  .agent-composer-controls {
+    gap: 5px;
+    flex-wrap: wrap;
+  }
+  .agent-mode-picker button {
+    font-size: 11px;
+    padding: 6px;
+  }
+  .agent-context-trigger {
+    font-size: 11px;
+    padding: 6px 4px;
+  }
+  .agent-provider {
+    display: none;
+  }
+  .agent-send {
+    margin-left: auto;
+  }
+  .agent-panel-tabs {
+    gap: 20px;
+  }
+  .agent-tool-event summary,
+  .agent-plan summary {
+    min-height: 44px;
+  }
+}
diff --git a/src/styles/analytics-dashboard.css b/src/styles/analytics-dashboard.css
index 837d8ea..0b0805b 100644
--- a/src/styles/analytics-dashboard.css
+++ b/src/styles/analytics-dashboard.css
@@ -266,7 +266,7 @@
 .observatory .eyebrow {
   font-size: 9px;
   letter-spacing: 0.16em;
-  color: #7e896f;
+  color: var(--muted);
 }
 .observatory h2 {
   color: #374e39;
diff --git a/src/styles/feedback.css b/src/styles/feedback.css
index c8811c3..d900317 100644
--- a/src/styles/feedback.css
+++ b/src/styles/feedback.css
@@ -1,17 +1,12 @@
 .feedback-launch {
-  position: fixed;
-  right: 20px;
-  bottom: 20px;
-  z-index: 35;
-  display: flex;
+  display: inline-flex;
   align-items: center;
-  gap: 8px;
-  padding: 10px 15px;
-  border: 1px solid #d9dcd0;
-  border-radius: 24px;
-  color: #465b4d;
-  background: #fbfaf5;
-  box-shadow: 0 3px 16px #243c2e0a;
+  align-self: flex-start;
+  min-height: 32px;
+  padding: 4px 0;
+  border: 0;
+  color: var(--muted);
+  background: transparent;
   font: inherit;
   font-size: 12px;
   cursor: pointer;
@@ -21,8 +16,7 @@
   display: none !important;
 }
 .feedback-launch:hover {
-  border-color: #809079;
-  background: #f1f2e9;
+  color: var(--red);
 }
 .feedback-dialog {
   width: min(540px, calc(100vw - 32px));
@@ -53,7 +47,7 @@
 .feedback-context p {
   font-size: 12px;
   line-height: 1.8;
-  color: #6b796c;
+  color: var(--muted);
 }
 .feedback-intro {
   font-size: 14px;
@@ -63,12 +57,12 @@
   position: absolute;
   right: 16px;
   top: 12px;
-  width: 36px;
-  height: 36px;
+  width: 44px;
+  height: 44px;
   font-size: 26px;
   border: 0;
   background: transparent;
-  color: #6b796c;
+  color: var(--muted);
   cursor: pointer;
 }
 .feedback-rating {
@@ -173,7 +167,7 @@
   margin: 12px 0 0;
 }
 .feedback-privacy a {
-  color: #667958;
+  color: var(--muted);
   text-decoration: underline;
   text-underline-offset: 3px;
 }
@@ -198,7 +192,7 @@
 }
 .feedback-thanks span:not(.feedback-receipt-mark) {
   font-size: 12px;
-  color: #70816b;
+  color: var(--muted);
 }
 .feedback-thanks code {
   font-size: 10px;
@@ -213,7 +207,7 @@
   border: 1px solid #b4c0a5;
   border-radius: 50%;
   font-size: 22px;
-  color: #6c835d;
+  color: var(--muted);
   background: #edf0e4;
 }
 .feedback-inline {
@@ -224,7 +218,7 @@
   margin: 20px 0 8px;
   padding-top: 16px;
   border-top: 1px solid #dce0d5;
-  color: #75836f;
+  color: var(--muted);
   font-size: 12px;
 }
 .feedback-inline button {
@@ -268,13 +262,7 @@
     font-size: 25px;
   }
   .feedback-launch {
-    right: 12px;
-    bottom: 12px;
-  }
-  .agent-page .feedback-launch {
-    bottom: auto;
-    top: 80px;
-    padding: 7px 10px;
+    min-height: 44px;
   }
   .feedback-rating span {
     font-size: 11px;
diff --git a/src/styles/global.css b/src/styles/global.css
index 29f0a20..a3a2e1e 100644
--- a/src/styles/global.css
+++ b/src/styles/global.css
@@ -3,7 +3,8 @@
   --paper: #f6f3ec;
   --paper-light: #fdfbf6;
   --ink: #293b33;
-  --muted: #6c7368;
+  --muted: #596657;
+  --warm-muted: #74634f;
   --line: #dcded2;
   --red: #ab4936;
   --red-dark: #893826;
@@ -3813,3 +3814,85 @@ html[lang='en'] .section-heading h2 {
   font-size: 13px;
   line-height: 1.7;
 }
+
+/* Keep revisiting a journal entry predictable on a phone. */
+.journal-back {
+  display: none;
+}
+.journal-tool-link {
+  margin-top: 18px;
+}
+.gallery-count {
+  color: var(--muted);
+  font-size: 12px;
+  margin: 18px 0;
+}
+.tarot-art-retry {
+  min-height: 320px;
+  display: grid;
+  place-items: center;
+  align-content: center;
+  gap: 20px;
+  padding: 32px;
+  background: var(--sage);
+  text-align: center;
+}
+.tarot-art-retry .card-unavailable {
+  position: static;
+}
+@media (max-width: 800px) {
+  .journal-back {
+    display: inline-flex;
+    gap: 8px;
+    align-items: center;
+    min-height: 44px;
+    margin-bottom: 20px;
+  }
+  .journal-entry > .icon-button {
+    width: 44px;
+    height: 44px;
+  }
+  .entry-open .eyebrow {
+    font-size: 10px;
+  }
+  .entry-open p {
+    font-size: 12px;
+  }
+}
+
+.pillar-role,
+.pillar-pinyin,
+.pillar-hidden,
+.pillar-element {
+  font-size: 11px;
+  line-height: 1.6;
+  text-align: center;
+  overflow-wrap: anywhere;
+}
+.pillar-role {
+  min-height: 36px;
+  margin-bottom: 12px;
+}
+.tarot-close {
+  min-width: 44px;
+  min-height: 44px;
+}
+@media (max-width: 560px) {
+  .pillar-role,
+  .pillar-pinyin,
+  .pillar-hidden,
+  .pillar-element,
+  .pillar-label {
+    font-size: 10px;
+  }
+  .pillar-label {
+    letter-spacing: 1px;
+  }
+  .element-buttons button {
+    min-height: 36px;
+    font-size: 12px;
+  }
+  .element-note {
+    font-size: 11px;
+  }
+}
diff --git a/src/styles/handbook.css b/src/styles/handbook.css
index 8a5a756..b2afd2a 100644
--- a/src/styles/handbook.css
+++ b/src/styles/handbook.css
@@ -24,7 +24,7 @@
   gap: 16px;
   font: 10px/1.6 var(--sans);
   letter-spacing: 2px;
-  color: #61715b;
+  color: var(--muted);
   padding-bottom: 24px;
 }
 .knowledge-figure figcaption {
@@ -42,7 +42,7 @@
 }
 .knowledge-figure figcaption small {
   font: 11px/1.7 var(--sans);
-  color: #6a7064;
+  color: var(--muted);
 }
 .pillar-lesson {
   display: grid;
@@ -98,7 +98,7 @@
 }
 .trigram-lesson small {
   font: 11px/1.7 monospace;
-  color: #6d765f;
+  color: var(--muted);
 }
 .tarot-lesson {
   display: flex;
@@ -399,7 +399,7 @@
 }
 .lesson-line span {
   font: 11px/1.5 var(--sans);
-  color: #65765c;
+  color: var(--muted);
 }
 .lesson-line i {
   height: 7px;
@@ -584,7 +584,7 @@
   display: block;
   font: 10px/1.7 var(--sans);
   margin-top: 4px;
-  color: #64705a;
+  color: var(--muted);
 }
 .relation-map > div {
   border-top: 1px solid #c4ceb7;
diff --git a/src/styles/library.css b/src/styles/library.css
index c91db3a..48db8e8 100644
--- a/src/styles/library.css
+++ b/src/styles/library.css
@@ -22,7 +22,7 @@
   display: flex;
   align-items: center;
   gap: 9px;
-  color: #5c704d;
+  color: var(--muted);
 }
 .library-welcome h2 {
   font: 34px/1.4 var(--serif);
@@ -33,7 +33,7 @@
 }
 .library-welcome-copy > p {
   max-width: 42em;
-  color: #66705f;
+  color: var(--muted);
   font-size: 13px;
   line-height: 1.9;
 }
@@ -151,7 +151,7 @@
   display: none;
 }
 .library-search input::placeholder {
-  color: #808678;
+  color: var(--muted);
 }
 .library-clear {
   display: grid;
@@ -206,7 +206,7 @@
   width: 42px;
   height: 48px;
   border: 1px solid #bfae91;
-  color: #8e6750;
+  color: var(--warm-muted);
   font: 25px/1 var(--serif);
   flex-shrink: 0;
 }
@@ -223,7 +223,7 @@
 }
 .library-topic-index {
   margin-left: auto;
-  color: #98a08d;
+  color: var(--muted);
   font: 31px/1 var(--serif);
   align-self: start;
 }
@@ -389,7 +389,7 @@
   align-items: center;
   margin: 0 0 20px;
   font: 500 13px/1.6 var(--sans);
-  color: #5c704d;
+  color: var(--muted);
 }
 .guide-primer ol {
   list-style: none;
@@ -407,7 +407,7 @@
 }
 .primer-number {
   font: 25px/1.2 var(--serif);
-  color: #8c947c;
+  color: var(--muted);
   display: block;
   margin-bottom: 8px;
 }
@@ -422,13 +422,13 @@
   font-size: 11px;
   line-height: 1.8;
   margin: 8px 0 0;
-  color: #66705f;
+  color: var(--muted);
 }
 .primer-arrow {
   position: absolute;
   top: 8px;
   right: -22px;
-  color: #8c947c;
+  color: var(--muted);
 }
 .article-mobile-toc {
   display: none;
diff --git a/tests/account-worker.fixture.ts b/tests/account-worker.fixture.ts
index c41ff26..c6a606d 100644
--- a/tests/account-worker.fixture.ts
+++ b/tests/account-worker.fixture.ts
@@ -3,6 +3,7 @@ import type { Env } from '../worker/types';
 export { UsageGate } from '../worker/quota';
 export { DeletionLedger } from '../worker/deletion-ledger';
 const wrapped = new WeakMap<object, Env>();
+let failFeedback = false;
 export default {
   async fetch(request: Request, env: Env & { MAILBOX: Fetcher }, ctx: ExecutionContext) {
     let configured = wrapped.get(env);
@@ -22,6 +23,13 @@ export default {
       wrapped.set(env, configured);
     }
     try {
+      // Disposable local browser QA only; this file is never imported by production.
+      if (new URL(request.url).pathname === '/__fixture/feedback-failure' && request.method === 'POST') {
+        failFeedback = ((await request.json()) as { fail?: boolean }).fail === true;
+        return Response.json({ fail: failFeedback });
+      }
+      if (failFeedback && new URL(request.url).pathname === '/api/feedback')
+        return Response.json({ error: 'fixture_feedback_unavailable' }, { status: 503 });
       if (new URL(request.url).pathname === '/__fixture/reconcile') {
         const { reconcileDeletionLedger } = await import('../worker/accounts');
         return Response.json(await reconcileDeletionLedger({ ...configured, ACCOUNTS_MAINTENANCE: 'true' }));

File: src/lib/agent-keyboard.ts
type ComposerKey = {
  key: string;
  keyCode?: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

export function shouldSendMessage(key: ComposerKey, touchKeyboard: boolean): boolean {
  if (key.key !== 'Enter' || key.isComposing || key.keyCode === 229 || key.shiftKey) return false;
  return key.ctrlKey || key.metaKey || !touchKeyboard;
}


File: src/lib/feedback-delivery.ts
import type { Locale } from './schema';

export class FeedbackDeliveryError extends Error {
  constructor(readonly status: number) {
    super('Feedback delivery failed');
    this.name = 'FeedbackDeliveryError';
  }
}

export function feedbackReceipt(value: unknown, expectedId: string): string {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !('saved' in value) ||
    value.id !== expectedId ||
    value.saved !== true
  )
    throw new FeedbackDeliveryError(502);
  return expectedId;
}

// Browser and server errors are diagnostic data, not user-facing copy.
export function feedbackFailureMessage(error: unknown, locale: Locale): string {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  if (error instanceof FeedbackDeliveryError && error.status === 429)
    return t(
      '提交得有些频繁，请一分钟后再试。内容还在这里。',
      'Please wait a minute before trying again. Your note is still here.',
    );
  if (error instanceof Error && error.name === 'TimeoutError')
    return t(
      '连接超时，请重试。重复提交不会重复保存。',
      'The connection timed out. You can retry without creating a duplicate.',
    );
  if (error instanceof TypeError)
    return t(
      '连接中断，反馈尚未确认保存。内容还在这里，请联网后重试。',
      'The connection was interrupted, so saving is not confirmed. Your note is still here; reconnect and try again.',
    );
  return t(
    '暂时没能确认保存，请稍后重试。内容还在这里。',
    'We couldn’t confirm saving. Your note is still here; please try again.',
  );
}


File: tests/ux-interaction.test.ts
import { describe, expect, it } from 'vitest';
import { shouldSendMessage } from '../src/lib/agent-keyboard';
import { feedbackFailureMessage, feedbackReceipt, FeedbackDeliveryError } from '../src/lib/feedback-delivery';

const enter = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false };

describe('composer keyboard contract', () => {
  it('desktop Enter sends while Shift+Enter preserves a new line', () => {
    expect(shouldSendMessage(enter, false)).toBe(true);
    expect(shouldSendMessage({ ...enter, shiftKey: true }, false)).toBe(false);
  });
  it('touch Enter adds a line; explicit Ctrl or Command shortcuts can still send', () => {
    expect(shouldSendMessage(enter, true)).toBe(false);
    expect(shouldSendMessage({ ...enter, ctrlKey: true }, true)).toBe(true);
    expect(shouldSendMessage({ ...enter, metaKey: true }, true)).toBe(true);
  });
  it('IME confirmation never submits, including the legacy 229 composition signal', () => {
    for (const touch of [true, false]) {
      expect(shouldSendMessage({ ...enter, isComposing: true, ctrlKey: true }, touch)).toBe(false);
      expect(shouldSendMessage({ ...enter, keyCode: 229 }, touch)).toBe(false);
      expect(shouldSendMessage({ ...enter, key: 'a' }, touch)).toBe(false);
    }
  });
});

describe('feedback delivery truth and recovery', () => {
  it('a success receipt must confirm this exact submission was saved', () => {
    expect(feedbackReceipt({ id: 'submission-1', saved: true }, 'submission-1')).toBe('submission-1');
    for (const response of [
      null,
      {},
      'ok',
      { id: 'another', saved: true },
      { id: 'submission-1', saved: false },
    ])
      expect(() => feedbackReceipt(response, 'submission-1')).toThrow(FeedbackDeliveryError);
  });
  it('browser and malformed-response diagnostics never leak into user-facing feedback', () => {
    for (const error of [
      new TypeError('Failed to fetch'),
      new SyntaxError('secret response body'),
      new Error('private internal diagnostic'),
    ]) {
      const zh = feedbackFailureMessage(error, 'zh');
      expect(zh).toContain('内容还在这里');
      expect(zh).not.toContain(error.message);
      expect(feedbackFailureMessage(error, 'en')).toContain('Your note is still here');
    }
  });
  it('timeout and rate-limit recovery are specific and localized', () => {
    const timeout = new Error('deadline');
    timeout.name = 'TimeoutError';
    expect(feedbackFailureMessage(timeout, 'zh')).toContain('重复提交不会重复保存');
    expect(feedbackFailureMessage(timeout, 'en')).toContain('without creating a duplicate');
    expect(feedbackFailureMessage(new FeedbackDeliveryError(429), 'zh')).toContain('一分钟');
    expect(feedbackFailureMessage(new FeedbackDeliveryError(429), 'en')).toContain('wait a minute');
  });
});
