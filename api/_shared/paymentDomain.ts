import type Stripe from 'stripe';

import {
  LEGACY_PAYMENT_LINKS,
  pickForlangningFallback,
  type CheckoutFlow,
} from './paymentConstants';
import { REFILL_PRODUCT_MAP } from './refillCatalog';
import type {
  CreateCheckoutSessionPayload,
  ForlangningOfferPayload,
  RefillCheckoutItem,
  RefillShipping,
} from './paymentTypes';
import { computeYearEndOffer } from './extensionOffer';

function env(name: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : '';
}

function parseForlangningMonthlyPrice(): number | undefined {
  const raw = env('STRIPE_FORLANGNING_MONTHLY_PRICE_SEK') || env('FORLANGNING_MONTHLY_PRICE_SEK');
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed);
}

function asPositiveInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded <= 0) return null;
  return rounded;
}

export function fallbackForFlow(flow: CheckoutFlow, payload: CreateCheckoutSessionPayload): string | null {
  if (flow === 'premium') return LEGACY_PAYMENT_LINKS.premium;
  if (flow === 'forlangning') return pickForlangningFallback(payload.forlangningOffer?.monthCount ?? null);
  return null;
}

export function buildPremiumLineItems(): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const premiumPriceId = env('STRIPE_PREMIUM_PRICE_ID');
  if (premiumPriceId) {
    return [{ price: premiumPriceId, quantity: 1 }];
  }

  const amountOre = asPositiveInt(env('STRIPE_PREMIUM_MONTHLY_AMOUNT_ORE')) || 29900;
  return [
    {
      quantity: 1,
      price_data: {
        currency: 'sek',
        recurring: { interval: 'month' },
        unit_amount: amountOre,
        product_data: {
          name: env('STRIPE_PREMIUM_PRODUCT_NAME') || 'PTO Premium (Månadsvis)',
          description: 'Månadsvis premium-medlemskap hos Private Training Online',
        },
      },
    },
  ];
}

export function buildForlangningLineItems(payload: CreateCheckoutSessionPayload): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const offer = payload.forlangningOffer;
  if (!offer) {
    throw new Error('Missing forlangningOffer');
  }
  const amountOre = asPositiveInt(Math.round(offer.totalPrice * 100));
  if (!amountOre) throw new Error('Invalid forlangning total price');

  return [
    {
      quantity: 1,
      price_data: {
        currency: 'sek',
        unit_amount: amountOre,
        product_data: {
          name: `Förlängning (${Math.round(offer.monthCount)} mån)`,
          description: `Kampanj ${offer.campaignYear} – nytt utgångsdatum ${offer.newExpiresAt}`,
        },
      },
    },
  ];
}

export function computeForlangningOfferFromProfile(coachingExpiresAt: string | null | undefined): ForlangningOfferPayload {
  const offer = computeYearEndOffer({
    coachingExpiresAt: coachingExpiresAt || null,
    monthlyPrice: parseForlangningMonthlyPrice(),
  });

  return {
    monthlyPrice: offer.monthlyPrice,
    monthCount: offer.monthCount,
    totalPrice: offer.totalPrice,
    campaignYear: offer.campaignYear,
    billableDays: offer.billableDays,
    calculationMode: offer.calculationMode,
    currentExpiresAt: offer.currentExpiresAt,
    billingStartsAt: offer.billingStartsAt,
    newExpiresAt: offer.newExpiresAt,
  };
}

function normalizeRefillItems(items: RefillCheckoutItem[]): RefillCheckoutItem[] {
  return items
    .map((item) => ({
      id: String(item?.id || '').trim(),
      qty: asPositiveInt(item?.qty) || 0,
    }))
    .filter((item) => item.id && item.qty > 0);
}

export function buildRefillLineItems(payload: CreateCheckoutSessionPayload): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const normalized = normalizeRefillItems(payload.refillItems || []);
  if (!normalized.length) throw new Error('Missing refill items');

  return normalized.map((item) => {
    const catalog = REFILL_PRODUCT_MAP[item.id];
    if (!catalog) throw new Error(`Unsupported refill item: ${item.id}`);
    return {
      quantity: item.qty,
      price_data: {
        currency: 'sek',
        unit_amount: Math.round(catalog.memberPrice * 100),
        product_data: {
          name: catalog.title,
          description: catalog.description,
        },
      },
    };
  });
}

export function computeRefillTotals(items: RefillCheckoutItem[]): { itemCount: number; subtotalSek: number } {
  const normalized = normalizeRefillItems(items);
  let itemCount = 0;
  let subtotalSek = 0;
  for (const item of normalized) {
    const catalog = REFILL_PRODUCT_MAP[item.id];
    if (!catalog) continue;
    itemCount += item.qty;
    subtotalSek += item.qty * catalog.memberPrice;
  }
  return { itemCount, subtotalSek };
}

function requiredShippingField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeShipping(shipping: RefillShipping | undefined): RefillShipping {
  const safe = shipping || {
    name: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
    phone: '',
  };

  return {
    name: requiredShippingField(safe.name),
    line1: requiredShippingField(safe.line1),
    line2: requiredShippingField(safe.line2),
    postalCode: requiredShippingField(safe.postalCode),
    city: requiredShippingField(safe.city),
    country: requiredShippingField(safe.country) || 'Sverige',
    phone: requiredShippingField(safe.phone),
  };
}

export function validateShipping(shipping: RefillShipping): boolean {
  const phoneDigits = shipping.phone.replace(/\D/g, '');
  return Boolean(
    shipping.line1 &&
      shipping.postalCode &&
      shipping.city &&
      shipping.country &&
      phoneDigits.length >= 7,
  );
}
