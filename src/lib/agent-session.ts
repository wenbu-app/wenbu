import type {
  AgentMessage,
  AgentSession,
  AgentEvent,
  AgentArtifact,
  AgentSource,
  ReadingInput,
} from './agent-protocol';
import type { Locale } from './schema';
import type { Reading } from './tools';
import { readReportVisual, reportSourceIds } from './agent-report';
import { readAccountCache, writeAccountCache } from './account-client';
export { hasLaterReport } from './agent-outcome';

export function newSession(locale: Locale): AgentSession {
  return {
    id: crypto.randomUUID(),
    title: locale === 'zh' ? '新的探索' : 'A new exploration',
    locale,
    updatedAt: new Date().toISOString(),
    mode: 'explore',
    messages: [],
    context: { note: '', useBirth: false, journalIds: [] },
  };
}
export function newMessage(role: 'user' | 'assistant', text: string): AgentMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    status: role === 'user' ? 'complete' : 'running',
    tools: [],
    artifacts: [],
    sources: [],
  };
}
export function isSafeSource(value: unknown): value is AgentSource {
  if (!value || typeof value !== 'object') return false;
  const s = value as AgentSource;
  if (
    ![s.id, s.title, s.url, s.excerpt, s.level, s.readAt].every((v) => typeof v === 'string') ||
    !['guide', 'reference', 'symbol'].includes(s.kind)
  )
    return false;
  try {
    const url = new URL(s.url);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function restoreSessions(): AgentSession[] {
  try {
    const parsed = readAccountCache<AgentSession>('session');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is AgentSession =>
          s &&
          typeof s.id === 'string' &&
          typeof s.title === 'string' &&
          ['zh', 'en'].includes(s.locale) &&
          ['explore', 'research'].includes(s.mode) &&
          typeof s.updatedAt === 'string' &&
          Array.isArray(s.messages) &&
          s.messages.every(
            (m: AgentMessage) =>
              m &&
              ['user', 'assistant'].includes(m.role) &&
              typeof m.text === 'string' &&
              typeof m.id === 'string' &&
              Array.isArray(m.tools) &&
              Array.isArray(m.artifacts) &&
              Array.isArray(m.sources),
          ) &&
          s.context &&
          typeof s.context.note === 'string' &&
          Array.isArray(s.context.journalIds),
      )
      .map((s) => ({
        ...s,
        messages: s.messages
          .map((m) => ({ ...m, sources: m.sources.filter(isSafeSource) }))
          .map((m) =>
            m.status === 'running'
              ? {
                  ...m,
                  status: 'stopped',
                  tools: m.tools.map((t) => (t.status === 'running' ? { ...t, status: 'stopped' } : t)),
                }
              : m,
          ),
      }));
  } catch {
    return [];
  }
}
export function persistSessions(sessions: AgentSession[]) {
  const json = JSON.stringify(sessions);
  if (new TextEncoder().encode(json).length > 3600000) throw new Error('storage_full');
  writeAccountCache('session', sessions);
}
export function updateMessage(message: AgentMessage, event: AgentEvent): AgentMessage {
  if (event.type === 'delta') return { ...message, text: message.text + event.text };
  if (event.type === 'tool_start') return { ...message, tools: [...message.tools, event.tool] };
  if (event.type === 'tool_end')
    return {
      ...message,
      tools: message.tools.map((t) =>
        t.id === event.id
          ? {
              ...t,
              status: event.status,
              detail: event.detail,
              ...(event.issue ? { issue: event.issue } : {}),
              ...(event.artifactId ? { artifactId: event.artifactId } : {}),
            }
          : t,
      ),
    };
  if (event.type === 'tool_recovered')
    return {
      ...message,
      tools: message.tools.map((tool) =>
        tool.id === event.id
          ? { ...tool, recovery: { toolId: event.toolId, artifactId: event.artifactId } }
          : tool,
      ),
    };
  if (event.type === 'plan') return { ...message, plan: event.steps };
  if (event.type === 'source')
    return isSafeSource(event.source)
      ? {
          ...message,
          sources: [...message.sources.filter((s) => s.id !== event.source.id), event.source],
        }
      : message;
  if (event.type === 'artifact') return { ...message, artifacts: [...message.artifacts, event.artifact] };
  if (event.type === 'question')
    return {
      ...message,
      question: event.question,
      text: message.text.includes(event.question.question)
        ? message.text
        : (message.text ? message.text + '\n\n' : '') + event.question.question,
    };
  if (event.type === 'done')
    return {
      ...message,
      status: event.status,
      model: event.servedModel,
      tools: message.tools.map((t) => (t.status === 'running' ? { ...t, status: 'stopped' } : t)),
    };
  if (event.type === 'error')
    return {
      ...message,
      status: 'error',
      error: event.message,
      tools: message.tools.map((t) =>
        t.status === 'running' ? { ...t, status: 'error', detail: event.message } : t,
      ),
    };
  return message;
}
export function readingReference(result: Reading): ReadingInput {
  return {
    kind: result.kind,
    input:
      result.kind === 'tarot'
        ? { cards: result.cards.map((c) => ({ id: c.id, reversed: c.reversed })) }
        : result.kind === 'iching'
          ? { lines: result.lines }
          : result.input,
  };
}
export function contextHistory(messages: AgentMessage[]) {
  const history = messages
    .filter((m) => m.text.trim())
    .slice(-16)
    .map((m) => ({
      role: m.role,
      content: m.text.slice(0, 7000),
      ...(m.role === 'assistant'
        ? {
            delivered:
              m.status === 'complete' &&
              !m.question &&
              (m.artifacts.length > 0 || m.text.trim().length >= 80),
          }
        : {}),
    }));
  while (history.reduce((n, m) => n + m.content.length, 0) > 28000) history.shift();
  return history;
}
export function sessionArtifacts(session: AgentSession): AgentArtifact[] {
  return session.messages.flatMap((m) => m.artifacts);
}
function markdownText(text: string) {
  return text.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]{}<>#+.!|()\-]/g, '\\$&');
}
function markdownCitation(source: { title: string; url: string }) {
  return `[${markdownText(source.title)}](<${source.url.replace(/[<>\s\\]/g, (char) => encodeURIComponent(char))}>)`;
}
export function artifactMarkdown(
  artifact: AgentArtifact,
  sources: { id: string; title: string; url: string }[],
) {
  if (artifact.type === 'chart')
    return `# ${markdownText(artifact.title)}\n\n\`\`\`json\n${JSON.stringify(artifact.reading, null, 2)}\n\`\`\`\n`;
  const ids = new Set(reportSourceIds(artifact));
  const visual = readReportVisual(artifact.visual);
  const citations = (sourceIds: string[]) =>
    [...new Set(sourceIds)].map((id) => {
      const source = sources.find((value) => value.id === id);
      return source ? markdownCitation(source) : 'Unresolved citation / 引用未匹配';
    });
  return (
    `# ${markdownText(artifact.title)}\n\n${markdownText(artifact.summary)}\n\n` +
    (visual
      ? `## ${markdownText(visual.title)}\n\n` +
        visual.items
          .map((item, index) => {
            const cited = citations(item.sourceIds);
            return (
              `${visual.type === 'steps' ? `${index + 1}.` : '-'} **${markdownText(item.label)}**: ${markdownText(item.detail)}` +
              (cited.length ? `\n   Sources / 依据: ${cited.join('; ')}` : '')
            );
          })
          .join('\n') +
        (visual.note ? `\n\n${markdownText(visual.note)}` : '') +
        '\n\n'
      : '') +
    artifact.sections
      .map(
        (section) =>
          `## ${markdownText(section.heading)}\n\n${section.body}` +
          (section.sourceIds.length ? `\n\nSources / 依据: ${citations(section.sourceIds).join('; ')}` : ''),
      )
      .join('\n\n') +
    (artifact.questions.length
      ? '\n\n## ' +
        'Questions / 继续思考\n\n' +
        artifact.questions.map((q) => '- ' + markdownText(q)).join('\n')
      : '') +
    '\n\n## Sources / 参考资料\n\n' +
    citations([...ids])
      .map((citation) => '- ' + citation)
      .join('\n') +
    '\n\nGenerated with DeepSeek · Wenbu · Symbolic interpretation, not established prediction.\n'
  );
}
export function downloadMarkdown(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wenbu-research.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
