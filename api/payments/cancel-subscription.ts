/**
 * Cancel Subscription API
 *
 * Called from "Mina sidor" to cancel a Stripe subscription.
 * Sets cancel_at_period_end=true so the customer keeps access
 * until the current billing period ends. Stripe then fires
 * customer.subscription.deleted which triggers deactivation.
 */

import { getBearerToken, setCors, readJsonBody, isAllowedOrigin } from '../_shared/apiHelpers.js';
import { getStripeClient, getSupabaseAdmin, resolveAuthUser } from '../_shared/paymentHelpers.js';

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const allowed = isAllowedOrigin(origin);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  setCors(res, origin);

  try {
    // Auth required — only the subscription owner can cancel
    const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
    if (!accessToken) {
      res.status(401).json({ error: 'Du måste vara inloggad för att avbryta din prenumeration.' });
      return;
    }

    const authUser = await resolveAuthUser(accessToken);
    if (!authUser?.id) {
      res.status(401).json({ error: 'Ogiltig session. Logga in igen.' });
      return;
    }

    const body = await readJsonBody(req);
    const reason = String(body?.reason || 'customer_request');

    // Look up the user's Stripe subscription from their profile
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.status(500).json({ error: 'Databasfel. Försök igen.' });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email, full_name, membership_type')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: 'Profil hittades inte.' });
      return;
    }

    if (!profile.stripe_subscription_id) {
      res.status(400).json({ error: 'Ingen aktiv prenumeration hittades.' });
      return;
    }

    // Cancel at period end (keeps access until the current billing cycle ends)
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: {
        cancel_reason: reason,
        canceled_by: 'customer_self_service',
        canceled_at: new Date().toISOString(),
      },
    });

    // Update profile to reflect pending cancellation
    await admin
      .from('profiles')
      .update({
        subscription_status: 'active', // Still active until period ends
        subscription_cancel_at_period_end: true,
      })
      .eq('id', authUser.id);

    // Log the cancellation
    await admin.from('agent_activity_log').insert({
      category: 'economy',
      action: 'subscription_cancel_requested',
      actor: 'customer_self_service',
      target_email: profile.email,
      details: {
        subscription_id: profile.stripe_subscription_id,
        cancel_at: subscription.cancel_at
          ? new Date((subscription.cancel_at as number) * 1000).toISOString()
          : null,
        reason,
      },
    });

    const cancelDate = subscription.cancel_at
      ? new Date((subscription.cancel_at as number) * 1000).toLocaleDateString('sv-SE')
      : 'vid periodens slut';

    res.status(200).json({
      ok: true,
      message: `Din prenumeration avslutas ${cancelDate}. Du behåller full tillgång tills dess.`,
      cancelAt: cancelDate,
    });
  } catch (err: any) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({
      error: err?.message || 'Kunde inte avbryta prenumerationen. Försök igen eller kontakta support.',
    });
  }
}
