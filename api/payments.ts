/**
 * Unified payments router — single Vercel serverless function.
 * Routes /api/payments/create-checkout-session, /api/payments/session-status,
 * /api/payments/webhook, /api/payments/claim-pending-entitlements
 * to their respective handlers imported from api/_payments/.
 *
 * This keeps us within the Vercel Hobby plan limit of 12 functions.
 */

import createCheckoutSession from './_payments/create-checkout-session.js';
import sessionStatus from './_payments/session-status.js';
import webhook from './_payments/webhook.js';
import claimPendingEntitlements from './_payments/claim-pending-entitlements.js';

const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  'create-checkout-session': createCheckoutSession,
  'session-status': sessionStatus,
  'webhook': webhook,
  'claim-pending-entitlements': claimPendingEntitlements,
};

export default async function handler(req: any, res: any) {
  // 1. Read action from query param (set by Vercel rewrite)
  const queryAction = typeof req.query?.action === 'string' ? req.query.action : '';

  // 2. Fallback: parse from URL path (for local dev / direct calls)
  const url = req.url || '';
  const pathMatch = url.match(/\/api\/payments\/([a-z][a-z\-]*)/);
  const pathAction = pathMatch?.[1] || '';

  const action = (queryAction || pathAction).replace(/\/$/, '');

  const routeHandler = routes[action];
  if (!routeHandler) {
    res.status(404).json({ error: `Unknown payment action: ${action || '(empty)'}`, available: Object.keys(routes) });
    return;
  }

  await routeHandler(req, res);
}

