import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  UserRound,
  X,
  Mail,
  ArrowRight,
  Cloud,
  ShieldCheck,
  Download,
  LogOut,
  LoaderCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { track } from '../lib/analytics';
import type { Locale } from '../lib/schema';
import type { RecordKind } from '../lib/account-protocol';
import {
  accountServerSnapshot,
  accountSnapshot,
  subscribeAccount,
  initializeAccount,
  accountRequest,
  AccountClientError,
  importRecord,
  guestRecords,
  pendingRecords,
  retryAccount,
  resolvePending,
  signOut,
  exportAccount,
  downloadAccount,
  finishDeletedAccount,
  exportTemporary,
  discardTemporary,
  type AccountIntent,
  type AccountOpenRequest,
  type AccountEntry,
} from '../lib/account-client';
import '../styles/account.css';

export const accountError = (code: string, zh: boolean) => {
  const messages: Record<string, [string, string]> = {
    invalid_input: [
      '请检查填写内容，尤其是日期、时间和问题长度，再试一次。',
      'Check the fields, especially the date, time and question length, then try again.',
    ],
    rate_limited: ['请求有些频繁，请稍后重试。', 'Too many requests. Please wait before trying again.'],
    body_too_large: [
      '提交内容过长，请精简问题或补充资料后再试。',
      'This submission is too long. Shorten the question or context, then try again.',
    ],
    OTP_EXPIRED: ['验证码已过期，请重新获取。', 'This code expired. Request a new one.'],
    daily_allowance: [
      '今日免费额度已用完，上海时间零点后恢复；工具和历史记录仍可使用。',
      'Today’s free allowance is used. It resets at midnight in Shanghai. Tools and saved history remain available.',
    ],
    daily_budget: [
      '全站今日共享模型预算已用完，上海时间零点后恢复。',
      'The site’s shared model budget is used for today. It resets at midnight in Shanghai.',
    ],
    agent_budget: [
      '全站今日 Agent 预算已用完，已有结果仍可查看。',
      'The site’s Agent budget is used for today. Existing results remain available.',
    ],
    network_allowance: [
      '当前网络的今日请求较多，已触及额外限额；工具和历史仍可使用。',
      'This network reached its additional daily allowance. Tools and saved history remain available.',
    ],
    request_already_reserved: [
      '本次请求已受理，请先查看对话记录，避免重复发起。',
      'This request was already accepted. Check your conversation before starting another turn.',
    ],
    local_storage_full: [
      '本浏览器的恢复空间已满，请先导出当前内容。',
      'This browser’s recovery storage is full. Export your current work first.',
    ],
    preference_sync_failed: [
      '本浏览器已更新统计偏好，但账号端尚未确认。请重新连接后再试。',
      'This browser’s measurement preference changed, but the account update is not confirmed. Reconnect and try again.',
    ],
    account_changed: [
      '账号已在另一个页面切换，已阻止把旧记录写入新账号。请刷新后继续。',
      'Your account changed in another tab. We blocked the old account’s changes from being saved to the new account. Refresh to continue.',
    ],
    active_conversation: [
      '请先停止当前对话并确认保存状态，再退出登录。',
      'Stop the current conversation and check its save status before signing out.',
    ],
    connection_failed: [
      '连接暂不可用，请稍后重试。已有内容不会因此自动删除。',
      'Connection unavailable. Please try again later. Existing records are not deleted by a connection failure.',
    ],
    EMAIL_SEND_FAILED: [
      '邮件暂时未能发出，请稍后重试。',
      'We couldn’t send the email. Please try again later.',
    ],
    EMAIL_SEND_UNKNOWN: [
      '发送状态尚未确认。请检查收件箱，1 分钟后仍未收到可重发。',
      'Sending has not been confirmed. Check your inbox; you can retry after one minute.',
    ],
    auth_rate_limited: ['请求较频繁，请稍后再试。', 'Too many requests. Please wait before trying again.'],
    INVALID_OTP: [
      '验证码无效或已过期，请使用最新邮件中的验证码。',
      'The code is invalid or expired. Use the code in the latest email.',
    ],
    TOO_MANY_ATTEMPTS: ['尝试次数已用完，请重新获取验证码。', 'Too many attempts. Request a new code.'],
    revision_conflict: [
      '另一处修改了这条记录。可保留当前内容为副本，或使用云端版本。',
      'This record changed elsewhere. Keep your changes as a copy or use the cloud version.',
    ],
    import_conflict: [
      '这条旧记录已导入过不同版本。请保留副本，避免覆盖。',
      'A different version was already imported. Keep a copy to avoid overwriting it.',
    ],
    record_deleted: [
      '这条记录已删除。当前内容可另存为副本。',
      'This record was deleted. You can save these changes as a new copy.',
    ],
    account_storage_full: [
      '云端空间已满。请先导出，再移除不需要的记录。',
      'Cloud storage is full. Export a backup, then remove records you no longer need.',
    ],
    record_too_large: [
      '这条记录超出保存大小限制。请先导出备份。',
      'This record exceeds the save limit. Export a backup first.',
    ],
    sign_in_required: [
      '登录已过期。重新登录同一邮箱即可继续同步。',
      'Your session expired. Sign in with the same email to resume syncing.',
    ],
    conversation_not_saved: [
      '本轮尚未保存到云端。请先处理待同步记录，再继续对话。',
      'This turn has not been saved. Resolve pending changes before continuing.',
    ],
    fresh_sign_in_required: [
      '删除账号前，请重新验证一次邮箱。',
      'Verify your email again before deleting your account.',
    ],
    pending_before_signout: [
      '还有未同步的内容。请重试、导出，或明确舍弃后再退出。',
      'There are unsynced changes. Retry, export, or discard them before signing out.',
    ],
    export_changed: [
      '导出期间记录有变化，请重新导出以获取完整版本。',
      'Records changed during export. Please export again for a consistent backup.',
    ],
    accounts_unavailable: [
      '账号功能暂不可用，仍可免费试用并导出结果。',
      'Accounts are temporarily unavailable. You can still try the tools and export results.',
    ],
    accounts_maintenance: [
      '云端记录正在维护，稍后即可恢复。',
      'Cloud history is undergoing maintenance. Please try again shortly.',
    ],
    cloud_history_paused: [
      '云端保存已暂停，可在账号设置中开启。',
      'Cloud history is paused. Enable it in account settings.',
    ],
  };
  return (
    messages[code]?.[zh ? 0 : 1] ||
    (zh
      ? '本次操作未完成，内容仍保留。请重试。'
      : 'This action did not finish. Your content is retained. Please retry.')
  );
};
type ImportItem = AccountIntent;
export default function AccountPanel({ locale }: { locale: Locale }) {
  const zh = locale === 'zh',
    t = (a: string, b: string) => (zh ? a : b);
  const state = useSyncExternalStore(subscribeAccount, accountSnapshot, accountServerSnapshot);
  const dialog = useRef<HTMLDialogElement>(null),
    intent = useRef<ImportItem | undefined>(undefined),
    entry = useRef<AccountEntry>('account-header'),
    returnFocus = useRef<HTMLElement | null>(null),
    generation = useRef(0),
    inFlight = useRef(false);
  const [saveIntent, setSaveIntent] = useState<ImportItem>(),
    [savedNotice, setSavedNotice] = useState('');
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(''),
    [otp, setOtp] = useState(''),
    [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [cooldown, setCooldown] = useState(0);
  const [imports, setImports] = useState<ImportItem[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(''),
    [reauth, setReauth] = useState(false);
  function closePanel() {
    generation.current++;
    intent.current = undefined;
    setSaveIntent(undefined);
    setOpen(false);
    setError('');
    setNotice('');
    setOtp('');
    setStage('email');
    setReauth(false);
    setDeleting(false);
    setConfirmation('');
    setSelected([]);
    requestAnimationFrame(() => {
      const previous = returnFocus.current;
      if (previous?.isConnected && !previous.matches(':disabled') && previous.getClientRects().length)
        previous.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('[data-account-return-focus]')?.focus({ preventScroll: true });
    });
  }
  useEffect(() => {
    void initializeAccount();
    const show = (e: Event) => {
      const request = (e as CustomEvent<AccountOpenRequest>).detail;
      generation.current++;
      intent.current = request?.intent;
      entry.current = request?.entry ?? 'account-header';
      setSaveIntent(request?.intent);
      returnFocus.current = document.activeElement as HTMLElement | null;
      setError('');
      setNotice('');
      setOpen(true);
    };
    window.addEventListener('wenbu:account-open', show);
    return () => window.removeEventListener('wenbu:account-open', show);
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      if (!accountSnapshot().user) track('registration_prompt_viewed', { action: entry.current });
      dialog.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
      setImports(
        (['journal', 'session'] as const).flatMap((kind) =>
          (guestRecords(kind) as ImportItem['content'][])
            .filter((c) => c && typeof c.id === 'string')
            .map((content) => ({ kind, content })),
        ),
      );
    } else dialog.current?.close();
    window.dispatchEvent(new CustomEvent('wenbu:account-dialog', { detail: { open } }));
    return () => {
      if (open) window.dispatchEvent(new CustomEvent('wenbu:account-dialog', { detail: { open: false } }));
    };
  }, [open]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [savedNotice]);
  async function action(fn: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    const attempt = generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      if (attempt === generation.current)
        setError(accountError(e instanceof AccountClientError ? e.code : 'connection_failed', zh));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function sendCode() {
    await action(async () => {
      const attempt = generation.current;
      track('auth_started', { action: entry.current });
      await accountRequest('/api/auth/email-otp/send-verification-otp', 'POST', {
        email: email.trim().toLowerCase(),
        type: 'sign-in',
      });
      if (attempt !== generation.current) return;
      setStage('code');
      setOtp('');
      setCooldown(60);
      setNotice(
        t(
          '邮件服务已接收请求，请检查收件箱及垃圾邮件。',
          'The email service accepted your request. Check your inbox and spam folder.',
        ),
      );
    });
  }
  async function verify() {
    await action(async () => {
      const attempt = generation.current;
      const selectedIntent = intent.current;
      const old = accountSnapshot().user;
      if (old && old.email.toLowerCase() !== email.trim().toLowerCase())
        throw new AccountClientError('pending_before_signout');
      await accountRequest('/api/auth/sign-in/email-otp', 'POST', { email: email.trim().toLowerCase(), otp });
      // Claim before new reads, so trial usage cannot be reset by signing in.
      await accountRequest('/api/account/claim', 'POST', {});
      await initializeAccount(true);
      try {
        localStorage.setItem('wenbu.account.changed', crypto.randomUUID());
      } catch {
        /* Account is already verified. */
      }
      if (attempt !== generation.current) return;
      if (selectedIntent) {
        await importRecord(selectedIntent.kind, selectedIntent.content, 'current');
        if (attempt !== generation.current) return;
        intent.current = undefined;
        setSavedNotice(t('这次探索已保存到你的账号。', 'This reading is saved to your account.'));
        window.dispatchEvent(
          new CustomEvent('wenbu:record-saved', {
            detail: { kind: selectedIntent.kind, id: selectedIntent.content.id },
          }),
        );
        closePanel();
        return;
      }
      setReauth(false);
      setStage('email');
      setOtp('');
      setNotice(
        t(
          '已登录。可以在其他设备继续查看已同步的记录。',
          'You’re signed in. Synced records are available on your other devices.',
        ),
      );
    });
  }
  return (
    <>
      <button
        className="account-trigger"
        onClick={(event) => {
          generation.current++;
          intent.current = undefined;
          entry.current = 'account-header';
          setSaveIntent(undefined);
          returnFocus.current = event.currentTarget;
          setError('');
          setNotice('');
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={t('账号与云端记录', 'Account and cloud history')}
      >
        <UserRound size={17} />
        <span>{state.user ? t('账号', 'Account') : t('登录', 'Sign in')}</span>
        {state.pending > 0 && <i aria-label={t('有待同步内容', 'Changes pending')} />}
      </button>
      <dialog
        ref={dialog}
        className="account-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closePanel();
        }}
        onClose={() => {
          if (open) closePanel();
        }}
        aria-labelledby="account-title"
        data-clarity-mask="true"
      >
        <button className="account-close icon-button" aria-label={t('关闭', 'Close')} onClick={closePanel}>
          <X size={20} />
        </button>
        <div className="account-seal" aria-hidden="true">
          留
        </div>
        <span className="eyebrow">WENBU · {t('让探索有迹可循', 'A PLACE TO RETURN TO')}</span>
        <h2 id="account-title">
          {saveIntent && !state.user
            ? t(
                '保存这次探索',
                saveIntent.kind === 'session' ? 'Save this conversation' : 'Save this reading',
              )
            : state.user
              ? t('你的探索，妥善留存。', 'Your reflections, kept together.')
              : t('先探索，再留住有用的答案。', 'Explore first. Keep what matters.')}
        </h2>
        {!state.user || reauth ? (
          <>
            <p className="account-intro">
              {saveIntent
                ? t(
                    '验证邮箱后保存本次记录，换个设备也能继续。你的原结果会保留。',
                    'Verify your email to save this record and return on another device. Your result stays as it is.',
                  )
                : t(
                    '无需注册也能获得完整结果。用邮箱登录后，保存手记和对话，在不同设备间继续。',
                    'Get a complete result without signing up. Sign in with your email to save readings and conversations across devices.',
                  )}
            </p>
            {saveIntent && (
              <div className="account-save-summary">
                <BookmarkPreview kind={saveIntent.kind} zh={zh} />
                <span>
                  {saveIntent.label ||
                    saveIntent.content.title ||
                    saveIntent.content.question ||
                    t('本次探索', 'Your current reading')}
                </span>
              </div>
            )}
            <div className="account-benefits">
              <span>
                <Cloud size={16} />
                {t('云端记录', 'Cloud history')}
              </span>
              <span>
                <ShieldCheck size={16} />
                {t('随时导出或删除', 'Export or delete anytime')}
              </span>
            </div>
            {!state.ready ? (
              <p role="status">{t('正在连接账号服务…', 'Connecting to account service…')}</p>
            ) : !state.enabled ? (
              <p className="form-note">{accountError('accounts_unavailable', zh)}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void (stage === 'email' ? sendCode() : verify());
                }}
              >
                {stage === 'email' ? (
                  <label className="field">
                    {t('邮箱地址', 'Email address')}
                    <div className="account-input">
                      <Mail size={17} />
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoFocus
                      />
                    </div>
                  </label>
                ) : (
                  <>
                    <p className="form-note">
                      {t('验证码将发送至', 'Your code goes to')} <strong>{email}</strong>{' '}
                      <button type="button" className="text-button" onClick={() => setStage('email')}>
                        {t('更换', 'Change')}
                      </button>
                    </p>
                    <label className="field">
                      {t('6 位验证码', '6-digit code')}
                      <input
                        className="account-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        autoFocus
                      />
                    </label>
                    <p className="form-note">
                      {t(
                        '5 分钟内有效。重发后请使用最新的验证码。',
                        'Valid for 5 minutes. If you request another code, use the latest one.',
                      )}
                    </p>
                  </>
                )}
                <button className="button primary account-submit" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="account-spin" size={17} />
                  ) : stage === 'email' ? (
                    <Mail size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}{' '}
                  {stage === 'email'
                    ? t('发送验证码', 'Send code')
                    : saveIntent
                      ? t('验证并保存', 'Verify and save')
                      : t('验证并继续', 'Verify and continue')}
                </button>
                {stage === 'code' && (
                  <button
                    type="button"
                    className="text-button account-resend"
                    disabled={busy || cooldown > 0}
                    onClick={() => void sendCode()}
                  >
                    {cooldown > 0
                      ? t(`${cooldown} 秒后可重发`, `Resend in ${cooldown}s`)
                      : t('重新发送', 'Resend code')}
                  </button>
                )}
              </form>
            )}
            <p className="account-fine">
              {t(
                '首次验证邮箱会创建账号。不设密码，不订阅推广邮件。',
                'Verifying a new email creates your account. No password, no marketing subscription.',
              )}{' '}
              <a href={zh ? '/privacy/' : '/en/privacy/'}>{t('隐私说明', 'Privacy')}</a>
            </p>
            {saveIntent && (
              <p className="account-fine">
                {t(
                  '新账号的后续对话默认同步，可在账号中关闭。旧记录只导入你选择的部分。',
                  'New accounts sync future conversations by default; you can turn this off. Older records are imported only when you choose them.',
                )}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="account-email">
              <Check size={16} />
              {state.user.email}
            </p>
            <div className="account-storage">
              <div>
                <Cloud size={17} />
                <span>{t('云端空间', 'Cloud storage')}</span>
                <span>
                  {state.storage.used < 1048576
                    ? `${Math.ceil(state.storage.used / 1024)} KB`
                    : `${(state.storage.used / 1048576).toFixed(1)} MB`}{' '}
                  / 10 MB
                </span>
              </div>
              <meter min={0} max={state.storage.limit} value={state.storage.used} />
            </div>
            <label className="account-toggle">
              <input
                type="checkbox"
                checked={state.cloudHistory}
                disabled={busy}
                onChange={(e) =>
                  void action(async () => {
                    await accountRequest('/api/account/preferences', 'PATCH', {
                      cloudHistory: e.target.checked,
                    });
                    await initializeAccount(true);
                  })
                }
              />
              <span>
                {t('保存接下来的对话和手记', 'Save future conversations and journal entries')}
                <small>
                  {t(
                    '暂停后，新内容只留在当前浏览器；已有云端记录不变。',
                    'When paused, new content stays in this browser. Existing cloud records are retained.',
                  )}
                </small>
              </span>
            </label>
            <div className="account-actions">
              <button className="button secondary" disabled={busy} onClick={() => void action(exportAccount)}>
                <Download size={16} />
                {t('导出账号记录', 'Export account data')}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await accountRequest('/api/auth/revoke-other-sessions', 'POST', {});
                    setNotice(t('已退出其他登录会话。', 'Other sessions have been signed out.'));
                  })
                }
              >
                <ShieldCheck size={16} />
                {t('退出其他会话', 'Sign out other sessions')}
              </button>
            </div>
            {state.temporary > 0 && (
              <section className="account-pending">
                <h3>
                  {t(`${state.temporary} 条仅在此浏览器的改动`, `${state.temporary} browser-only changes`)}
                </h3>
                <p>
                  {t(
                    '暂停保存期间的内容不会因重新开启而自动上传。继续编辑某条记录时，才会同步那条记录。退出前请导出，或明确舍弃。',
                    'Changes made while cloud history was paused are not uploaded automatically. Editing a record after resuming will sync that record. Export or discard these changes before signing out.',
                  )}
                </p>
                <div className="account-actions">
                  <button className="text-button" onClick={exportTemporary}>
                    {t('导出浏览器内的改动', 'Export browser-only changes')}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void action(discardTemporary)}
                  >
                    {t('舍弃这些本地改动', 'Discard these local changes')}
                  </button>
                </div>
              </section>
            )}
            {state.error && !state.pending && (
              <section className="account-pending" role="status">
                <p>{accountError(state.error, zh)}</p>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void action(() => initializeAccount(true))}
                >
                  {t('重新连接云端记录', 'Reconnect cloud history')}
                </button>
              </section>
            )}
            {state.pending > 0 && (
              <section className="account-pending" aria-label={t('待同步记录', 'Pending changes')}>
                <h3>{t(`${state.pending} 条待同步`, `${state.pending} pending changes`)}</h3>
                <p>
                  {state.error
                    ? accountError(state.error, zh)
                    : t('正在保存你的改动，请稍候。', 'Saving your changes. Please wait a moment.')}
                </p>
                <div className="account-actions">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await retryAccount();
                      })
                    }
                  >
                    <RefreshCw size={14} />
                    {t('重试同步', 'Retry sync')}
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      downloadAccount(
                        { owner: state.user!.id, pending: pendingRecords() },
                        'wenbu-unsynced.json',
                      )
                    }
                  >
                    <Download size={14} />
                    {t('导出未同步内容', 'Export unsynced changes')}
                  </button>
                </div>
                {pendingRecords().map((p) => (
                  <div className="account-conflict" key={p.requestId}>
                    <span>
                      {p.kind === 'journal' ? t('手记', 'Journal') : t('对话', 'Conversation')} ·{' '}
                      {p.id.slice(0, 8)}
                    </span>
                    {p.error && <small>{accountError(p.error, zh)}</small>}
                    <div>
                      {!!p.content && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void action(() => resolvePending(p.requestId, 'copy'))}
                        >
                          {t('保留为副本', 'Keep as a copy')}
                        </button>
                      )}
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void action(() => resolvePending(p.requestId, 'discard'))}
                      >
                        {t('舍弃本地改动', 'Discard local changes')}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {imports.length > 0 && (
              <details className="account-import">
                <summary>
                  {t(
                    `导入这个浏览器的旧记录（${imports.length}）`,
                    `Import this browser’s history (${imports.length})`,
                  )}
                </summary>
                <p className="form-note">
                  {t(
                    '仅上传你勾选的记录。每批最多 20 条；原有本地副本会保留。',
                    'Only selected records are uploaded, up to 20 at a time. Local copies are retained.',
                  )}
                </p>
                <div className="account-import-list">
                  {imports.map((i) => (
                    <label key={i.kind + i.content.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(i.kind + i.content.id)}
                        disabled={!selected.includes(i.kind + i.content.id) && selected.length >= 20}
                        onChange={(e) =>
                          setSelected((v) =>
                            e.target.checked
                              ? [...v, i.kind + i.content.id]
                              : v.filter((k) => k !== i.kind + i.content.id),
                          )
                        }
                      />
                      <span>
                        {i.content.title || i.content.question || t('一次探索', 'An exploration')}
                        <small>
                          {(i.content.createdAt || i.content.updatedAt || '').slice(0, 10)} ·{' '}
                          {i.kind === 'journal' ? t('手记', 'Journal') : t('对话', 'Chat')}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  className="button secondary"
                  disabled={busy || !selected.length}
                  onClick={() =>
                    void action(async () => {
                      const chosen = imports.filter((i) => selected.includes(i.kind + i.content.id));
                      if (new TextEncoder().encode(JSON.stringify(chosen)).length > 1048576)
                        throw new AccountClientError('record_too_large');
                      for (const i of chosen) await importRecord(i.kind, i.content);
                      setSelected([]);
                      setNotice(
                        t(
                          '已处理所选记录；如有冲突，请查看待同步列表。',
                          'Selected records processed. Check pending changes for any conflicts.',
                        ),
                      );
                    })
                  }
                >
                  {t('导入所选记录', 'Import selected records')}
                </button>
              </details>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEmail(state.user!.email);
                setStage('email');
                setReauth(true);
              }}
            >
              {t('重新验证邮箱', 'Verify email again')}
            </button>
            <div className="account-bottom">
              <button className="text-button" disabled={busy} onClick={() => void action(signOut)}>
                <LogOut size={15} />
                {t('退出登录', 'Sign out')}
              </button>
              <button className="text-button" disabled={busy} onClick={() => setDeleting((v) => !v)}>
                {t('删除账号', 'Delete account')}
              </button>
            </div>
            {deleting && (
              <form
                className="account-delete"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await accountRequest('/api/account/delete', 'POST', { confirmation });
                    await finishDeletedAccount();
                    setDeleting(false);
                  });
                }}
              >
                <p>
                  {t(
                    '这会删除账号及全部云端正文，且无法在产品中恢复。先导出需要保留的记录，再输入 DELETE。',
                    'This deletes your account and all cloud content, with no in-product undo. Export anything you need, then type DELETE.',
                  )}
                </p>
                <input
                  aria-label={t('输入 DELETE 确认', 'Type DELETE to confirm')}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
                <button className="button secondary" disabled={busy || confirmation !== 'DELETE'}>
                  {t('确认删除账号', 'Delete my account')}
                </button>
              </form>
            )}
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        <button className="text-button account-continue" onClick={closePanel}>
          {state.user
            ? t('继续探索', 'Continue exploring')
            : saveIntent
              ? t('暂不保存到账号，继续浏览', 'Keep exploring without cloud save')
              : t('先免费试用', 'Continue without an account')}{' '}
          <ArrowRight size={15} />
        </button>
      </dialog>
      <div className="account-saved-toast" role="status" aria-live="polite">
        {savedNotice && (
          <>
            <Check size={17} />
            {savedNotice}
          </>
        )}
      </div>
    </>
  );
}

function BookmarkPreview({ kind, zh }: { kind: RecordKind; zh: boolean }) {
  return (
    <small>
      {kind === 'session'
        ? zh
          ? '当前对话与结果'
          : 'Conversation and results'
        : zh
          ? '当前手记'
          : 'Current reading'}
    </small>
  );
}
