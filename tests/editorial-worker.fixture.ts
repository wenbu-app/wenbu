import worker from '../worker/index';
import { dispatchEditorial, replenishTopics } from '../worker/editorial-workflow';
export { EditorialWorkflow } from '../worker/editorial-workflow';
export { IndexNowWorkflow } from '../worker/indexnow-workflow';
import { checkEditorialHealth } from '../worker/editorial-health';
export { UsageGate, DeletionLedger } from '../worker/index';
import type { Env } from '../worker/types';
import { reserveEditorialModelCall } from '../worker/editorial-policy';
import { ensureEditorialProvider } from '../worker/editorial-provider';
import { readEditorialOwner } from '../worker/editorial-research';
import { editorialTopics } from '../src/data/editorial-topics';
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/__test/provider')
      return Response.json(await ensureEditorialProvider(env));
    if (new URL(request.url).pathname === '/__test/static-owner')
      return Response.json(
        await readEditorialOwner(
          env,
          editorialTopics.find((t) => t.category === 'compare' && t.slug === 'fatetell')!,
        ),
      );
    if (new URL(request.url).pathname === '/__test/budget') {
      try {
        await reserveEditorialModelCall(env, 'synthetic-budget', true);
        return Response.json({ reserved: true });
      } catch {
        return Response.json({ reserved: false }, { status: 409 });
      }
    }
    if (new URL(request.url).pathname === '/__test/health')
      return Response.json(await checkEditorialHealth(env));
    if (new URL(request.url).pathname === '/__test/indexnow') {
      await env.INDEXNOW_WORKFLOW!.createBatch([{ id: 'synthetic-native-indexnow', params: {} }]);
      return Response.json(await (await env.INDEXNOW_WORKFLOW!.get('synthetic-native-indexnow')).status());
    }
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
