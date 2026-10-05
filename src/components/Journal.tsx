import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, Trash2, ArrowUpRight, Search } from 'lucide-react';
import { readJournal, writeJournal, downloadJson, type Entry } from '../lib/journal';
import { choose, href, toolInfo } from '../lib/i18n';
import type { Locale } from '../lib/schema';
import ReadingView from './ReadingView';
import CloudSaveStatus from './CloudSaveStatus';
import RecordBoundary from './RecordBoundary';
import { initializeAccount } from '../lib/account-client';
export default function Journal({ locale }: { locale: Locale }) {
  const t = (zh: string, en: string) => choose(locale, zh, en);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState<Entry | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (mounted) {
        setEntries(readJournal());
        setActive(null);
        setRemoved(null);
        setReady(true);
      }
    };
    void initializeAccount().then(load);
    window.addEventListener('wenbu:account-changed', load);
    window.addEventListener('wenbu:records-changed', load);
    return () => {
      mounted = false;
      window.removeEventListener('wenbu:account-changed', load);
      window.removeEventListener('wenbu:records-changed', load);
    };
  }, []);
  function update(list: Entry[]) {
    try {
      writeJournal(list);
      setEntries(list);
      setError('');
    } catch {
      setError(t('保存失败，请导出备份。', 'Storage failed. Please export a backup.'));
    }
  }
  const filtered = entries.filter((e) =>
    `${e.question} ${e.note} ${e.answer?.title || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const current = entries.find((e) => e.id === active);
  return (
    <div className="journal-app">
      <div className="journal-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            ref={searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索问题或笔记', 'Search questions or notes')}
            aria-label={t('搜索手记', 'Search journal')}
          />
        </label>
        <button
          className="button secondary"
          disabled={!entries.length}
          onClick={() => downloadJson({ version: 1, entries }, 'wenbu-journal.json')}
        >
          <Download size={16} />
          {t('导出全部', 'Export all')}
        </button>
      </div>
      <CloudSaveStatus locale={locale} />
      <p className="form-note">
        {t(
          '云端保存状态可在账号中查看。导出文件包含你选择保留的个人资料，请妥善存放。',
          'Check sync status in your account. Exports contain the personal details you chose to keep; store them safely.',
        )}
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {removed && (
        <div className="undo-notice" role="status">
          {t('已从手记移除。', 'Removed from journal.')}
          <button
            className="text-button"
            onClick={() => {
              update([{ ...removed, id: crypto.randomUUID() }, ...entries]);
              setRemoved(null);
            }}
          >
            {t('恢复为副本', 'Restore as a copy')}
          </button>
        </div>
      )}
      {!ready ? (
        <p role="status">{t('正在打开手记…', 'Opening your journal…')}</p>
      ) : !entries.length ? (
        <div className="journal-empty">
          <Bookmark size={32} strokeWidth={1} />
          <h2>{t('有些答案，值得过一阵再看。', 'Some answers are worth returning to.')}</h2>
          <p>
            {t(
              '保存一次探索，记下当时的想法。未来的你，会有自己的发现。',
              'Save a reading and a note about how it felt. Your future self may notice something new.',
            )}
          </p>
          <a className="button primary" href={href(locale, 'bazi')}>
            {t('开始我的第一次探索', 'Begin a first reading')}
            <ArrowUpRight size={16} />
          </a>
        </div>
      ) : (
        <div className="journal-grid">
          <div className="journal-list">
            {filtered.map((e) => (
              <div className={`journal-entry ${active === e.id ? 'active' : ''}`} key={e.id}>
                <button className="entry-open" onClick={() => setActive(e.id)}>
                  <span className="eyebrow">
                    {t(toolInfo[e.kind].zh, toolInfo[e.kind].en)} ·{' '}
                    {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
                      month: 'short',
                      day: 'numeric',
                    }).format(new Date(e.createdAt))}
                  </span>
                  <h3>{e.answer?.title || e.question || t('一次新的探索', 'A new perspective')}</h3>
                  <p>{e.note || e.answer?.summary || t('查看命盘与记录', 'Open the chart and notes')}</p>
                </button>
                <button
                  className="icon-button"
                  aria-label={t('移除这条手记', 'Remove this entry')}
                  onClick={() => {
                    update(entries.filter((x) => x.id !== e.id));
                    setRemoved(e);
                    if (active === e.id) setActive(null);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {!filtered.length && (
              <div>
                <p role="status">{t('没有匹配的手记。', 'No matching entries.')}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setQuery('');
                    searchInput.current?.focus();
                  }}
                >
                  {t('清除搜索，查看全部', 'Clear search and show all')}
                </button>
              </div>
            )}
          </div>
          <div className="journal-detail">
            {current ? (
              <>
                {current.question && (
                  <div className="reflection-callout">
                    <span>{t('当时的问题', 'YOUR ORIGINAL QUESTION')}</span>
                    <p>{current.question}</p>
                  </div>
                )}
                <RecordBoundary key={current.id} locale={locale}>
                  <ReadingView result={current.result} locale={locale} />
                </RecordBoundary>
                {current.answer && (
                  <div className="ai-reading">
                    <span className="eyebrow">{t('AI 生成的象征性解读', 'AI-GENERATED REFLECTION')}</span>
                    <h2>{current.answer.title}</h2>
                    <p>{current.answer.summary}</p>
                    {current.answer.observations.map((o, i) => (
                      <div key={i}>
                        <h3>{o.basis}</h3>
                        <p>{o.reflection}</p>
                      </div>
                    ))}
                    <ul>
                      {current.answer.nextSteps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <blockquote>{current.answer.question}</blockquote>
                    {current.provenance && <p className="form-note">DeepSeek · {current.provenance}</p>}
                    {current.context && (
                      <details className="context-details">
                        <summary>{t('当时选择分享的背景', 'Context shared with this reading')}</summary>
                        <p>{current.context}</p>
                      </details>
                    )}
                  </div>
                )}
                <label className="field">
                  {t('回看时的笔记', 'Your reflection now')}
                  <textarea
                    rows={4}
                    maxLength={1200}
                    value={current.note}
                    onChange={(e) =>
                      update(entries.map((x) => (x.id === current.id ? { ...x, note: e.target.value } : x)))
                    }
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadJson(current, `wenbu-${current.kind}-${current.id.slice(0, 8)}.json`)
                  }
                >
                  <Download size={16} />
                  {t('导出这条手记', 'Export this entry')}
                </button>
              </>
            ) : (
              <div className="journal-empty">
                <Bookmark size={28} strokeWidth={1} />
                <p>{t('选择一条手记，重新看见当时的自己。', 'Open an entry and revisit that moment.')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
