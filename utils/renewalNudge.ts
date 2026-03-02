export type RenewalNudge = {
    show: boolean;
    daysLeft: number;
    urgency: 'critical' | 'warning' | 'info';
    message: string;
    renewalUrl6: string;
    renewalUrl12: string;
};

type ProfileInput = {
    coaching_expires_at?: string | null;
    email?: string | null;
};

export function computeRenewalNudge(
    profile: ProfileInput | null,
    today: Date = new Date(),
): RenewalNudge {
    const base: RenewalNudge = {
        show: false,
        daysLeft: Infinity,
        urgency: 'info',
        message: '',
        renewalUrl6: 'https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv',
        renewalUrl12: 'https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv',
    };

    if (!profile?.coaching_expires_at) return base;

    const expiresAt = new Date(profile.coaching_expires_at);
    if (Number.isNaN(expiresAt.getTime())) return base;

    const msPerDay = 86_400_000;
    const utcExpires = Date.UTC(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate());
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const daysLeft = Math.floor((utcExpires - utcToday) / msPerDay);

    if (daysLeft < 0 || daysLeft > 30) return base;

    const email = profile.email || '';
    const suffix = email ? `&prefilled_email=${encodeURIComponent(email)}` : '';

    let urgency: 'critical' | 'warning' | 'info' = 'info';
    let message = '';

    if (daysLeft <= 7) {
        urgency = 'critical';
        message = `Ditt medlemskap går ut om ${daysLeft} dagar. Förläng nu och säkra din plats!`;
    } else if (daysLeft <= 14) {
        urgency = 'warning';
        message = `Ditt medlemskap går ut om ${daysLeft} dagar. Passa på att förlänga till medlemspris.`;
    } else {
        urgency = 'info';
        message = `Ditt medlemskap går ut om ${daysLeft} dagar. Planera din förlängning i lugn och ro.`;
    }

    return {
        show: true,
        daysLeft,
        urgency,
        message,
        renewalUrl6: `${base.renewalUrl6}${suffix}`,
        renewalUrl12: `${base.renewalUrl12}${suffix}`,
    };
}
