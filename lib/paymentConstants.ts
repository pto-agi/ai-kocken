export type CheckoutFlow = 'premium' | 'forlangning' | 'refill';
export type CheckoutMode = 'payment' | 'subscription';

export const LEGACY_PAYMENT_LINKS = {
  premium: 'https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv',
  forlangning6: 'https://betalning.privatetrainingonline.se/b/6oU4gy4bN41hcyW4sDcfK0x?locale=sv',
  forlangning12: 'https://betalning.privatetrainingonline.se/b/14A6oG7nZ0P56aycZ9cfK0y?locale=sv',
} as const;

export function pickForlangningFallback(monthCount?: number | null): string {
  if (typeof monthCount !== 'number' || !Number.isFinite(monthCount)) {
    return LEGACY_PAYMENT_LINKS.forlangning12;
  }
  return monthCount <= 8 ? LEGACY_PAYMENT_LINKS.forlangning6 : LEGACY_PAYMENT_LINKS.forlangning12;
}
