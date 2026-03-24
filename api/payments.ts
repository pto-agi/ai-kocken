/**
 * Unified payments router — single Vercel serverless function.
 * Routes /api/payments/create-checkout-session, /api/payments/session-status,
 * /api/payments/webhook, /api/payments/claim-pending-entitlements
 * to their respective handlers imported from api/_payments/.
 *
 * This keeps us within the Vercel Hobby plan limit of 12 functions.
 */

let createCheckoutSession: any;
let sessionStatus: any;
let webhook: any;
let claimPendingEntitlements: any;
let importError: string | null = null;

try {
  createCheckoutSession = require('./_payments/create-checkout-session').default;
  sessionStatus = require('./_payments/session-status').default;
  webhook = require('./_payments/webhook').default;
  claimPendingEntitlements = require('./_payments/claim-pending-entitlements').default;
} catch (err: any) {
  importError = err?.message || String(err);
  console.error('Payment router import error:', err);
}

const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  'create-checkout-session': createCheckoutSession,
  'session-status': sessionStatus,
  'webhook': webhook,
  'claim-pending-entitlements': claimPendingEntitlements,
};

export default async function handler(req: any, res: any) {
  if (importError) {
    res.status(500).json({ error: 'Payment module import failed', detail: importError });
    return;
  }

  // 1. Read action from query param (set by Vercel rewrite)
  const queryAction = typeof req.query?.action === 'string' ? req.query.action : '';

  // 2. Fallback: parse from URL path (for local dev / direct calls)
  const url = req.url || '';
  const pathMatch = url.match(/\/api\/payments\/([a-z][a-z\-]*)/);
  const pathAction = pathMatch?.[1] || '';

  const action = (queryAction || pathAction).replace(/\/$/, '');

  const routeHandler = routes[action];
  if (!routeHandler) {
    res.status(404).json({
      error: `Unknown payment action: ${action || '(empty)'}`,
      available: Object.keys(routes),
      debug: { queryAction, pathAction, url: url.substring(0, 100) },
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
