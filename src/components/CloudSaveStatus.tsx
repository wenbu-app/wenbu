import { useEffect, useSyncExternalStore } from 'react';
import { Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import { accountSnapshot, subscribeAccount, initializeAccount, openAccount } from '../lib/account-client';
import type { Locale } from '../lib/schema';
import type { RecordKind } from '../lib/account-protocol';
export default function CloudSaveStatus({
  locale,
  intent,
}: {
  locale: Locale;
  intent?: { kind: RecordKind; content: { id: string } };
}) {
  const state = useSyncExternalStore(subscribeAccount, accountSnapshot, accountSnapshot),
    zh = locale === 'zh';
  useEffect(() => {
    void initializeAccount();
  }, []);
  const Icon = state.syncing ? LoaderCircle : state.user && state.cloudHistory ? Cloud : CloudOff;
  return (
    <button
      type="button"
      className="cloud-save-status"
      onClick={() => openAccount(!state.user ? intent : undefined)}
      aria-live="polite"
    >
      <Icon size={15} className={state.syncing ? 'account-spin' : ''} />
      <span>
        {!state.ready
          ? zh
            ? '读取保存状态…'
            : 'Checking save status…'
          : state.user
            ? state.pending
              ? zh
                ? `${state.pending} 条待同步`
                : `${state.pending} changes pending`
              : state.error
                ? zh
                  ? '保存状态需要检查'
                  : 'Check your save status'
                : state.temporary
                  ? zh
                    ? `${state.temporary} 条仅在此浏览器`
                    : `${state.temporary} browser-only changes`
                  : state.cloudHistory
                    ? zh
                      ? '云端记录已连接'
                      : 'Cloud history connected'
                    : zh
                      ? '仅保存于此浏览器'
                      : 'Saved in this browser only'
            : zh
              ? '试用记录在此浏览器 · 登录可保存到云端'
              : 'Trial history stays here · Sign in to save to the cloud'}
      </span>
    </button>
  );
}
