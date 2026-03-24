import { getEnv } from '../lib/env';

function toBool(value: string, fallback = false): boolean {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Returns false ONLY if explicitly set to 'false'/'0'/'no'/'off'.
 * Otherwise defaults to true (feature is live).
 */
function toBoolDefaultTrue(value: string): boolean {
  if (!value) return true;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

export function isPaymentsV2Enabled(): boolean {
  return toBoolDefaultTrue(getEnv('PAYMENTS_V2_ENABLED'));
}

export function isPaymentsV2RefillEnabled(): boolean {
  return toBoolDefaultTrue(getEnv('PAYMENTS_V2_REFILL_ENABLED'));
}

export function isPaymentsFallbackEnabled(): boolean {
  return toBool(getEnv('PAYMENTS_V2_FALLBACK_LINKS_ENABLED'), true);
}

export function getStripePublishableKeyClient(): string {
  return getEnv('STRIPE_PUBLISHABLE_KEY');
}
