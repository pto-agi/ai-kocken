import type { RenewalPipeline } from './renewalPipeline';

export type SalesOverview = {
    expectedRenewals30d: number;
    expectedRevenue30d: number;
    criticalCount: number;
    warningCount: number;
    upcomingCount: number;
    avgRevenuePerClient: number;
};

const DEFAULT_REVENUE_PER_CLIENT = 2_495; // Average of 6m (1995) and 12m (2995)

export function computeSalesOverview(
    pipeline: RenewalPipeline,
    revenuePerClient: number = DEFAULT_REVENUE_PER_CLIENT,
): SalesOverview {
    const expectedRenewals30d = pipeline.total;
    const expectedRevenue30d = expectedRenewals30d * revenuePerClient;

    return {
        expectedRenewals30d,
        expectedRevenue30d,
        criticalCount: pipeline.critical.length,
        warningCount: pipeline.warning.length,
        upcomingCount: pipeline.upcoming.length,
        avgRevenuePerClient: revenuePerClient,
    };
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
