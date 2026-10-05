// Local workerd fixture only. Not reachable from the production entry point.
import type { Env } from '../worker/types';
export { UsageGate } from '../worker/quota';
export { DeletionLedger } from '../worker/deletion-ledger';
const wrapped = new WeakMap<object, Env>();
export default {
  async fetch(request: Request, env: Env & { MAILBOX: Fetcher }, ctx: ExecutionContext) {
    let configured = wrapped.get(env);
    if (!configured) {
      configured = {
        ...env,
        AUTH_EMAIL: {
          send: async (message: unknown) => {
            const response = await env.MAILBOX.fetch(
              new Request('http://mailbox.test/', { method: 'POST', body: JSON.stringify(message) }),
            );
            if (!response.ok) throw new Error('fixture_mail_failure');
            return { messageId: 'local-fixture' };
          },
        } as SendEmail,
      };
      wrapped.set(env, configured);
    }
    try {
      if (new URL(request.url).pathname === '/__fixture/reconcile') {
        const { reconcileDeletionLedger } = await import('../worker/accounts');
        return Response.json(await reconcileDeletionLedger({ ...configured, ACCOUNTS_MAINTENANCE: 'true' }));
      }
      const { default: app } = await import('../worker/index');
      return await app.fetch(request, configured, ctx);
    } catch (error) {
      console.error(error);
      return Response.json({ fixtureError: String(error) }, { status: 590 });
    }
  },
};
