import type Stripe from 'stripe';

import { getBearerToken, isAllowedOrigin, readJsonBody, setCors } from '../_shared/apiHelpers.js';
import {
  getRequestBaseUrl,
  getStripeClient,
  getStripePublishableKey,
  getSupabaseAdmin,
  resolveAuthUser,
} from '../_shared/paymentHelpers.js';

/** Known plan IDs and their Stripe Price IDs + metadata */
const PLAN_CONFIG: Record<string, {
  stripePriceId: string;
  amountOre: number;
  mode: 'payment' | 'subscription';
  monthCount?: number;
  label: string;
}> = {
  '12m': {
    stripePriceId: 'price_1TGmkmCMd1GQRttCQruyEMfM',
    amountOre: 399500,
    mode: 'payment',
    monthCount: 12,
    label: '12 månader',
  },
  '6m': {
    stripePriceId: 'price_1TGmkVCMd1GQRttCKwPn9lpP',
    amountOre: 299500,
    mode: 'payment',
    monthCount: 6,
    label: '6 månader',
  },
  '3m': {
    stripePriceId: 'price_1TGmkGCMd1GQRttC28TIA4aG',
    amountOre: 199500,
    mode: 'payment',
    monthCount: 3,
    label: '3 månader',
  },
  monthly: {
    stripePriceId: 'price_1TGmidCMd1GQRttC4QMjFroQ',
    amountOre: 49500,
    mode: 'subscription',
    monthCount: undefined,
    label: 'Månadsvis',
  },
};

interface CreateIntentBody {
  planId: string;
  email?: string;
  fullName?: string;
  userId?: string;
}

async function upsertCustomer(stripe: Stripe, params: {
  email: string;
  fullName?: string;
  userId?: string;
  planId: string;
}): Promise<string> {
  const admin = getSupabaseAdmin();
  const normalizedEmail = params.email.toLowerCase();

  // Check existing
  if (admin) {
    const { data } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  }

  // Create new
  const customer = await stripe.customers.create({
    email: normalizedEmail,
    name: params.fullName || undefined,
    metadata: {
      source: 'pto-checkout',
      plan_id: params.planId,
      user_id: params.userId || '',
    },
  });

  // Persist mapping (non-blocking)
  if (admin) {
    try {
      await admin.from('stripe_customers').upsert(
        {
          user_id: params.userId || null,
          email: normalizedEmail,
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' },
      ).throwOnError();
    } catch {
      // non-blocking
    }
  }

  return customer.id;
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (await readJsonBody(req)) as unknown as CreateIntentBody;
  const plan = PLAN_CONFIG[body.planId];
  if (!plan) {
    setCors(res, origin);
    res.status(400).json({ error: `Invalid planId: ${body.planId}` });
    return;
  }

  // Resolve auth user (optional — checkout is public)
  const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
  const authUser = await resolveAuthUser(accessToken);
  const userId = authUser?.id || body.userId || undefined;
  const userEmail = authUser?.email || body.email || undefined;
  const fullName = body.fullName || undefined;

  if (!userEmail) {
    setCors(res, origin);
    res.status(400).json({ error: 'E-post krävs för betalning.' });
    return;
  }

  try {
    const stripe = getStripeClient();
    const publishableKey = getStripePublishableKey();

    // Upsert Stripe Customer
    const customerId = await upsertCustomer(stripe, {
      email: userEmail,
      fullName,
      userId,
      planId: body.planId,
    });

    const baseUrl = getRequestBaseUrl(req) || 'https://my.privatetrainingonline.se';
    const returnUrl = `${baseUrl}/checkout/tack?session_id={CHECKOUT_SESSION_ID}`;

    const metadata: Record<string, string> = {
      flow: 'checkout',
      plan_id: body.planId,
      plan_label: plan.label,
      month_count: String(plan.monthCount || ''),
      user_id: userId || '',
      email: userEmail,
      full_name: fullName || '',
    };

    let clientSecret: string;
    let mode: 'payment' | 'subscription';
    let intentId: string;

    if (plan.mode === 'subscription') {
      // ── Subscription (monthly) ──
      // Create an incomplete subscription — Payment Element collects payment
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card', 'klarna', 'link'],
        },
        metadata,
        expand: ['latest_invoice.payment_intent'],
      });

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (latestInvoice as any).payment_intent as Stripe.PaymentIntent;

      clientSecret = paymentIntent.client_secret!;
      mode = 'subscription';
      intentId = paymentIntent.id;
    } else {
      // ── One-time payment (package) ──
      const paymentIntent = await stripe.paymentIntents.create({
        amount: plan.amountOre,
        currency: 'sek',
        customer: customerId,
        payment_method_types: ['card', 'klarna', 'link'],
        metadata,
      });

      clientSecret = paymentIntent.client_secret!;
      mode = 'payment';
      intentId = paymentIntent.id;
    }

    // Log transaction (non-blocking)
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        await admin.from('stripe_transactions').upsert(
          {
            user_id: userId || null,
            email: userEmail,
            flow: 'checkout',
            mode,
            status: 'created',
            amount: plan.amountOre,
            currency: 'SEK',
            stripe_payment_intent_id: intentId,
            metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_payment_intent_id' },
        ).throwOnError();
      } catch {
        // non-blocking
      }
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      clientSecret,
      mode,
      publishableKey,
      customerId,
      amount: plan.amountOre,
      currency: 'sek',
      planId: body.planId,
    });
  } catch (error: any) {
    console.error('create-intent failed', error);
    setCors(res, origin);
    res.status(502).json({ error: error?.message || 'Kunde inte skapa betalning' });
  }
}
