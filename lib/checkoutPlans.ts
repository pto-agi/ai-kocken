/**
 * Checkout Plans — shared plan definitions for the checkout page.
 *
 * These map 1:1 to Stripe Price IDs.
 * Package plans (3m/6m/12m) = one-time PaymentIntent
 * Monthly plan = recurring Subscription
 */

export interface CheckoutPlan {
  id: string;
  label: string;
  badge?: string;
  price: number;          // Total price in SEK
  priceOre: number;       // Total price in öre (Stripe amount)
  perMonth: number;       // Per-month cost in SEK (for comparison)
  savings?: string;       // e.g. "Spara 33%"
  mode: 'payment' | 'subscription';
  stripePriceId: string;
  monthCount?: number;    // Package duration
  interval?: 'month';     // For subscription
  description?: string;
}

export const CHECKOUT_PLANS: CheckoutPlan[] = [
  {
    id: '12m',
    label: '12 månader',
    badge: 'Populärast',
    price: 3995,
    priceOre: 399500,
    perMonth: 333,
    savings: 'Spara 33%',
    mode: 'payment',
    stripePriceId: 'price_1TGmkmCMd1GQRttCQruyEMfM',
    monthCount: 12,
    description: 'Bäst pris per månad',
  },
  {
    id: '6m',
    label: '6 månader',
    price: 2995,
    priceOre: 299500,
    perMonth: 499,
    mode: 'payment',
    stripePriceId: 'price_1TGmkVCMd1GQRttCKwPn9lpP',
    monthCount: 6,
  },
  {
    id: '3m',
    label: '3 månader',
    price: 1995,
    priceOre: 199500,
    perMonth: 665,
    mode: 'payment',
    stripePriceId: 'price_1TGmkGCMd1GQRttC28TIA4aG',
    monthCount: 3,
  },
  {
    id: 'monthly',
    label: 'Månadsvis',
    price: 495,
    priceOre: 49500,
    perMonth: 495,
    mode: 'subscription',
    stripePriceId: 'price_1TGmidCMd1GQRttC4QMjFroQ',
    interval: 'month',
    description: 'Avsluta när du vill',
  },
];

export function getPlanById(id: string): CheckoutPlan | undefined {
  return CHECKOUT_PLANS.find((p) => p.id === id);
}

export const DEFAULT_PLAN_ID = '12m';
