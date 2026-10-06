import { useEffect, useState } from 'react';
import { agentActivity, type AgentPhase } from '../lib/agent-activity';
import type { AgentMessage } from '../lib/agent-protocol';
import type { Locale } from '../lib/schema';

const words: Record<AgentPhase, [string, string, string, string]> = {
  clarifying: [
    '把问题问清楚',
    'Finding the missing detail',
    '正在整理需要你补充的信息',
    'Preparing a question for you',
  ],
  opening: ['问已落纸', 'A question, set in ink', '正在回应你的提问', 'Your turn is starting'],
  reading: [
    '循迹参照',
    'Following the sources',
    '正在查阅资料，保留可追溯的出处',
    'Reading material and keeping its sources',
  ],
  calculating: [
    '依序推演',
    'Finding the structure',
    '排盘工具正在计算原始结构',
    'The calculation tool is working',
  ],
  drawing: [
    '此刻成象',
    'A reading takes shape',
    '正在整理卦象或牌面的原始结果',
    'Preparing the original lines or cards for this reading',
  ],
  composing: ['落笔成章', 'Taking shape on paper', '正在整理研究报告', 'Preparing the research note'],
  responding: [
    '续写这一问',
    'Bringing it together',
    '正在补充说明，已生成的结果可随时查看',
    'Finishing the response; received results are ready to view',
  ],
  continuing: [
    '沿着线索继续',
    'Following the thread',
    '上一步已返回，等待下一步回复',
    'The last step has returned; awaiting the next response',
  ],
  revisiting: [
    '调整，再继续',
    'Considering the next step',
    '上次尝试未成功，正在继续处理',
    'The last attempt failed; the turn is still active',
  ],
  waiting: [
    '留一处，待你补充',
    'A detail from you',
    '补充下面的信息，再继续这一问',
    'Add the requested detail to continue',
  ],
  settled: [
    '这一问，已留成记录',
    'A note to return to',
    '本回合已结束，过程与结果均保留',
    'This turn has ended; its activity and results are retained',
  ],
  interrupted: [
    '暂歇于此',
    'Pausing here',
    '本回合未完成，已收到的内容仍保留',
    'This turn is unfinished; received content is retained',
  ],
};

export function useAgentMotion() {
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    update();
    try {
      setPaused(localStorage.getItem('wenbu.agent.motion') === 'paused');
    } catch {
      /* Optional preference. */
    }
    media.addEventListener('change', update);
    setReady(true);
    return () => media.removeEventListener('change', update);
  }, []);
  function toggle() {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem('wenbu.agent.motion', next ? 'paused' : 'on');
    } catch {
      /* Works for this visit. */
    }
  }
  return { reduced: !ready || paused || systemReduced, systemReduced, ready, toggle };
}

function RitualMark({ phase, instrument }: { phase: AgentPhase; instrument?: string }) {
  const resting = ['waiting', 'settled', 'interrupted'].includes(phase);
  return (
    <svg className="agent-ritual-mark" viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
      <circle className="ritual-orbit-line" cx="48" cy="48" r="40" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <path key={angle} d="M48 5v5" transform={`rotate(${angle} 48 48)`} className="ritual-tick" />
      ))}
      {!resting && (
        <g className="ritual-traveller">
          <circle cx="48" cy="8" r="2.1" />
          <path d="M48 8a40 40 0 0 1 20 5.36" />
        </g>
      )}
      <g className="ritual-symbol" key={`${phase}:${instrument ?? ''}`}>
        {phase === 'reading' ? (
          <g className="ritual-pages">
            <path d="M25 32l19-3 6 32-19 3z" />
            <path d="M37 27l22 1-1 36-22-1z" />
            <g className="ritual-page-front">
              <path d="M48 28l23 6-9 34-23-6z" />
              <path d="M52 39l12 3m-14 4 12 3m-14 4 8 2" />
            </g>
          </g>
        ) : phase === 'calculating' && instrument === 'calculate_ziwei' ? (
          <g className="ritual-palaces">
            {[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15].map((cell) => (
              <rect
                key={cell}
                x={29 + (cell % 4) * 10}
                y={29 + Math.floor(cell / 4) * 10}
                width="7"
                height="7"
              />
            ))}
            <text x="47.5" y="53" textAnchor="middle">
              紫
            </text>
          </g>
        ) : phase === 'calculating' ? (
          <g className="ritual-pillars">
            {[27, 39, 51, 63].map((x, i) => (
              <g key={x} className={`ritual-pillar ritual-pillar-${i}`}>
                <path d={`M${x} 28v39`} />
                <path d={`M${x - 3} 36h6m-6 20h6`} />
              </g>
            ))}
          </g>
        ) : phase === 'drawing' ? (
          instrument === 'draw_tarot' ? (
            <g className="ritual-cards">
              <rect x="29" y="30" width="23" height="34" rx="1" transform="rotate(-12 40 47)" />
              <rect x="43" y="28" width="23" height="34" rx="1" transform="rotate(12 54 45)" />
              <path d="M54 37v16m-6-8h12" />
            </g>
          ) : (
            <g className="ritual-coins">
              <circle cx="48" cy="29" r="10" />
              <circle cx="35" cy="46" r="11" />
              <circle cx="60" cy="47" r="11" />
              <path d="M45 26h6v6h-6zM32 43h6v6h-6zm25 1h6v6h-6z" />
            </g>
          )
        ) : ['composing', 'responding', 'continuing'].includes(phase) ? (
          <g className="ritual-writing">
            <path d="M30 27h28l8 8v34H30zM58 27v10h8" />
            <path className="ritual-ink-line" d="M38 45h19m-19 8h19m-19 8h12" />
            <path className="ritual-pen" d="M68 24L47 50l-6 3 2-7 21-26z" />
          </g>
        ) : (
          <g className="ritual-impression">
            <rect x="31" y="31" width="34" height="34" />
            <rect x="34" y="34" width="28" height="28" />
            <text x="48" y="54" textAnchor="middle">
              {phase === 'settled' ? '录' : phase === 'interrupted' ? '止' : '问'}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export default function AgentRitual({ message, locale }: { message: AgentMessage; locale: Locale }) {
  const { phase, instrument } = agentActivity(message);
  const zh = locale === 'zh';
  const active = !['waiting', 'settled', 'interrupted'].includes(phase);
  const [titleZh, titleEn, detailZh, detailEn] = words[phase];
  return (
    <div className="agent-ritual" data-phase={phase} data-active={active}>
      <RitualMark phase={phase} instrument={instrument} />
      <div className="agent-ritual-copy">
        <div className="agent-ritual-label">
          <span />
          {zh ? '问卜 · 此刻' : 'WENBU · THIS MOMENT'}
        </div>
        <p className="agent-ritual-title" role="status" aria-live="polite" aria-atomic="true">
          {zh ? titleZh : titleEn}
        </p>
        <p className="agent-ritual-detail">{zh ? detailZh : detailEn}</p>
        {(message.sources.length > 0 || message.artifacts.length > 0) && (
          <div className="agent-ritual-facts">
            {message.sources.length > 0 && (
              <span key={`sources-${message.sources.length}`}>
                {zh
                  ? `已读 ${message.sources.length} 份资料`
                  : `${message.sources.length} ${message.sources.length === 1 ? 'source' : 'sources'} read`}
              </span>
            )}
            {message.artifacts.length > 0 && (
              <span key={`results-${message.artifacts.length}`}>
                {zh
                  ? `已有 ${message.artifacts.length} 份结果`
                  : `${message.artifacts.length} ${message.artifacts.length === 1 ? 'result' : 'results'} received`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
