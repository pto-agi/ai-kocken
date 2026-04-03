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
  price: number;          // Total price in SEK (campaign/active price)
  priceOre: number;       // Total price in öre (Stripe amount)
  originalPrice?: number; // Original price before campaign discount
  perMonth: number;       // Per-month cost in SEK (for comparison)
  savings?: string;       // e.g. "Spara 33%"
  mode: 'payment' | 'subscription';
  stripePriceId: string;
  monthCount?: number;    // Package duration
  interval?: 'month';     // For subscription
  description?: string;
  isRenewal?: boolean;    // Dynamic renewal plan
  isTrial?: boolean;      // 30-day free trial
  trialDays?: number;     // Trial duration in days
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
    originalPrice: 7800,
    priceOre: 399500,
    perMonth: 333,
    savings: 'Spara 49%',
    mode: 'payment',
    stripePriceId: 'price_1TGmkmCMd1GQRttCQruyEMfM',
    monthCount: 12,
    description: 'Bäst pris per månad',
  },
  {
    id: '6m',
    label: '6 månader',
    price: 2995,
    originalPrice: 3995,
    priceOre: 299500,
    perMonth: 499,
    savings: 'Spara 25%',
    mode: 'payment',
    stripePriceId: 'price_1TGmkVCMd1GQRttCKwPn9lpP',
    monthCount: 6,
  },
  {
    id: '3m',
    label: '3 månader',
    price: 1795,
    originalPrice: 1995,
    priceOre: 179500,
    perMonth: 598,
    savings: 'Spara 10%',
    mode: 'payment',
    stripePriceId: 'price_1TIFOfCMd1GQRttC9hXRvW0r',
    monthCount: 3,
  },
  {
    id: 'monthly',
    label: 'Månadsvis',
    price: 549,
    originalPrice: 695,
    priceOre: 54900,
    perMonth: 549,
    mode: 'subscription',
    stripePriceId: 'price_1THAldCMd1GQRttCG5nNF6JU',
    interval: 'month',
    description: 'Avsluta när du vill',
  },
];

// Trial plan — shown to logged-in users with no active membership
export const TRIAL_PLAN: CheckoutPlan = {
  id: 'trial30',
  label: 'Prova gratis i 30 dagar',
  badge: '🎉 Prova gratis',
  price: 0,
  priceOre: 0,
  perMonth: 0,
  mode: 'subscription',
  stripePriceId: 'price_1THAldCMd1GQRttCG5nNF6JU',
  interval: 'month',
  isTrial: true,
  trialDays: 30,
  description: 'Därefter 549 kr/mån. Avsluta när du vill. Inga bindnings- eller uppsägningstider.',
};

// Hidden test plan — only visible with ?test=1 query param
export const TEST_PLAN: CheckoutPlan = {
  id: 'test1m',
  label: '1 månad (TEST)',
  badge: '🧪 Test',
  price: 3,
  priceOre: 300,
  perMonth: 3,
  mode: 'payment',
  stripePriceId: 'price_1TH9j7CMd1GQRttCrY6XyM1l',
  monthCount: 1,
  description: 'Intern testplan — visas ej för kunder',
};

export function getVisiblePlans(showTest = false): CheckoutPlan[] {
  return showTest ? [...CHECKOUT_PLANS, TEST_PLAN] : CHECKOUT_PLANS;
}

export function getPlanById(id: string): CheckoutPlan | undefined {
  if (id === 'test1m') return TEST_PLAN;
  if (id === 'trial30') return TRIAL_PLAN;
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

