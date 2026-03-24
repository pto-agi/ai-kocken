/**
 * Unified payments router — single Vercel serverless function.
 * Routes /api/payments/* to handlers in lib/paymentHandlers/.
 * Keeps us within the Vercel Hobby plan limit of 12 functions.
 */

import createCheckoutSession from '../lib/paymentHandlers/create-checkout-session.js';
import sessionStatus from '../lib/paymentHandlers/session-status.js';
import webhook from '../lib/paymentHandlers/webhook.js';
import claimPendingEntitlements from '../lib/paymentHandlers/claim-pending-entitlements.js';

const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  'create-checkout-session': createCheckoutSession,
  'session-status': sessionStatus,
  'webhook': webhook,
  'claim-pending-entitlements': claimPendingEntitlements,
};

export default async function handler(req: any, res: any) {
  const queryAction = typeof req.query?.action === 'string' ? req.query.action : '';
  const url = req.url || '';
  const pathMatch = url.match(/\/api\/payments\/([a-z][a-z\-]*)/);
  const pathAction = pathMatch?.[1] || '';
  const action = (queryAction || pathAction).replace(/\/$/, '');

  const routeHandler = routes[action];
  if (!routeHandler) {
    res.status(404).json({
      error: `Unknown payment action: ${action || '(empty)'}`,
      available: Object.keys(routes),
    });
    return;
  }

  try {
    await routeHandler(req, res);
  } catch (err: any) {
    console.error(`Payment handler error [${action}]:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Handler crash: ${err?.message || 'unknown'}`, action });
    }
  }
}
