import { describe, expect, it } from 'vitest';
import { buildRenewalPipeline } from '../utils/renewalPipeline';

const today = new Date('2026-03-02');

function makeProfile(overrides: Record<string, unknown> = {}) {
    return {
        id: 'user-1',
        full_name: 'Test User',
        email: 'test@example.com',
        coaching_expires_at: null as string | null,
        subscription_status: 'active' as string | null,
        ...overrides,
    };
}

describe('buildRenewalPipeline', () => {
    it('buckets profile expiring in 3 days as critical', () => {
        const result = buildRenewalPipeline([makeProfile({ coaching_expires_at: '2026-03-05' })], today);
        expect(result.critical).toHaveLength(1);
        expect(result.critical[0].daysLeft).toBe(3);
        expect(result.critical[0].zone).toBe('critical');
        expect(result.warning).toHaveLength(0);
        expect(result.upcoming).toHaveLength(0);
    });

    it('buckets profile expiring in 10 days as warning', () => {
        const result = buildRenewalPipeline([makeProfile({ coaching_expires_at: '2026-03-12' })], today);
        expect(result.warning).toHaveLength(1);
        expect(result.warning[0].daysLeft).toBe(10);
        expect(result.warning[0].zone).toBe('warning');
    });

    it('buckets profile expiring in 25 days as upcoming', () => {
        const result = buildRenewalPipeline([makeProfile({ coaching_expires_at: '2026-03-27' })], today);
        expect(result.upcoming).toHaveLength(1);
        expect(result.upcoming[0].daysLeft).toBe(25);
        expect(result.upcoming[0].zone).toBe('upcoming');
    });

    it('ignores profiles with subscription_status = paused', () => {
        const result = buildRenewalPipeline([
            makeProfile({ coaching_expires_at: '2026-03-05', subscription_status: 'paused' }),
        ], today);
        expect(result.total).toBe(0);
    });

    it('ignores profiles without coaching_expires_at', () => {
        const result = buildRenewalPipeline([makeProfile()], today);
        expect(result.total).toBe(0);
    });

    it('ignores already-expired profiles', () => {
        const result = buildRenewalPipeline([
            makeProfile({ coaching_expires_at: '2026-02-28' }),
        ], today);
        expect(result.total).toBe(0);
    });

    it('ignores profiles expiring beyond 30 days', () => {
        const result = buildRenewalPipeline([
            makeProfile({ coaching_expires_at: '2026-05-01' }),
        ], today);
        expect(result.total).toBe(0);
    });

    it('returns empty buckets for no matching profiles', () => {
        const result = buildRenewalPipeline([], today);
        expect(result.critical).toHaveLength(0);
        expect(result.warning).toHaveLength(0);
        expect(result.upcoming).toHaveLength(0);
        expect(result.total).toBe(0);
    });

    it('sorts each bucket by daysLeft ascending', () => {
        const result = buildRenewalPipeline([
            makeProfile({ id: 'a', coaching_expires_at: '2026-03-07' }),
            makeProfile({ id: 'b', coaching_expires_at: '2026-03-03' }),
            makeProfile({ id: 'c', coaching_expires_at: '2026-03-05' }),
        ], today);
        expect(result.critical.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    });

    it('treats profile with null subscription_status as active', () => {
        const result = buildRenewalPipeline([
            makeProfile({ coaching_expires_at: '2026-03-05', subscription_status: null }),
        ], today);
        expect(result.critical).toHaveLength(1);
    });
});
