import { describe, expect, it } from 'vitest';

import { computeYearEndOffer } from '../utils/extensionOffer';

describe('computeYearEndOffer', () => {
  it('uses day-based proration from today when expiry is missing', () => {
    const offer = computeYearEndOffer({ now: '2026-03-05' });

    expect(offer.calculationMode).toBe('daily_prorated');
    expect(offer.billableDays).toBe(302);
    expect(offer.totalPrice).toBe(2472);
    expect(offer.campaignEndsAt).toBe('2026-12-31');
    expect(offer.newExpiresAt).toBe('2026-12-31');
  });

  it('changes day-by-day when there is no expiry date', () => {
    const offerDayOne = computeYearEndOffer({ now: '2026-03-05' });
    const offerDayTwo = computeYearEndOffer({ now: '2026-03-06' });

    expect(offerDayOne.totalPrice).toBe(2472);
    expect(offerDayTwo.totalPrice).toBe(2464);
    expect(offerDayTwo.totalPrice).toBeLessThan(offerDayOne.totalPrice);
  });

  it('uses full months after future expiry date', () => {
    const offer = computeYearEndOffer({
      now: '2026-03-18',
      coachingExpiresAt: '2026-08-01',
    });

    expect(offer.calculationMode).toBe('full_months');
    expect(offer.billingStartsAt).toBe('2026-09-01');
    expect(offer.monthCount).toBe(4);
    expect(offer.totalPrice).toBe(996);
  });

  it('returns zero when current expiry already covers year end campaign', () => {
    const offer = computeYearEndOffer({
      now: '2026-03-05',
      coachingExpiresAt: '2026-12-10',
    });

    expect(offer.monthCount).toBe(0);
    expect(offer.totalPrice).toBe(0);
    expect(offer.billingStartsAt).toBe('2027-01-01');
  });
});
