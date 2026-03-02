import { describe, expect, it } from 'vitest';
import { computeRenewalNudge } from '../utils/renewalNudge';

const today = new Date('2026-03-02');

describe('computeRenewalNudge', () => {
    it('returns show:false for null profile', () => {
        expect(computeRenewalNudge(null, today).show).toBe(false);
    });

    it('returns show:false without coaching_expires_at', () => {
        expect(computeRenewalNudge({ coaching_expires_at: null }, today).show).toBe(false);
    });

    it('returns show:false for already expired', () => {
        expect(computeRenewalNudge({ coaching_expires_at: '2026-02-28' }, today).show).toBe(false);
    });

    it('returns show:false for >30 days out', () => {
        expect(computeRenewalNudge({ coaching_expires_at: '2026-05-01' }, today).show).toBe(false);
    });

    it('returns critical for ≤7 days', () => {
        const result = computeRenewalNudge({ coaching_expires_at: '2026-03-05' }, today);
        expect(result.show).toBe(true);
        expect(result.urgency).toBe('critical');
        expect(result.daysLeft).toBe(3);
    });

    it('returns warning for 8-14 days', () => {
        const result = computeRenewalNudge({ coaching_expires_at: '2026-03-12' }, today);
        expect(result.show).toBe(true);
        expect(result.urgency).toBe('warning');
    });

    it('returns info for 15-30 days', () => {
        const result = computeRenewalNudge({ coaching_expires_at: '2026-03-25' }, today);
        expect(result.show).toBe(true);
        expect(result.urgency).toBe('info');
    });

    it('includes prefilled email in URLs', () => {
        const result = computeRenewalNudge(
            { coaching_expires_at: '2026-03-05', email: 'test@example.com' },
            today,
        );
        expect(result.renewalUrl6).toContain('prefilled_email=test%40example.com');
        expect(result.renewalUrl12).toContain('prefilled_email=test%40example.com');
    });
});
