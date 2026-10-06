import type { Reading } from './tools';
import type { Locale, ToolKind } from './schema';
import type { ReportVisual } from './agent-report';

export const AGENT_MODEL_CALLS = 5;
export const AGENT_TOOL_CALLS = 12;
export const AGENT_BODY_LIMIT = 96 * 1024;
export type AgentMode = 'explore' | 'research';
export type ReadingInput = { kind: ToolKind; input: unknown };
export type AgentBirth = {
  date: string;
  time: string | null;
  timezone: string;
  dayBoundary: 'midnight' | 'zi';
  solarTime: boolean;
  longitude?: number;
  sex?: 'male' | 'female';
};
export type AgentContext = {
  note: string;
  birth?: AgentBirth;
  readings: ReadingInput[];
  reports?: Pick<ReportArtifact, 'title' | 'summary' | 'sections' | 'questions' | 'visual'>[];
  sourceIds: string[];
};
export type AgentSource = {
  id: string;
  title: string;
  url: string;
  kind: 'guide' | 'reference' | 'symbol';
  level: string;
  excerpt: string;
  readAt: string;
};
export type PlanStep = { title: string; status: 'pending' | 'active' | 'complete' };
export type AgentQuestion = {
  question: string;
  options: string[];
  form?: 'birth';
  birthKind?: 'bazi' | 'ziwei';
};
export type ChartArtifact = {
  type: 'chart';
  id: string;
  title: string;
  createdAt: string;
  reading: Reading;
  input: ReadingInput;
};
export type ReportArtifact = {
  type: 'report';
  id: string;
  title: string;
  createdAt: string;
  summary: string;
  sections: { heading: string; body: string; sourceIds: string[] }[];
  questions: string[];
  visual?: ReportVisual;
};
export type AgentArtifact = ChartArtifact | ReportArtifact;
export type ReportIssue = 'citation_unread' | 'report_invalid';
export type ToolTrace = {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'complete' | 'error' | 'stopped';
  detail?: string;
  issue?: ReportIssue;
  artifactId?: string;
  recovery?: { toolId: string; artifactId: string };
};
export type AgentEvent =
  | {
      type: 'cloud';
      status: 'saved' | 'pending' | 'local';
      revision?: number;
      receipt?: string;
      code?: string;
    }
  | { type: 'start'; runId: string; remaining: number }
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; tool: ToolTrace }
  | {
      type: 'tool_end';
      id: string;
      status: 'complete' | 'error';
      detail: string;
      issue?: ReportIssue;
      artifactId?: string;
    }
  | { type: 'tool_recovered'; id: string; toolId: string; artifactId: string }
  | { type: 'plan'; steps: PlanStep[] }
  | { type: 'source'; source: AgentSource }
  | { type: 'artifact'; artifact: AgentArtifact }
  | { type: 'question'; question: AgentQuestion }
  | { type: 'context'; text: string }
  | { type: 'error'; code: string; message: string }
  | {
      type: 'done';
      status: 'complete' | 'waiting' | 'limited';
      servedModel: string;
      requestedModel: string;
      modelCalls: number;
      toolCalls: number;
    };
export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'complete' | 'running' | 'stopped' | 'error' | 'waiting' | 'limited';
  tools: ToolTrace[];
  artifacts: AgentArtifact[];
  sources: AgentSource[];
  plan?: PlanStep[];
  question?: AgentQuestion;
  model?: string;
  error?: string;
};
export type AgentSession = {
  receipt?: string;
  id: string;
  title: string;
  locale: Locale;
  updatedAt: string;
  mode: AgentMode;
  messages: AgentMessage[];
  context: { note: string; birth?: AgentBirth; useBirth: boolean; journalIds: string[] };
};

// Shared, bounded SSE decoder. Handles multibyte UTF-8, CRLF and arbitrary network chunks.
export async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
  signal?: AbortSignal,
  allowFinalDone = false,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let lines: string[] = [];
  let eventLength = 0;
  let clean = false;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  function line(value: string) {
    if (!value) {
      if (lines.length) onData(lines.join('\n'));
      lines = [];
      eventLength = 0;
    } else if (value.startsWith('data:')) {
      const data = value.slice(5).replace(/^ /, '');
      eventLength += data.length;
      if (eventLength > 262144) throw new Error('Stream event is too large');
      lines.push(data);
    }
  }
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    while (true) {
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      buffer += decoder.decode(value, { stream: !done });
      let pos: number;
      while ((pos = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, pos).replace(/\r$/, ''));
        buffer = buffer.slice(pos + 1);
      }
      if (buffer.length > 262144) throw new Error('Stream line is too large');
      if (done) {
        if (allowFinalDone && buffer.trim() === 'data: [DONE]' && !lines.length) {
          line('data: [DONE]');
          line('');
          buffer = '';
        } else if (allowFinalDone && !buffer.trim() && lines.length === 1 && lines[0] === '[DONE]') line('');
        // SSE dispatch requires a terminating blank line. A partial final event is a broken stream.
        if (buffer.trim() || lines.length) throw new Error('Incomplete stream event');
        clean = true;
        return;
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    if (!clean) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
