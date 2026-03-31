import type Stripe from 'stripe';

import { setCors } from '../_shared/apiHelpers.js';
import { computeForlangningOfferFromProfile } from '../_shared/paymentDomain.js';
import {
  getStripeClient,
  getStripeWebhookSecret,
  getSupabaseAdmin,
  readRawBody,
} from '../_shared/paymentHelpers.js';

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

async function findProfileById(admin: any, id: string): Promise<{ id: string; email: string | null; coaching_expires_at: string | null; membership_type: string | null } | null> {
  if (!id) return null;
  try {
    const { data } = await admin
      .from('profiles')
      .select('id,email,coaching_expires_at,membership_type')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    if (!data?.id) return null;
    return {
      id: String(data.id),
      email: typeof data.email === 'string' ? data.email : null,
      coaching_expires_at: typeof data.coaching_expires_at === 'string' ? data.coaching_expires_at : null,
      membership_type: typeof data.membership_type === 'string' ? data.membership_type : null,
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

    // Prefer metadata from checkout creation time (set in create-checkout-session.ts)
    // This avoids failures when coaching_expires_at changes between checkout and payment
    const newExpiresAt = metadata.new_expires_at || computedOffer.newExpiresAt;
    const monthCount = Number(metadata.month_count) || computedOffer.monthCount;

    if (!newExpiresAt) {
      await markTransaction(admin, {
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        status: 'review_required',
        metadata: { ...metadata, reason: 'No new_expires_at resolved' },
      });
      return;
    }

    try {
      await admin
        .from('profiles')
        .update({
          coaching_expires_at: newExpiresAt,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
        .throwOnError();
      await resolvePendingEntitlements(admin, { email, flow: 'forlangning' });
    } catch {
      // non-blocking
    }

    // ── Notify AntiGravity Agent: Sheet write, TZ reactivation, email ──
    try {
      const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';
      const customerName = session.customer_details?.name || metadata.email || '';
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const agentPayload = {
        email: email || metadata.email || '',
        first_name: firstName,
        last_name: lastName,
        month_count: monthCount,
        total_price: Number(metadata.total_price) || computedOffer.totalPrice,
        current_expires_at: metadata.current_expires_at || computedOffer.currentExpiresAt || '',
        new_expires_at: newExpiresAt,
        billing_starts_at: metadata.billing_starts_at || computedOffer.billingStartsAt || '',
        payment_method: 'stripe',
        campaign_year: computedOffer.campaignYear,
      };

      // Await the call with retry (max 2 attempts, 10s timeout each)
      let agentOk = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const agentRes = await fetch(`${agentBaseUrl}/api/economy/forlangning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (agentRes.ok) {
            agentOk = true;
            break;
          }
          console.error(`Agent forlangning attempt ${attempt} got ${agentRes.status}`);
        } catch (fetchErr: any) {
          console.error(`Agent forlangning attempt ${attempt} failed:`, fetchErr?.message);
        }
      }

      // If AG-Agent call failed, log to activity_log so it's visible in the dashboard
      if (!agentOk) {
        try {
          await admin.from('agent_activity_log').insert({
            type: 'membership',
            title: `⚠️ Förlängning misslyckad: ${customerName}`,
            summary: `Stripe-betalning OK men AG-Agent nåddes inte. Email: ${email}, Belopp: ${computedOffer.totalPrice} kr, Nytt datum: ${computedOffer.newExpiresAt}. Kunden fick INTE bekräftelsemejl. Trigga manuellt via /api/economy/forlangning.`,
            status: 'error',
            client_name: customerName,
            metadata: { ...agentPayload, session_id: session.id, error: 'AG-Agent unreachable after 2 attempts' },
          }).throwOnError();
        } catch { /* best effort */ }
      }
    } catch (agentErr) {
      console.error('Agent forlangning call error:', agentErr);
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

  // If no email from stripe_customers, try fetching from subscription metadata
  if (!email) {
    const meta = (subscription as any).metadata || {};
    email = (meta.email as string | undefined) || null;
  }

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
      // Only sync subscription_status here — AG-Agent handles full profile logic
      // (is_member, membership_type, hybrid detection, stripe_customer_id)
      await admin.from('profiles').update({
        subscription_status: status,
        updated_at: new Date().toISOString(),
      }).eq('id', profileId).throwOnError();
    } catch {
      // non-blocking
    }
  }

  // ── Forward new active subscriptions to AG-Agent ──
  // AG-Agent handles: profile hybrid check, Sheet write, welcome email, admin email
  if (status === 'active' && email) {
    const meta = (subscription as any).metadata || {};
    const fullName = (meta.full_name as string) || '';

    if (profileId) {
      // Existing client → forward to AG-Agent subscription processor
      try {
        const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';

        const agentPayload = {
          email,
          full_name: fullName,
          stripe_customer_id: stripeCustomerId,
        };

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);
            const res = await fetch(`${agentBaseUrl}/api/economy/checkout-subscription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(agentPayload),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) break;
          } catch {
            // retry
          }
        }
      } catch {
        // non-blocking
      }
    } else {
      // New client (no profile) → pending entitlement + AG-Agent for Sheet/Email
      await createPendingEntitlement(admin, {
        email,
        flow: 'subscription',
        metadata: {
          stripe_subscription_id: subscription.id,
          stripe_customer_id: stripeCustomerId,
          full_name: fullName,
        },
      });

      // Still forward for Sheet + Email (we have email even without profile)
      try {
        const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';

        const agentPayload = {
          email,
          full_name: fullName,
          plan_label: 'Månadsvis',
          month_count: 0,
          amount: 0,
          payment_method: 'stripe',
          is_subscription: true,
        };

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);
            const res = await fetch(`${agentBaseUrl}/api/economy/new-checkout-client`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(agentPayload),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) break;
          } catch {
            // retry
          }
        }
      } catch {
        // non-blocking
      }
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

async function processPackagePurchase(admin: any, pi: Stripe.PaymentIntent) {
  const meta = pi.metadata || {};
  const email = (meta.email || '').trim().toLowerCase();
  const monthCount = parseInt(meta.month_count || '0', 10);
  const planId = meta.plan_id || '';
  const planLabel = meta.plan_label || '';
  const userId = meta.user_id || '';
  const fullName = meta.full_name || '';
  const amountKr = Math.round((pi.amount || 0) / 100);

  if (!email || monthCount <= 0) return;

  // Mark transaction as paid
  await markTransaction(admin, {
    paymentIntentId: pi.id,
    status: 'paid',
    metadata: meta,
  });

  // Find existing profile
  const profileId = await resolveProfileId(admin, userId || undefined, email);
  const profile = profileId ? await findProfileById(admin, profileId) : null;

  if (profile) {
    // ── Existing client: extend coaching_expires_at ──
    const now = new Date();
    const currentExpiry = profile.coaching_expires_at
      ? new Date(profile.coaching_expires_at)
      : null;
    const baseDate = (currentExpiry && currentExpiry > now) ? currentExpiry : now;

    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + monthCount);
    const newExpiresAt = newExpiry.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if user has an active Stripe subscription → hybrid
    let hasActiveSubscription = false;
    if (profile.membership_type === 'subscription' || profile.membership_type === 'hybrid') {
      hasActiveSubscription = true;
    } else {
      // Fallback: check stripe_subscriptions table
      try {
        const { data: activeSub } = await admin
          .from('stripe_subscriptions')
          .select('id')
          .eq('email', email.toLowerCase())
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (activeSub) hasActiveSubscription = true;
      } catch {
        // non-blocking
      }
    }

    const newMembershipType = hasActiveSubscription ? 'hybrid' : 'package';

    try {
      await admin
        .from('profiles')
        .update({
          coaching_expires_at: newExpiresAt,
          is_member: true,
          membership_type: newMembershipType,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .throwOnError();
    } catch {
      // non-blocking
    }

    // Resolve any earlier pending entitlements
    await resolvePendingEntitlements(admin, { email, flow: 'checkout' });

    // Forward to AG-Agent for Sheet/TZ/email
    try {
      const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';
      const nameParts = fullName.split(' ');

      const agentPayload = {
        email,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        month_count: monthCount,
        total_price: amountKr,
        current_expires_at: profile.coaching_expires_at || '',
        new_expires_at: newExpiresAt,
        payment_method: 'stripe',
      };

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${agentBaseUrl}/api/economy/forlangning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) break;
        } catch {
          // retry
        }
      }
    } catch {
      // non-blocking
    }
  } else {
    // ── New client: create pending entitlement + notify AG-Agent ──

    // Calculate expected expiry (from now + monthCount months)
    const expectedExpiry = new Date();
    expectedExpiry.setMonth(expectedExpiry.getMonth() + monthCount);
    const expectedExpiresAt = expectedExpiry.toISOString().split('T')[0];

    await createPendingEntitlement(admin, {
      email,
      flow: 'package',
      metadata: {
        plan_id: planId,
        plan_label: planLabel,
        month_count: monthCount,
        amount: amountKr,
        full_name: fullName,
        payment_intent_id: pi.id,
        new_expires_at: expectedExpiresAt,
      },
    });

    // Forward to AG-Agent for Sheet write + admin email + welcome email
    // TZ is skipped for new clients (created later via startformulär)
    try {
      const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';

      const agentPayload = {
        email,
        full_name: fullName,
        plan_label: planLabel,
        month_count: monthCount,
        amount: amountKr,
        new_expires_at: expectedExpiresAt,
        payment_method: 'stripe',
        is_subscription: false,
      };

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${agentBaseUrl}/api/economy/new-checkout-client`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) break;
        } catch {
          // retry
        }
      }
    } catch {
      // non-blocking — pending entitlement ensures client gets provisioned on registration
    }
  }

  // Activity log (non-blocking)
  try {
    await admin.from('agent_activity_log').insert({
      type: 'membership',
      title: profile
        ? `Paket köp (förlängning): ${fullName || email}`
        : `Nytt paket köp: ${fullName || email} (väntar på registrering)`,
      summary: profile
        ? `${planLabel} (${monthCount} mån) köpt för ${amountKr} kr. coaching_expires_at uppdaterat.`
        : `${planLabel} (${monthCount} mån) köpt för ${amountKr} kr. Väntande — kund har inte registrerat sig ännu.`,
      status: 'done',
      client_name: fullName || email,
      metadata: { pi_id: pi.id, email, planId, monthCount, amountKr, hasProfile: !!profile },
    }).throwOnError();
  } catch {
    // non-blocking
  }
}

/**
 * Process a renewal PaymentIntent (flow === 'renewal').
 *
 * Unlike processPackagePurchase which adds months additively,
 * renewal sets coaching_expires_at to the exact date from metadata
 * (typically Dec 31 of the campaign year).
 */
async function processRenewalPurchase(admin: any, pi: Stripe.PaymentIntent) {
  const meta = pi.metadata || {};
  const email = (meta.email || '').trim().toLowerCase();
  const monthCount = parseInt(meta.month_count || '0', 10);
  const planLabel = meta.plan_label || '';
  const userId = meta.user_id || '';
  const fullName = meta.full_name || '';
  const amountKr = Math.round((pi.amount || 0) / 100);
  const newExpiresAt = meta.new_expires_at || '';
  const currentExpiresAt = meta.current_expires_at || '';
  const billingStartsAt = meta.billing_starts_at || '';
  const campaignYear = meta.campaign_year || '';

  if (!email || !newExpiresAt) {
    console.error('processRenewalPurchase: missing email or new_expires_at', { email, newExpiresAt, piId: pi.id });
    return;
  }

  // Mark transaction as paid
  await markTransaction(admin, {
    paymentIntentId: pi.id,
    status: 'paid',
    metadata: meta,
  });

  // Find existing profile
  const profileId = await resolveProfileId(admin, userId || undefined, email);
  const profile = profileId ? await findProfileById(admin, profileId) : null;

  if (profile) {
    // ── Existing client: set coaching_expires_at to exact date (NOT additive) ──
    let hasActiveSubscription = false;
    if (profile.membership_type === 'subscription' || profile.membership_type === 'hybrid') {
      hasActiveSubscription = true;
    } else {
      try {
        const { data: activeSub } = await admin
          .from('stripe_subscriptions')
          .select('id')
          .eq('email', email.toLowerCase())
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (activeSub) hasActiveSubscription = true;
      } catch {
        // non-blocking
      }
    }

    const newMembershipType = hasActiveSubscription ? 'hybrid' : 'package';

    try {
      await admin
        .from('profiles')
        .update({
          coaching_expires_at: newExpiresAt,
          is_member: true,
          membership_type: newMembershipType,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .throwOnError();
    } catch {
      // non-blocking
    }

    // Resolve pending entitlements
    await resolvePendingEntitlements(admin, { email, flow: 'renewal' });

    // Forward to AG-Agent for Sheet/TZ/email
    try {
      const agentBaseUrl = process.env.ANTIGRAVITY_AGENT_URL || 'https://ag3nt-g3ew.onrender.com';
      const nameParts = fullName.split(' ');

      const agentPayload = {
        email,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        month_count: monthCount,
        total_price: amountKr,
        current_expires_at: currentExpiresAt || profile.coaching_expires_at || '',
        new_expires_at: newExpiresAt,
        billing_starts_at: billingStartsAt,
        payment_method: 'stripe',
        campaign_year: parseInt(campaignYear, 10) || new Date().getFullYear(),
      };

      let agentOk = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${agentBaseUrl}/api/economy/forlangning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            agentOk = true;
            break;
          }
          console.error(`Agent renewal attempt ${attempt} got ${res.status}`);
        } catch (fetchErr: any) {
          console.error(`Agent renewal attempt ${attempt} failed:`, fetchErr?.message);
        }
      }

      // Log failure to activity log so it's visible in the dashboard
      if (!agentOk) {
        try {
          await admin.from('agent_activity_log').insert({
            type: 'membership',
            title: `⚠️ Renewal AG-Agent misslyckad: ${fullName || email}`,
            summary: `Stripe-betalning OK men AG-Agent nåddes inte. Email: ${email}, Belopp: ${amountKr} kr, Nytt datum: ${newExpiresAt}. Trigga manuellt via /api/economy/forlangning.`,
            status: 'error',
            client_name: fullName || email,
            metadata: { ...agentPayload, pi_id: pi.id, error: 'AG-Agent unreachable after 2 attempts' },
          }).throwOnError();
        } catch { /* best effort */ }
      }
    } catch (agentErr) {
      console.error('Agent renewal call error:', agentErr);
    }
  } else {
    // Renewal without existing profile — unusual but handle gracefully
    // Create pending entitlement with renewal-specific data
    await createPendingEntitlement(admin, {
      email,
      flow: 'renewal',
      metadata: {
        plan_label: planLabel,
        month_count: monthCount,
        amount: amountKr,
        full_name: fullName,
        payment_intent_id: pi.id,
        new_expires_at: newExpiresAt,
        current_expires_at: currentExpiresAt,
        billing_starts_at: billingStartsAt,
        campaign_year: campaignYear,
      },
    });
  }

  // Activity log (non-blocking)
  try {
    await admin.from('agent_activity_log').insert({
      type: 'membership',
      title: `Renewal köp: ${fullName || email}`,
      summary: `${planLabel} (${monthCount} mån) köpt för ${amountKr} kr. coaching_expires_at → ${newExpiresAt}.`,
      status: 'done',
      client_name: fullName || email,
      metadata: { pi_id: pi.id, email, monthCount, amountKr, newExpiresAt, hasProfile: !!profile },
    }).throwOnError();
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
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const meta = pi.metadata || {};
          // Process intents from our checkout flow (not from checkout sessions)
          if (meta.flow === 'checkout' && meta.plan_id && meta.month_count) {
            await processPackagePurchase(admin, pi);
          } else if (meta.flow === 'renewal' && meta.new_expires_at) {
            await processRenewalPurchase(admin, pi);
          }
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
