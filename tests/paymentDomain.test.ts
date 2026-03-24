import { describe, expect, it, vi } from 'vitest';

import {
  buildRefillLineItems,
  computeForlangningOfferFromProfile,
  computeRefillTotals,
  fallbackForFlow,
} from '../api/_shared/paymentDomain';

describe('payment domain helpers', () => {
  it('computes refill totals from known catalog items', () => {
    const totals = computeRefillTotals([
      { id: 'hydro-pulse', qty: 2 },
      { id: 'omega-3', qty: 1 },
    ]);

    expect(totals.itemCount).toBe(3);
    expect(totals.subtotalSek).toBe(877);
  });

  it('builds stripe line items for refill', () => {
    const lineItems = buildRefillLineItems({
      flow: 'refill',
      mode: 'payment',
      refillItems: [{ id: 'bcaa', qty: 2 }],
    });

    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].quantity).toBe(2);
    expect(lineItems[0].price_data?.currency).toBe('sek');
  });

  it('returns fallback links per flow', () => {
    expect(fallbackForFlow('premium', { flow: 'premium', mode: 'subscription' })).toContain('betalning.privatetrainingonline.se');
    expect(
      fallbackForFlow('forlangning', {
        flow: 'forlangning',
        mode: 'payment',
        forlangningOffer: {
          monthlyPrice: 249,
          monthCount: 6,
          totalPrice: 1494,
          campaignYear: 2026,
          billableDays: 180,
          calculationMode: 'test',
          currentExpiresAt: null,
          billingStartsAt: '2026-07-01',
          newExpiresAt: '2026-12-31',
        },
      }),
    ).toContain('betalning.privatetrainingonline.se');
    expect(fallbackForFlow('refill', { flow: 'refill', mode: 'payment' })).toBeNull();
  });

  it('computes forlangning offer from server-side profile expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T00:00:00.000Z'));

    const offer = computeForlangningOfferFromProfile('2026-06-30');

    expect(offer.billingStartsAt).toBe('2026-07-01');
    expect(offer.newExpiresAt).toBe('2026-12-31');
    expect(offer.monthCount).toBe(6);
    expect(offer.totalPrice).toBe(1494);

    vi.useRealTimers();
  });
});
