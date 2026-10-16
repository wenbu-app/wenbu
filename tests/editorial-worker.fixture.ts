import worker from '../worker/index';
import { dispatchEditorial, replenishTopics } from '../worker/editorial-workflow';
export { EditorialWorkflow } from '../worker/editorial-workflow';
export { UsageGate, DeletionLedger } from '../worker/index';
import type { Env } from '../worker/types';
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/__test/planning') {
      const data = (await request.json().catch(() => ({}))) as { id?: string };
      return Response.json(await replenishTopics(env, data.id ?? 'synthetic-native-planning'));
    }
    if (new URL(request.url).pathname === '/__test/dispatch') {
      const { time } = (await request.json()) as { time: number };
      return Response.json(await dispatchEditorial(env, time));
    }
    return worker.fetch(request, env, ctx);
  },
};
