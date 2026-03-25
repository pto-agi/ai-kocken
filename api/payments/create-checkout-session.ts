import type Stripe from 'stripe';

import { getBearerToken, isAllowedOrigin, readJsonBody, setCors } from '../_shared/apiHelpers.js';
import {
  computeForlangningOfferFromProfile,
  fallbackForFlow,
  buildForlangningLineItems,
  buildPremiumLineItems,
  buildRefillLineItems,
  computeRefillTotals,
  normalizeShipping,
  validateShipping,
} from '../_shared/paymentDomain.js';
import {
  getRequestBaseUrl,
  getStripeClient,
  getStripePublishableKey,
  getSupabaseAdmin,
  isFlagEnabled,
  resolveAuthUser,
} from '../_shared/paymentHelpers.js';
import type { CheckoutFlow } from '../_shared/paymentConstants.js';
import type { CreateCheckoutSessionPayload } from '../_shared/paymentTypes.js';

type SessionMode = 'payment' | 'subscription';

function isCheckoutFlow(value: unknown): value is CheckoutFlow {
  return value === 'premium' || value === 'forlangning' || value === 'refill';
}

function preferredMode(flow: CheckoutFlow): SessionMode {
  if (flow === 'premium') return 'subscription';
  return 'payment';
}

function toPathOrDefault(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  return trimmed;
}

function addQuery(path: string, query: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

async function upsertBillingCustomer(params: {
  email: string;
  fullName?: string;
  userId?: string;
  flow: CheckoutFlow;
}) {
  const stripe = getStripeClient();
  const admin = getSupabaseAdmin();
  const normalizedEmail = params.email.toLowerCase();

  let existingStripeCustomerId: string | null = null;
  if (admin) {
    const { data } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();
    existingStripeCustomerId = (data?.stripe_customer_id as string | undefined) || null;
  }

  if (existingStripeCustomerId) return existingStripeCustomerId;

  const customer = await stripe.customers.create({
    email: normalizedEmail,
    name: params.fullName || undefined,
    metadata: {
      source: 'my-pto-checkout',
      flow: params.flow,
      user_id: params.userId || '',
    },
  });

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
      // Non-blocking: checkout should still continue if mapping table is not available yet.
    }
  }

  return customer.id;
}

async function createPendingRefillOrder(payload: CreateCheckoutSessionPayload) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  if (!payload.refillItems?.length || !payload.refillShipping) return null;

  const totals = computeRefillTotals(payload.refillItems);
  const shipping = normalizeShipping(payload.refillShipping);
  if (!totals.itemCount || !validateShipping(shipping)) return null;

  const row = {
    user_id: payload.userId || null,
    email: payload.email || null,
    customer_name: payload.fullName || shipping.name || '',
    source: 'refill_checkout',
    status: 'pending_payment',
    payment_status: 'pending',
    items: payload.refillItems,
    item_count: totals.itemCount,
    subtotal: totals.subtotalSek,
    currency: 'SEK',
    shipping_name: shipping.name,
    shipping_line1: shipping.line1,
    shipping_line2: shipping.line2 || '',
    shipping_postal_code: shipping.postalCode,
    shipping_city: shipping.city,
    shipping_country: shipping.country,
    shipping_phone: shipping.phone,
  };

  let data: { id?: string } | null = null;
  try {
    const result = await admin
      .from('orders')
      .insert([row])
      .select('id')
      .limit(1)
      .maybeSingle()
      .throwOnError();
    data = (result?.data as { id?: string } | null) || null;
  } catch {
    data = null;
  }

  return (data?.id as string | undefined) || null;
}

async function getProfileCoachingExpiresAt(admin: any, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('coaching_expires_at')
      .eq('id', userId)
      .limit(1)
      .maybeSingle()
      .throwOnError();
    return typeof data?.coaching_expires_at === 'string' ? data.coaching_expires_at : null;
  } catch {
    return null;
  }
}

async function buildCheckoutSessionParams(stripe: Stripe, input: {
  flow: CheckoutFlow;
  mode: SessionMode;
  payload: CreateCheckoutSessionPayload;
  customerId?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  orderId?: string | null;
}): Promise<Stripe.Checkout.SessionCreateParams> {
  const { flow, mode, payload } = input;
  const metadata: Record<string, string> = {
    flow,
    mode,
    user_id: payload.userId || '',
    email: payload.email || '',
  };

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (flow === 'premium') {
    lineItems = await buildPremiumLineItems(stripe);
  } else if (flow === 'forlangning') {
    lineItems = await buildForlangningLineItems(stripe, payload);
    metadata.new_expires_at = payload.forlangningOffer?.newExpiresAt || '';
    metadata.current_expires_at = payload.forlangningOffer?.currentExpiresAt || '';
    metadata.billing_starts_at = payload.forlangningOffer?.billingStartsAt || '';
    metadata.month_count = String(payload.forlangningOffer?.monthCount || '');
    metadata.total_price = String(payload.forlangningOffer?.totalPrice || '');
  } else {
    lineItems = await buildRefillLineItems(stripe, payload);
    metadata.order_id = input.orderId || '';
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    ui_mode: 'embedded',
    mode,
    locale: 'sv',
    return_url: addQuery(input.successUrl, 'session_id={CHECKOUT_SESSION_ID}'),
    line_items: lineItems,
    metadata,
    payment_method_types: mode === 'subscription' ? ['card', 'link'] : ['card', 'klarna', 'link'],
    customer: input.customerId || undefined,
    customer_email: !input.customerId ? input.customerEmail || undefined : undefined,
    allow_promotion_codes: true,
    client_reference_id: payload.userId || payload.email || undefined,
    redirect_on_completion: 'always',
  };

  if (flow === 'refill') {
    params.shipping_address_collection = { allowed_countries: ['SE'] };
    params.phone_number_collection = { enabled: true };
    params.submit_type = 'pay';
  }

  params.after_expiration = {
    recovery: {
      enabled: true,
      allow_promotion_codes: true,
    },
  };

  return params;
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

  const payload = (await readJsonBody(req)) as CreateCheckoutSessionPayload;

  if (!isCheckoutFlow(payload.flow)) {
    setCors(res, origin);
    res.status(400).json({ error: 'Invalid flow' });
    return;
  }

  const flow = payload.flow;
  const mode = payload.mode === 'subscription' || payload.mode === 'payment'
    ? payload.mode
    : preferredMode(flow);

  if (flow === 'premium' && mode !== 'subscription') {
    setCors(res, origin);
    res.status(400).json({ error: 'Premium requires subscription mode' });
    return;
  }

  if (flow !== 'premium' && mode !== 'payment') {
    setCors(res, origin);
    res.status(400).json({ error: `${flow} requires payment mode` });
    return;
  }

  const v2Enabled = isFlagEnabled('PAYMENTS_V2_ENABLED', true);
  const v2RefillEnabled = isFlagEnabled('PAYMENTS_V2_REFILL_ENABLED', true);
  const fallbackEnabled = isFlagEnabled('PAYMENTS_V2_FALLBACK_LINKS_ENABLED', true);

  if (!v2Enabled || (flow === 'refill' && !v2RefillEnabled)) {
    const fallbackUrl = fallbackForFlow(flow, payload);
    if (fallbackEnabled && fallbackUrl) {
      setCors(res, origin);
      res.status(200).json({ ok: true, fallback: true, fallback_url: fallbackUrl });
      return;
    }
    setCors(res, origin);
    res.status(409).json({ error: 'Payments v2 is disabled for this flow' });
    return;
  }

  const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
  const authUser = await resolveAuthUser(accessToken);
  if (flow === 'forlangning' && !authUser?.id) {
    setCors(res, origin);
    res.status(401).json({ error: 'Inloggning krävs för förlängning.' });
    return;
  }

  const userId = authUser?.id || undefined;
  const userEmail = authUser?.email || payload.email || undefined;
  const fullName = payload.fullName || undefined;

  let computedForlangningOffer = payload.forlangningOffer;
  if (flow === 'forlangning') {
    if (!userId) {
      setCors(res, origin);
      res.status(401).json({ error: 'Inloggning krävs för förlängning.' });
      return;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      setCors(res, origin);
      res.status(500).json({ error: 'Supabase admin is not configured' });
      return;
    }

    const coachingExpiresAt = await getProfileCoachingExpiresAt(admin, userId);
    computedForlangningOffer = computeForlangningOfferFromProfile(coachingExpiresAt);
    if (computedForlangningOffer.totalPrice <= 0 || computedForlangningOffer.monthCount <= 0) {
      setCors(res, origin);
      res.status(409).json({ error: 'Ingen aktiv förlängning behövs just nu.' });
      return;
    }
  }

  const nextPayload: CreateCheckoutSessionPayload = {
    ...payload,
    userId,
    email: userEmail,
    fullName,
    ...(flow === 'forlangning' ? { forlangningOffer: computedForlangningOffer } : {}),
  };

  const baseUrl = getRequestBaseUrl(req);
  if (!baseUrl) {
    setCors(res, origin);
    res.status(500).json({ error: 'Could not resolve base url' });
    return;
  }

  const successPath = toPathOrDefault(payload.successPath, flow === 'refill' ? '/refill/tack' : flow === 'forlangning' ? '/tack-forlangning' : '/premium');
  const cancelPath = toPathOrDefault(payload.cancelPath, flow === 'refill' ? '/refill' : flow === 'forlangning' ? '/forlangning' : '/premium');
  const successUrl = `${baseUrl}${successPath}`;
  const cancelUrl = `${baseUrl}${cancelPath}`;

  // -----------------------------------------------------------------------
  // Friskvårdsbidrag — bypass Stripe entirely
  // -----------------------------------------------------------------------
  if (payload.paymentMethod === 'friskvardsbidrag' && (flow === 'premium' || flow === 'forlangning')) {
    const admin = getSupabaseAdmin();
    if (!admin) {
      setCors(res, origin);
      res.status(500).json({ error: 'Supabase admin is not configured' });
      return;
    }

    const amountSek = flow === 'forlangning'
      ? Math.round(computedForlangningOffer?.totalPrice || 0)
      : Math.round((Number(process.env.STRIPE_PREMIUM_MONTHLY_AMOUNT_ORE || '29900')) / 100);

    const orderMetadata: Record<string, unknown> = {
      flow,
      fullName: fullName || '',
    };
    if (flow === 'forlangning' && computedForlangningOffer) {
      orderMetadata.monthCount = computedForlangningOffer.monthCount;
      orderMetadata.newExpiresAt = computedForlangningOffer.newExpiresAt;
      orderMetadata.currentExpiresAt = computedForlangningOffer.currentExpiresAt;
      orderMetadata.billingStartsAt = computedForlangningOffer.billingStartsAt;
      orderMetadata.campaignYear = computedForlangningOffer.campaignYear;
    }

    const { data: order, error: insertError } = await admin
      .from('friskvard_orders')
      .insert({
        user_id: userId,
        email: userEmail || '',
        flow,
        status: 'pending',
        amount_sek: amountSek,
        metadata: orderMetadata,
      })
      .select('id')
      .single();

    if (insertError || !order) {
      console.error('friskvard insert failed', insertError);
      setCors(res, origin);
      res.status(500).json({ error: 'Kunde inte registrera friskvårdsbeställning.' });
      return;
    }

    // Send emails (non-blocking)
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey) {
      const { buildBaseEmailLayout, sendResendEmail, DEFAULT_FROM, DEFAULT_TO } = await import('../_shared/emailHelpers.js');
      const flowLabel = flow === 'forlangning' ? 'Förlängning' : 'Premium';
      const customerName = fullName || userEmail || 'Kund';

      // Email to customer
      const customerHtml = buildBaseEmailLayout({
        title: 'Bekräftelse – Friskvårdsbidrag',
        subtitle: `Tack ${customerName}! Vi har mottagit din beställning.`,
        bodyHtml: `
          <table cellspacing="0" cellpadding="6" style="width:100%;font-size:13px;color:#3D3D3D;">
            <tr><td style="font-weight:700">Tjänst</td><td>${flowLabel}</td></tr>
            <tr><td style="font-weight:700">Belopp</td><td>${amountSek} kr</td></tr>
            <tr><td style="font-weight:700">Betalning</td><td>Friskvårdsbidrag</td></tr>
            <tr><td style="font-weight:700">Status</td><td>Väntar på godkännande</td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:13px;color:#6B6158;">
            Din beställning behandlas manuellt och aktiveras efter godkännande av administratör.
          </p>`,
      });
      sendResendEmail(resendKey, {
        from: DEFAULT_FROM,
        to: [userEmail || ''].filter(Boolean),
        subject: `Bekräftelse – Friskvårdsbidrag (${flowLabel})`,
        text: `Tack! Vi har mottagit din friskvårdsbeställning för ${flowLabel}. Belopp: ${amountSek} kr. Status: väntar på godkännande.`,
        html: customerHtml,
      }).catch((e: any) => console.error('friskvard customer email failed', e));

      // Email to admin
      const adminRecipients = (process.env.RESEND_FORM_TO || DEFAULT_TO).split(',').map((s: string) => s.trim()).filter(Boolean);
      const appBaseUrl = getRequestBaseUrl(req) || 'https://my.privatetrainingonline.se';
      const adminHtml = buildBaseEmailLayout({
        title: 'Ny friskvårdsbeställning',
        badge: 'Admin-notis',
        bodyHtml: `
          <table cellspacing="0" cellpadding="6" style="width:100%;font-size:13px;color:#3D3D3D;">
            <tr><td style="font-weight:700">Kund</td><td>${customerName} (${userEmail || '—'})</td></tr>
            <tr><td style="font-weight:700">Tjänst</td><td>${flowLabel}</td></tr>
            <tr><td style="font-weight:700">Belopp</td><td>${amountSek} kr</td></tr>
            ${flow === 'forlangning' && computedForlangningOffer
              ? `<tr><td style="font-weight:700">Nytt utgångsdatum</td><td>${computedForlangningOffer.newExpiresAt}</td></tr>`
              : ''}
            <tr><td style="font-weight:700">Order-ID</td><td style="font-family:monospace;font-size:11px">${order.id}</td></tr>
          </table>`,
        ctaLabel: 'Godkänn i admin',
        ctaHref: `${appBaseUrl}/admin?friskvard=${order.id}`,
      });
      sendResendEmail(resendKey, {
        from: DEFAULT_FROM,
        to: adminRecipients,
        subject: `⚡ Friskvårdsbeställning: ${customerName} – ${flowLabel} (${amountSek} kr)`,
        text: `Ny friskvårdsbeställning från ${customerName}. Tjänst: ${flowLabel}. Belopp: ${amountSek} kr. Order-ID: ${order.id}`,
        html: adminHtml,
      }).catch((e: any) => console.error('friskvard admin email failed', e));
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      flow,
      mode,
      friskvard: true,
      friskvard_order_id: order.id,
    });
    return;
  }

  try {
    const stripe = getStripeClient();
    const publishableKey = getStripePublishableKey();

    let customerId: string | null = null;
    if (userEmail) {
      customerId = await upsertBillingCustomer({
        email: userEmail,
        fullName,
        userId,
        flow,
      });
    }

    let orderId: string | null = null;
    if (flow === 'refill') {
      const shipping = normalizeShipping(nextPayload.refillShipping);
      if (!validateShipping(shipping)) {
        setCors(res, origin);
        res.status(400).json({ error: 'Leveransuppgifter saknas eller är ogiltiga.' });
        return;
      }
      orderId = await createPendingRefillOrder(nextPayload);
      if (!orderId) {
        setCors(res, origin);
        res.status(500).json({ error: 'Kunde inte skapa refill-order inför betalning.' });
        return;
      }
    }

    const params = await buildCheckoutSessionParams(stripe, {
      flow,
      mode,
      payload: nextPayload,
      customerId,
      customerEmail: userEmail || null,
      successUrl,
      cancelUrl,
      orderId,
    });

    const session = await stripe.checkout.sessions.create(params);

    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        if (flow === 'refill' && orderId) {
          await admin
            .from('orders')
            .update({
              checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .throwOnError();
        }

        await admin.from('stripe_transactions').upsert(
          {
            user_id: userId || null,
            email: userEmail || null,
            flow,
            mode,
            status: 'created',
            amount: nextPayload.forlangningOffer?.totalPrice || null,
            currency: 'SEK',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
            order_id: orderId,
            metadata: session.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_checkout_session_id' },
        ).throwOnError();
      } catch {
        // Non-blocking log table write
      }
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      flow,
      mode,
      session_id: session.id,
      client_secret: session.client_secret,
      publishable_key: publishableKey,
      cancel_url: cancelUrl,
      success_url: successUrl,
    });
  } catch (error: any) {
    const fallbackUrl = fallbackForFlow(flow, payload);
    if (fallbackEnabled && fallbackUrl) {
      setCors(res, origin);
      res.status(200).json({ ok: true, fallback: true, fallback_url: fallbackUrl });
      return;
    }

    console.error('create-checkout-session failed', error);
    setCors(res, origin);
    res.status(502).json({ error: error?.message || 'Kunde inte initiera betalning' });
  }
}
