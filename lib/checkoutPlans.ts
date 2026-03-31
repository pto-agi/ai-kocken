/**
 * Checkout Plans — shared plan definitions for the checkout page.
 *
 * These map 1:1 to Stripe Price IDs.
 * Package plans (3m/6m/12m) = one-time PaymentIntent
 * Monthly plan = recurring Subscription
 * Renewal plan = dynamic "Förläng året ut" (computed from coaching_expires_at)
 */

import type { YearEndOffer } from '../utils/extensionOffer';

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
  isRenewal?: boolean;    // Dynamic renewal plan
  renewalOffer?: YearEndOffer; // Offer details for renewal
  campaignLabel?: string; // e.g. "Påskkampanj" | "Vårkampanj"
  urgencyText?: string;   // e.g. "Erbjudandet gäller t.o.m. 31 maj"
}

// ── Campaign configuration ──

const CAMPAIGN_DEADLINE = new Date('2026-05-31T23:59:59');

/** Easter 2026 is April 5 — "Påskkampanj" runs until April 14 (week after Easter) */
const EASTER_END = new Date('2026-04-14T23:59:59');

export interface CampaignInfo {
  name: string;          // e.g. "Påskkampanj"
  fullLabel: string;     // e.g. "Förläng året ut (Påskkampanj)"
  urgencyText: string;   // e.g. "3 dagar kvar" or "Tidsbegränsat erbjudande"
  isActive: boolean;     // false if past deadline
  deadline: Date;
}

export function getCampaignInfo(now: Date = new Date()): CampaignInfo {
  const deadline = CAMPAIGN_DEADLINE;
  const isActive = now <= deadline;

  // Determine campaign name by date
  const isEasterPeriod = now <= EASTER_END;
  const name = isEasterPeriod ? 'Påskkampanj' : 'Vårkampanj';
  const fullLabel = `Förläng året ut (${name})`;

  // Build urgency text
  let urgencyText: string;
  if (!isActive) {
    urgencyText = 'Erbjudandet har gått ut';
  } else {
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3) {
      urgencyText = daysLeft === 1 ? 'Sista dagen!' : `${daysLeft} dagar kvar!`;
    } else if (daysLeft <= 14) {
      urgencyText = `${daysLeft} dagar kvar`;
    } else {
      urgencyText = 'Tidsbegränsat erbjudande';
    }
  }

  return { name, fullLabel, urgencyText, isActive, deadline };
}

// ── Standard plans ──

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

// Hidden test plan — only visible with ?test=1 query param
export const TEST_PLAN: CheckoutPlan = {
  id: 'test1m',
  label: '1 månad (TEST)',
  badge: '🧪 Test',
  price: 1,
  priceOre: 100,
  perMonth: 1,
  mode: 'payment',
  stripePriceId: 'price_1TH9fSCMd1GQRttCkizCuOgy',
  monthCount: 1,
  description: 'Intern testplan — visas ej för kunder',
};

export function getVisiblePlans(showTest = false): CheckoutPlan[] {
  return showTest ? [...CHECKOUT_PLANS, TEST_PLAN] : CHECKOUT_PLANS;
}

export function getPlanById(id: string): CheckoutPlan | undefined {
  if (id === 'test1m') return TEST_PLAN;
  return CHECKOUT_PLANS.find((p) => p.id === id);
}

export const DEFAULT_PLAN_ID = '12m';

/**
 * Build a dynamic renewal plan from a year-end offer.
 * Returns null if the offer has 0 months, the campaign has expired,
 * or the price is invalid.
 */
export function buildRenewalPlan(offer: YearEndOffer): CheckoutPlan | null {
  if (offer.monthCount <= 0 || offer.totalPrice <= 0) return null;

  const campaign = getCampaignInfo();
  if (!campaign.isActive) return null;

  const monthCount = Math.ceil(offer.monthCount);
  const perMonth = monthCount > 0 ? Math.round(offer.totalPrice / monthCount) : offer.totalPrice;

  return {
    id: 'renewal',
    label: campaign.fullLabel,
    badge: 'Ditt erbjudande',
    price: offer.totalPrice,
    priceOre: offer.totalPrice * 100,
    perMonth,
    mode: 'payment',
    stripePriceId: '', // Dynamic — handled via forlangning flow
    monthCount,
    description: `Nytt utgångsdatum: ${offer.newExpiresAt}`,
    isRenewal: true,
    renewalOffer: offer,
    campaignLabel: campaign.name,
    urgencyText: campaign.urgencyText,
  };
}

