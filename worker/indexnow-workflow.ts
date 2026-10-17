import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { INDEXNOW_INTERVAL_MS, submitIndexNow } from './indexnow';
import type { Env } from './types';

export class IndexNowWorkflow extends WorkflowEntrypoint<Env, Record<string, never>> {
  async run(_event: Readonly<WorkflowEvent<Record<string, never>>>, step: WorkflowStep) {
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
