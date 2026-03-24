import { isAllowedOrigin, readJsonBody, setCors } from '../_shared/apiHelpers.js';
import { getStripeClient } from '../_shared/paymentHelpers.js';

function getSessionIdFromReq(req: any, body: Record<string, unknown>): string {
  const fromQuery = typeof req?.query?.session_id === 'string' ? req.query.session_id : '';
  const fromBody = typeof body.session_id === 'string' ? body.session_id : '';
  return (fromQuery || fromBody || '').trim();
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.method === 'POST' ? await readJsonBody(req) : {};
  const sessionId = getSessionIdFromReq(req, body);
  if (!sessionId) {
    setCors(res, origin);
    res.status(400).json({ error: 'Missing session_id' });
    return;
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      session_id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      mode: session.mode,
      customer_email: session.customer_details?.email || session.customer_email || null,
      flow: session.metadata?.flow || null,
    });
  } catch (error: any) {
    console.error('session-status failed', error);
    setCors(res, origin);
    res.status(502).json({ error: error?.message || 'Could not fetch session status' });
  }
}
