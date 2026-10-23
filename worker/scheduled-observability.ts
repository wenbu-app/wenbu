import type { Env } from './types';
import { submitIndexNow } from './indexnow';

type CronEvent = Pick<ScheduledController, 'cron' | 'scheduledTime'>;

function scheduledAt(event: CronEvent) {
  return Number.isFinite(event.scheduledTime) ? event.scheduledTime : null;
}

/** Explicit metadata only: automatic request invocation logs can remain disabled. */
export function recordCronReceived(event: CronEvent) {
  console.info(
    JSON.stringify({ event: 'wenbu_cron_received', cron: event.cron, scheduledAt: scheduledAt(event) }),
  );
}

export async function dispatchScheduledIndexNow(event: CronEvent, env: Env) {
  let instanceId: string | null = null;
  try {
    if (env.INDEXNOW_WORKFLOW) {
      instanceId = 'indexnow-' + new Date(event.scheduledTime + 8 * 3600_000).toISOString().slice(0, 10);
      await env.INDEXNOW_WORKFLOW.createBatch([{ id: instanceId, params: {} }]);
      console.info(
        JSON.stringify({ event: 'indexnow_cron_enqueued', instanceId, scheduledAt: scheduledAt(event) }),
      );
    } else {
      const result = await submitIndexNow(env);
      console.info(
        JSON.stringify({
          event: 'indexnow_cron_direct_result',
          scheduledAt: scheduledAt(event),
          status: result.status,
          submitted: result.submitted,
        }),
      );
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const name =
      error instanceof Error &&
      ['Error', 'TypeError', 'RangeError', 'AbortError', 'TimeoutError'].includes(error.name)
        ? error.name
        : 'Error';
    // Binding exceptions can contain arbitrary text. Keep only the error type and numeric code.
    console.error(
      JSON.stringify({
        event: 'indexnow_cron_dispatch_failed',
        instanceId,
        scheduledAt: scheduledAt(event),
        errorName: name,
        errorCode: typeof code === 'number' && Number.isSafeInteger(code) ? code : null,
      }),
    );
    throw error;
  }
}
