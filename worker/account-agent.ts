import { consumeSse, type AgentEvent, type AgentSession } from '../src/lib/agent-protocol';
import { newMessage, updateMessage } from '../src/lib/agent-session';
import { AccountError } from './account-security';
import { getRecord, putRecord } from './account-records';
import { agentResponse } from './agent';
import { resultReceipt, verifiedReceipt, savedOperation, type Actor } from './account-operations';
import type { Env } from './types';
import type { ServiceMetric } from './analytics';

export async function accountAgentResponse(
  raw: unknown,
  request: Request,
  env: Env,
  actor: Actor | undefined,
  onFinish: (m: ServiceMetric) => void,
  onActivity: (m: ServiceMetric) => void,
) {
  const sessionId = request.headers.get('X-Wenbu-Conversation');
  let session: AgentSession | undefined,
    revision = 0;
  if (actor?.owner && actor.account?.cloud_history && !sessionId)
    throw new AccountError(409, 'conversation_not_saved');
  if (actor?.owner && actor.account?.cloud_history && sessionId) {
    const record = await getRecord(env, actor.owner, 'session', sessionId);
    if (!record || record.revision !== Number(request.headers.get('X-Wenbu-Revision')))
      throw new AccountError(409, 'conversation_not_saved');
    session = { ...(record.content as AgentSession), receipt: undefined };
    revision = record.revision;
    const last = session.messages.at(-1),
      user = session.messages.at(-2);
    if (
      last?.id !== actor.requestId ||
      last.role !== 'assistant' ||
      last.status !== 'running' ||
      user?.role !== 'user' ||
      user.text !== (raw as { message?: string }).message
    )
      throw new AccountError(409, 'conversation_not_saved');
  }
  const response = await agentResponse(raw, request, env, onFinish, onActivity, actor);
  if (!actor || !response.body) return response;
  let message = newMessage('assistant', '');
  message.id = actor.requestId;
  const abort = new AbortController();
  let disconnected = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: AgentEvent) => {
        if (!disconnected) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      let terminal: AgentEvent | undefined,
        pending: Promise<void> | undefined,
        cloudError: string | undefined,
        lastSave = Date.now();
      const checkpoint = async () => {
        if (!session || !actor.owner || cloudError) return;
        const snapshot = {
          ...session,
          updatedAt: new Date().toISOString(),
          messages: session.messages.map((m) => (m.id === message.id ? structuredClone(message) : m)),
        };
        try {
          const saved = await putRecord(env, actor.owner, 'session', session.id, {
            requestId: crypto.randomUUID(),
            revision,
            content: snapshot,
            source: 'current',
          });
          revision = saved.revision;
          session = snapshot;
        } catch (error) {
          cloudError = error instanceof AccountError ? error.code : 'cloud_save_failed';
        }
      };
      try {
        await consumeSse(
          response.body!,
          (data) => {
            const event = JSON.parse(data) as AgentEvent;
            message = updateMessage(message, event);
            if (event.type === 'done' || event.type === 'error') terminal = event;
            else emit(event);
            if (session && !pending && Date.now() - lastSave >= 3000) {
              lastSave = Date.now();
              pending = checkpoint().finally(() => {
                pending = undefined;
              });
            }
          },
          abort.signal,
        );
        await pending;
        let receipt: string | undefined;
        if (
          terminal?.type === 'done' &&
          terminal.status === 'complete' &&
          !message.question &&
          (message.artifacts.length > 0 || message.text.trim().length >= 80)
        )
          receipt = await resultReceipt(env, actor, 'session', { messages: [message] });
        if (session && receipt) session = { ...session, receipt } as AgentSession;
        await checkpoint();
        if (session && actor.owner && receipt && !cloudError) {
          const verified = await verifiedReceipt(env, request, actor.owner, 'session', session);
          if (verified) await savedOperation(env, actor.owner, verified);
        }
        emit({
          type: 'cloud',
          status: cloudError ? 'pending' : session ? 'saved' : 'local',
          revision: session ? revision : undefined,
          receipt,
          code: cloudError,
        });
        if (terminal) emit(terminal);
      } catch {
        message = { ...message, status: 'stopped' };
        await pending;
        await checkpoint();
        emit({
          type: 'error',
          code: 'stream_interrupted',
          message:
            '连接中断，已保存的片段可在历史中恢复。 / Connection interrupted. Saved checkpoints are available in history.',
        });
      } finally {
        if (!disconnected) controller.close();
      }
    },
    cancel() {
      disconnected = true;
      abort.abort();
    },
  });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, no-transform');
  headers.set('Vary', 'Cookie, Origin');
  if (actor.cookie) headers.append('Set-Cookie', actor.cookie);
  return new Response(body, { headers });
}
