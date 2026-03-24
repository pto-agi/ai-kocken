import type Stripe from 'stripe';

import { setCors } from '../../api/_shared/apiHelpers.js';
import { computeForlangningOfferFromProfile } from '../../api/_shared/paymentDomain.js';
import {
  getStripeClient,
  getStripeWebhookSecret,
  getSupabaseAdmin,
  readRawBody,
} from '../../api/_shared/paymentHelpers.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function normalizeStatus(status: string): string {
  if (status === 'trialing') return 'active';
  if (status === 'canceled') return 'deactivated';
  return status;
}

async function findProfileIdByEmail(admin: any, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', normalized)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    return (data?.id as string | undefined) || null;
  } catch {
    return null;
  }
}

async function findProfileById(admin: any, id: string): Promise<{ id: string; email: string | null; coaching_expires_at: string | null } | null> {
  if (!id) return null;
  try {
    const { data } = await admin
      .from('profiles')
      .select('id,email,coaching_expires_at')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    if (!data?.id) return null;
    return {
      id: String(data.id),
      email: typeof data.email === 'string' ? data.email : null,
      coaching_expires_at: typeof data.coaching_expires_at === 'string' ? data.coaching_expires_at : null,
    };
  } catch {
    return null;
  }
}

async function resolveProfileId(admin: any, userId: string | undefined, email: string | undefined) {
  if (userId) {
    const profile = await findProfileById(admin, userId);
    if (profile) {
      if (!email || !profile.email || profile.email.trim().toLowerCase() === email.trim().toLowerCase()) {
        return profile.id;
      }
    }
  }
  if (email) return findProfileIdByEmail(admin, email);
  return null;
}

async function createPendingEntitlement(
  admin: any,
  payload: { email?: string; flow: string; metadata: Record<string, unknown> },
) {
  if (!payload.email) return;
  try {
    await admin.from('stripe_pending_entitlements').insert({
      email: payload.email.toLowerCase(),
      entitlement_type: payload.flow,
      payload: payload.metadata,
      status: 'pending',
      created_at: new Date().toISOString(),
    }).throwOnError();
  } catch {
    // non-blocking
  }
}

async function markTransaction(
  admin: any,
  input: {
    sessionId?: string | null;
    paymentIntentId?: string | null;
    subscriptionId?: string | null;
    status: string;
    metadata?: Record<string, unknown>;
  },
) {
  const updates = {
    status: input.status,
    stripe_payment_intent_id: input.paymentIntentId || null,
    stripe_subscription_id: input.subscriptionId || null,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  if (input.sessionId) {
    try {
      await admin
        .from('stripe_transactions')
        .update(updates)
        .eq('stripe_checkout_session_id', input.sessionId)
        .throwOnError();
    } catch {
      // non-blocking
    }
  }
}

async function resolvePendingEntitlements(
  admin: any,
  input: { email?: string | null; flow?: string | null },
) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!email) return;

  try {
    let query = admin
      .from('stripe_pending_entitlements')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)
      .eq('status', 'pending');

    if (input.flow) {
      query = query.eq('entitlement_type', input.flow);
    }
    await query.throwOnError();
  } catch {
    // non-blocking
  }
}

async function processPaidCheckoutSession(admin: any, session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const flow = metadata.flow || 'unknown';
  const userId = metadata.user_id || '';
  const email = session.customer_details?.email || session.customer_email || metadata.email || '';
  const profileId = await resolveProfileId(admin, userId || undefined, email || undefined);

  await markTransaction(admin, {
    sessionId: session.id,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
    status: 'paid',
    metadata,
  });

  if (flow === 'premium') {
    if (profileId) {
      try {
        await admin
          .from('profiles')
          .update({
            membership_level: 'premium',
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId)
          .throwOnError();
        await resolvePendingEntitlements(admin, { email, flow: 'premium' });
      } catch {
        // non-blocking
      }
    } else {
      await createPendingEntitlement(admin, { email: email || undefined, flow, metadata });
    }

    if (typeof session.subscription === 'string') {
      try {
        await admin.from('stripe_subscriptions').upsert(
          {
            user_id: profileId,
            email: email || null,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
            status: 'active',
            current_period_end: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' },
        ).throwOnError();
      } catch {
        // non-blocking
      }
    }
    return;
  }

  if (flow === 'forlangning') {
    if (!profileId) {
      await createPendingEntitlement(admin, { email: email || undefined, flow, metadata });
      return;
    }

    const profile = await findProfileById(admin, profileId);
    if (!profile) {
      await createPendingEntitlement(admin, { email: email || undefined, flow, metadata });
      return;
    }

    const computedOffer = computeForlangningOfferFromProfile(profile.coaching_expires_at);
    const expectedAmountOre = Math.round(computedOffer.totalPrice * 100);
    const paidAmountOre = typeof session.amount_total === 'number' ? session.amount_total : null;

    if (!expectedAmountOre || (paidAmountOre !== null && paidAmountOre !== expectedAmountOre)) {
      await markTransaction(admin, {
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        status: 'review_required',
        metadata,
      });
      return;
    }

    try {
      await admin
        .from('profiles')
        .update({
          coaching_expires_at: computedOffer.newExpiresAt,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
        .throwOnError();
      await resolvePendingEntitlements(admin, { email, flow: 'forlangning' });
    } catch {
      // non-blocking
    }
    return;
  }

  if (flow === 'refill') {
    const orderId = typeof metadata.order_id === 'string' ? metadata.order_id : '';
    const update = {
      status: 'paid',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      updated_at: new Date().toISOString(),
    };

    if (orderId) {
      try {
        await admin.from('orders').update(update).eq('id', orderId).throwOnError();
      } catch {
        // non-blocking
      }
    } else {
      try {
        await admin.from('orders').update(update).eq('checkout_session_id', session.id).throwOnError();
      } catch {
        // non-blocking
      }
    }
  }
}

async function processSubscriptionUpdate(admin: any, subscription: Stripe.Subscription) {
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : '';
  let email: string | null = null;
  let userId: string | null = null;

  let customerRow: Record<string, unknown> | null = null;
  try {
    const result = await admin
      .from('stripe_customers')
      .select('email,user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    customerRow = (result?.data as Record<string, unknown> | null) || null;
  } catch {
    customerRow = null;
  }

  email = (customerRow?.email as string | undefined) || null;
  userId = (customerRow?.user_id as string | undefined) || null;
  const profileId = await resolveProfileId(admin, userId || undefined, email || undefined);

  const rawSubscription = subscription as any;
  const periodEnd = typeof rawSubscription.current_period_end === 'number'
    ? new Date(rawSubscription.current_period_end * 1000).toISOString()
    : null;
  const status = normalizeStatus(String(rawSubscription.status || 'unknown'));

  try {
    await admin.from('stripe_subscriptions').upsert(
      {
        user_id: profileId,
        email,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId || null,
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: Boolean(rawSubscription.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    ).throwOnError();
  } catch {
    // non-blocking
  }

  if (profileId) {
    try {
      await admin.from('profiles').update({
        subscription_status: status,
        membership_level: status === 'active' ? 'premium' : null,
        updated_at: new Date().toISOString(),
      }).eq('id', profileId).throwOnError();
    } catch {
      // non-blocking
    }
  }
}

async function processInvoice(admin: any, invoice: Stripe.Invoice, isPaid: boolean) {
  const rawInvoice = invoice as any;
  const subscriptionId = typeof rawInvoice.subscription === 'string' ? rawInvoice.subscription : null;
  if (!subscriptionId) return;

  const status = isPaid ? 'paid' : 'payment_failed';
  try {
    await admin.from('stripe_subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
      .throwOnError();
  } catch {
    // non-blocking
  }
}

async function beginEventProcessing(admin: any, event: Stripe.Event): Promise<boolean> {
  const insertLockRow = async (status: 'processing' | 'processed') => {
    await admin
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        status,
        payload: event,
        error_message: null,
        processed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .throwOnError();
  };

  try {
    await insertLockRow('processing');
    return true;
  } catch (error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    if (code === '23505' || message.includes('duplicate key') || message.includes('unique')) {
      return false;
    }
    if (code === '23514' || message.includes('check constraint')) {
      try {
        await insertLockRow('processed');
        return true;
      } catch (fallbackError: any) {
        const fallbackCode = String(fallbackError?.code || '');
        const fallbackMessage = String(fallbackError?.message || '').toLowerCase();
        if (fallbackCode === '23505' || fallbackMessage.includes('duplicate key') || fallbackMessage.includes('unique')) {
          return false;
        }
        throw fallbackError;
      }
    }
    throw error;
  }
}

async function markEventProcessed(admin: any, event: Stripe.Event, status: 'processed' | 'failed', errorMessage?: string) {
  try {
    await admin
      .from('stripe_webhook_events')
      .update({
        status,
        payload: event,
        error_message: errorMessage || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id)
      .throwOnError();
  } catch {
    // non-blocking
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const raw = await readRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing stripe signature' });
      return;
    }

    const event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.status(500).json({ error: 'Supabase admin is not configured' });
      return;
    }

    if (!(await beginEventProcessing(admin, event))) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded': {
          await processPaidCheckoutSession(admin, event.data.object as Stripe.Checkout.Session);
          break;
        }
        case 'checkout.session.async_payment_failed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await markTransaction(admin, {
            sessionId: session.id,
            paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            status: 'failed',
            metadata: session.metadata || {},
          });
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          await processSubscriptionUpdate(admin, event.data.object as Stripe.Subscription);
          break;
        }
        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
          await processInvoice(admin, event.data.object as Stripe.Invoice, true);
          break;
        }
        case 'invoice.payment_failed': {
          await processInvoice(admin, event.data.object as Stripe.Invoice, false);
          break;
        }
        default:
          break;
      }

      await markEventProcessed(admin, event, 'processed');
      res.status(200).json({ received: true });
    } catch (processingError: any) {
      await markEventProcessed(admin, event, 'failed', processingError?.message || 'unknown error');
      console.error('Stripe webhook processing failed', processingError);
      res.status(500).json({ error: processingError?.message || 'processing failed' });
    }
  } catch (error: any) {
    console.error('Stripe webhook signature failed', error);
    res.status(400).json({ error: error?.message || 'invalid webhook payload' });
  }
}
