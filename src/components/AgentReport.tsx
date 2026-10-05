import { useId, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  GitCompareArrows,
  ListOrdered,
  ScrollText,
} from 'lucide-react';
import type { ReportArtifact, AgentSource } from '../lib/agent-protocol';
import { readReportVisual, reportSourceIds, type ReportVisual } from '../lib/agent-report';
import type { Locale } from '../lib/schema';
import AgentMarkdown from './AgentMarkdown';
import InstrumentGlyph from './InstrumentGlyph';

function Citations({ ids, sources, locale }: { ids: string[]; sources: AgentSource[]; locale: Locale }) {
  const cited = sources.filter((source) => ids.includes(source.id));
  const missing = [...new Set(ids)].filter((id) => !sources.some((source) => source.id === id)).length;
  return (
    <div className="visual-citations">
      <BookOpen size={12} aria-hidden="true" />
      {cited.length > 0 &&
        cited.map((source) => (
          <a key={source.id} data-track="source" href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
            <ArrowUpRight size={11} />
          </a>
        ))}
      {!ids.length && (
        <span>
          {locale === 'zh'
            ? '本项未附来源，请结合正文判断'
            : 'No source attached to this item; consult the note'}
        </span>
      )}
      {missing > 0 && (
        <span className="citation-unavailable">
          {locale === 'zh'
            ? `${missing} 处引用未能匹配已读资料`
            : `${missing} citation${missing === 1 ? '' : 's'} could not be matched to a read source`}
        </span>
      )}
    </div>
  );
}

function ReportDiagram({
  visual,
  sources,
  locale,
}: {
  visual: ReportVisual;
  sources: AgentSource[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(0);
  const captionId = useId();
  const zh = locale === 'zh';
  const comparison = visual.type === 'comparison';
  const selectedIndex = selected < visual.items.length ? selected : 0;
  return (
    <figure className={`report-diagram diagram-${visual.type}`}>
      <figcaption>
        {comparison ? <GitCompareArrows size={16} /> : <ListOrdered size={16} />}
        <span>{visual.title}</span>
        <small>{comparison ? (zh ? '对照' : 'COMPARE') : zh ? '步骤' : 'SEQUENCE'}</small>
      </figcaption>
      <div className="diagram-items" role="group" aria-label={visual.title}>
        {visual.items.map((item, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={selectedIndex === index}
            aria-label={
              !comparison
                ? `${index + 1}. ${item.label}. ${item.detail}. ${zh ? '查看依据' : 'View sources'}`
                : undefined
            }
            aria-controls={captionId}
            onClick={() => setSelected(index)}
          >
            <span className="diagram-node" aria-hidden="true">
              {comparison ? (
                <svg viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="12" />
                  <path d={index % 2 ? 'M16 4a12 12 0 0 1 0 24z' : 'M16 4a12 12 0 0 0 0 24z'} />
                </svg>
              ) : (
                String(index + 1).padStart(2, '0')
              )}
            </span>
            <span className="diagram-item-copy">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </span>
            <span className="diagram-source-hint">
              <BookOpen size={10} />
              {zh ? '查看依据' : 'Sources'}
              <ArrowRight size={10} />
            </span>
          </button>
        ))}
      </div>
      {visual.note && <p className="diagram-note">{visual.note}</p>}
      <div className="diagram-evidence" id={captionId} aria-live="polite" aria-atomic="true">
        <span>
          {zh
            ? `${visual.items[selectedIndex].label} · 依据`
            : `${visual.items[selectedIndex].label} · sources`}
        </span>
        <Citations ids={visual.items[selectedIndex].sourceIds} sources={sources} locale={locale} />
      </div>
    </figure>
  );
}

export default function AgentReport({
  report,
  sources,
  locale,
  busy,
  onQuestion,
}: {
  report: ReportArtifact;
  sources: AgentSource[];
  locale: Locale;
  busy: boolean;
  onQuestion: (question: string) => void;
}) {
  const [expanded, setExpanded] = useState<number[]>([0]);
  const visual = readReportVisual(report.visual);
  const ids = reportSourceIds(report);
  const sourceCount = sources.filter((source) => ids.includes(source.id)).length;
  const allExpanded = expanded.length === report.sections.length;
  const zh = locale === 'zh';
  return (
    <div className="agent-report visual-report">
      <div className="report-overview">
        <InstrumentGlyph kind="report" size={52} />
        <div>
          <span>{zh ? '这份札记' : 'IN THIS NOTE'}</span>
          <div className="report-overview-counts">
            <span>
              <b>{report.sections.length}</b>
              {zh ? '个章节' : 'sections'}
            </span>
            <span>
              <b>{sourceCount}</b>
              {zh ? '份引用资料' : 'cited sources'}
            </span>
            {visual && (
              <span>
                <b>1</b>
                {zh ? '幅图解' : 'diagram'}
              </span>
            )}
          </div>
        </div>
      </div>
      {visual && <ReportDiagram visual={visual} sources={sources} locale={locale} />}
      <div className="report-abstract">
        <span>
          <ScrollText size={13} />
          {zh ? '概览与边界' : 'OVERVIEW & LIMITS'}
        </span>
        <p className="agent-report-summary">{report.summary}</p>
      </div>
      <div className="report-chapters-heading">
        <span>
          <ScrollText size={14} />
          {zh ? '展开细读' : 'READ THE NOTE'}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(allExpanded ? [] : report.sections.map((_, index) => index))}
        >
          {allExpanded ? (zh ? '收起全文' : 'Collapse all') : zh ? '展开全文' : 'Expand all'}
        </button>
      </div>
      <div className="report-chapters">
        {report.sections.map((section, index) => (
          <details key={index} className="report-chapter" open={expanded.includes(index)}>
            <summary
              onClick={(event) => {
                event.preventDefault();
                setExpanded((current) =>
                  current.includes(index) ? current.filter((value) => value !== index) : [...current, index],
                );
              }}
            >
              <span className="chapter-index">{String(index + 1).padStart(2, '0')}</span>
              <h3>{section.heading}</h3>
              <ChevronDown size={14} />
            </summary>
            <div className="chapter-body">
              <div className="agent-prose">
                <AgentMarkdown text={section.body} allowedUrls={sources.map((source) => source.url)} />
              </div>
              <Citations ids={section.sourceIds} sources={sources} locale={locale} />
            </div>
          </details>
        ))}
      </div>
      {report.questions.length > 0 && (
        <div className="agent-report-questions">
          <span className="eyebrow">{zh ? '点选继续追问' : 'CHOOSE A FOLLOW-UP'}</span>
          {report.questions.map((question) => (
            <button key={question} disabled={busy} onClick={() => onQuestion(question)}>
              {question}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
