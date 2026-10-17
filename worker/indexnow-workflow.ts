import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { INDEXNOW_INTERVAL_MS, submitIndexNow } from './indexnow';
import type { Env } from './types';
import { runIndexNowDiagnostic } from './indexnow-observability';

export class IndexNowWorkflow extends WorkflowEntrypoint<Env, { mode?: 'diagnostic' }> {
  async run(event: Readonly<WorkflowEvent<{ mode?: 'diagnostic' }>>, step: WorkflowStep) {
    const payload = event.payload === undefined ? {} : event.payload;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('invalid_indexnow_workflow_mode');
    if (payload.mode === 'diagnostic' && Object.keys(payload).length === 1)
      return await step.do(
        'read-only-transport-diagnostic-once',
        { retries: { limit: 0, delay: '1 second' }, timeout: '1 minute' },
        () => runIndexNowDiagnostic(this.env, event.instanceId),
      );
    if (Object.keys(payload).length) throw new Error('invalid_indexnow_workflow_mode');
    const due = await step.do('read-delivery-window', async () => {
      if (!this.env.ANALYTICS) return { status: 'disabled', at: 0, wait: false };
      const state = await this.env.ANALYTICS.prepare(
        'SELECT retry_at,last_scanned FROM indexnow_state WHERE id=1',
      ).first<{ retry_at: number; last_scanned: number | null }>();
      const at = Math.max(
        state?.retry_at ?? 0,
        state?.last_scanned ? state.last_scanned + INDEXNOW_INTERVAL_MS : 0,
      );
      return {
        status: at > Date.now() + INDEXNOW_INTERVAL_MS ? 'backoff' : 'due',
        at,
        wait: at > Date.now(),
      };
    });
    // Keep at most one daily window waiting. Longer provider pauses return for the next trigger.
    if (due.status !== 'due') return { status: due.status, retryAt: due.at, submitted: 0 };
    if (due.wait) await step.sleepUntil('wait-for-full-daily-interval', new Date(due.at));
    return await step.do(
      'attempt-notification-once',
      { retries: { limit: 0, delay: '1 second' }, timeout: '2 minutes' },
      () => submitIndexNow(this.env),
    );
  }
}
