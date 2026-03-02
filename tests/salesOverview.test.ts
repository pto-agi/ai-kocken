import { describe, expect, it } from 'vitest';
import { computeSalesOverview, formatCurrency } from '../utils/salesOverview';
import type { RenewalPipeline, RenewalClient } from '../utils/renewalPipeline';

function makeClient(overrides: Partial<RenewalClient> = {}): RenewalClient {
    return {
        id: 'u1',
        full_name: 'Test',
        email: 'test@test.com',
        coaching_expires_at: '2026-03-10',
        daysLeft: 8,
        zone: 'warning',
        ...overrides,
    };
}

describe('computeSalesOverview', () => {
    it('returns zeros for empty pipeline', () => {
        const pipeline: RenewalPipeline = { critical: [], warning: [], upcoming: [], total: 0 };
        const result = computeSalesOverview(pipeline);
        expect(result.expectedRenewals30d).toBe(0);
        expect(result.expectedRevenue30d).toBe(0);
    });

    it('computes revenue from pipeline total', () => {
        const pipeline: RenewalPipeline = {
            critical: [makeClient({ zone: 'critical' })],
            warning: [makeClient(), makeClient()],
            upcoming: [],
            total: 3,
        };
        const result = computeSalesOverview(pipeline, 2000);
        expect(result.expectedRenewals30d).toBe(3);
        expect(result.expectedRevenue30d).toBe(6000);
        expect(result.criticalCount).toBe(1);
        expect(result.warningCount).toBe(2);
    });
});

describe('formatCurrency', () => {
    it('formats SEK correctly', () => {
        const result = formatCurrency(12345);
        expect(result).toContain('12');
        expect(result).toContain('345');
    });
});
