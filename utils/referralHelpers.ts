export type ReferralStatus = 'pending' | 'registered' | 'converted' | 'rewarded';

export type Referral = {
    id: string;
    referrer_id: string;
    referred_email: string;
    referred_user_id?: string | null;
    status: ReferralStatus;
    created_at: string;
    converted_at?: string | null;
    referrer_name?: string | null;
};

export type ReferralTier = {
    name: string;
    emoji: string;
    minReferrals: number;
    reward: string;
    color: string;
    bgColor: string;
};

export const REFERRAL_TIERS: ReferralTier[] = [
    { name: 'Nybörjare', emoji: '🌱', minReferrals: 0, reward: '', color: 'text-gray-500', bgColor: 'bg-gray-100' },
    { name: 'Ambassadör', emoji: '⭐', minReferrals: 1, reward: '10% rabatt på förlängning', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { name: 'Champion', emoji: '🏆', minReferrals: 3, reward: '1 gratis produkt från Shop', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { name: 'Legend', emoji: '💎', minReferrals: 5, reward: '1 bonusmånad', color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { name: 'Elite', emoji: '👑', minReferrals: 10, reward: '3 bonusmånader + VIP-status', color: 'text-rose-600', bgColor: 'bg-rose-50' },
];

export function getCurrentTier(convertedCount: number): ReferralTier {
    let tier = REFERRAL_TIERS[0];
    for (const t of REFERRAL_TIERS) {
        if (convertedCount >= t.minReferrals) tier = t;
    }
    return tier;
}

export function getNextTier(convertedCount: number): ReferralTier | null {
    for (const t of REFERRAL_TIERS) {
        if (convertedCount < t.minReferrals) return t;
    }
    return null;
}

export function getReferralsToNextTier(convertedCount: number): number {
    const next = getNextTier(convertedCount);
    if (!next) return 0;
    return next.minReferrals - convertedCount;
}

export type ReferralSummary = {
    total: number;
    pending: number;
    registered: number;
    converted: number;
    rewarded: number;
    topReferrers: { name: string; count: number }[];
};

export function computeReferralSummary(referrals: Referral[]): ReferralSummary {
    const counts: Record<ReferralStatus, number> = {
        pending: 0,
        registered: 0,
        converted: 0,
        rewarded: 0,
    };

    const referrerCounts = new Map<string, { name: string; count: number }>();

    for (const r of referrals) {
        counts[r.status]++;
        const key = r.referrer_id;
        const existing = referrerCounts.get(key);
        if (existing) {
            existing.count++;
        } else {
            referrerCounts.set(key, { name: r.referrer_name || r.referrer_id, count: 1 });
        }
    }

    const topReferrers = [...referrerCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        total: referrals.length,
        ...counts,
        topReferrers,
    };
}

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
    pending: 'Väntande',
    registered: 'Registrerad',
    converted: 'Köpt',
    rewarded: 'Belönad',
};

export const REFERRAL_STATUS_COLORS: Record<ReferralStatus, string> = {
    pending: 'bg-gray-100 text-gray-600',
    registered: 'bg-sky-100 text-sky-700',
    converted: 'bg-amber-100 text-amber-700',
    rewarded: 'bg-emerald-100 text-emerald-700',
};
