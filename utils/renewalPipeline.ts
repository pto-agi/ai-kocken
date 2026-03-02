export type RenewalClient = {
  id: string;
  full_name: string | null;
  email: string | null;
  coaching_expires_at: string;
  daysLeft: number;
  zone: 'critical' | 'warning' | 'upcoming';
};

export type RenewalPipeline = {
  critical: RenewalClient[];
  warning: RenewalClient[];
  upcoming: RenewalClient[];
  total: number;
};

type ProfileInput = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  coaching_expires_at?: string | null;
  subscription_status?: string | null;
};

function diffDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcA - utcB) / msPerDay);
}

export function buildRenewalPipeline(
  profiles: ProfileInput[],
  today: Date = new Date(),
): RenewalPipeline {
  const critical: RenewalClient[] = [];
  const warning: RenewalClient[] = [];
  const upcoming: RenewalClient[] = [];

  for (const profile of profiles) {
    if (!profile.coaching_expires_at) continue;
    if (profile.subscription_status && profile.subscription_status !== 'active') continue;

    const expiresAt = new Date(profile.coaching_expires_at);
    if (Number.isNaN(expiresAt.getTime())) continue;

    const daysLeft = diffDays(expiresAt, today);
    if (daysLeft < 0) continue;

    const client: RenewalClient = {
      id: profile.id,
      full_name: profile.full_name ?? null,
      email: profile.email ?? null,
      coaching_expires_at: profile.coaching_expires_at,
      daysLeft,
      zone: daysLeft <= 7 ? 'critical' : daysLeft <= 14 ? 'warning' : 'upcoming',
    };

    if (daysLeft <= 7) {
      critical.push(client);
    } else if (daysLeft <= 14) {
      warning.push(client);
    } else if (daysLeft <= 30) {
      upcoming.push(client);
    }
  }

  const byDaysLeft = (a: RenewalClient, b: RenewalClient) => a.daysLeft - b.daysLeft;
  critical.sort(byDaysLeft);
  warning.sort(byDaysLeft);
  upcoming.sort(byDaysLeft);

  return {
    critical,
    warning,
    upcoming,
    total: critical.length + warning.length + upcoming.length,
  };
}
