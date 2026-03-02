import { describe, expect, it } from 'vitest';
import { getCurrentTier, getNextTier, getReferralsToNextTier, computeReferralSummary, type Referral } from '../utils/referralHelpers';

describe('getCurrentTier', () => {
    it('returns Nybörjare for 0 referrals', () => {
        expect(getCurrentTier(0).name).toBe('Nybörjare');
    });

    it('returns Ambassadör for 1 referral', () => {
        expect(getCurrentTier(1).name).toBe('Ambassadör');
    });

    it('returns Champion for 3 referrals', () => {
        expect(getCurrentTier(3).name).toBe('Champion');
    });

    it('returns Elite for 10+ referrals', () => {
        expect(getCurrentTier(10).name).toBe('Elite');
        expect(getCurrentTier(15).name).toBe('Elite');
    });
});

describe('getNextTier', () => {
    it('returns Ambassadör as next for 0', () => {
        expect(getNextTier(0)?.name).toBe('Ambassadör');
    });

    it('returns null for max tier', () => {
        expect(getNextTier(10)).toBe(null);
    });
});

describe('getReferralsToNextTier', () => {
    it('returns remaining count', () => {
        expect(getReferralsToNextTier(0)).toBe(1);
        expect(getReferralsToNextTier(2)).toBe(1);
        expect(getReferralsToNextTier(4)).toBe(1);
    });

    it('returns 0 at max', () => {
        expect(getReferralsToNextTier(10)).toBe(0);
    });
});

describe('computeReferralSummary', () => {
    const makeReferral = (overrides: Partial<Referral> = {}): Referral => ({
        id: 'r1',
        referrer_id: 'u1',
        referred_email: 'test@test.com',
        status: 'pending',
        created_at: '2026-01-01',
        referrer_name: 'Test',
        ...overrides,
    });

    it('returns zeros for empty array', () => {
        const result = computeReferralSummary([]);
        expect(result.total).toBe(0);
    });

    it('counts statuses correctly', () => {
        const referrals = [
            makeReferral({ id: '1', status: 'pending' }),
            makeReferral({ id: '2', status: 'registered' }),
            makeReferral({ id: '3', status: 'converted' }),
        ];
        const result = computeReferralSummary(referrals);
        expect(result.total).toBe(3);
        expect(result.pending).toBe(1);
        expect(result.registered).toBe(1);
        expect(result.converted).toBe(1);
    });

    it('ranks top referrers', () => {
        const referrals = [
            makeReferral({ id: '1', referrer_id: 'u1', referrer_name: 'Alice' }),
            makeReferral({ id: '2', referrer_id: 'u1', referrer_name: 'Alice' }),
            makeReferral({ id: '3', referrer_id: 'u2', referrer_name: 'Bob' }),
        ];
        const result = computeReferralSummary(referrals);
        expect(result.topReferrers[0].name).toBe('Alice');
        expect(result.topReferrers[0].count).toBe(2);
    });
});
