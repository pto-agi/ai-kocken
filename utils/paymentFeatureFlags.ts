import { getEnv } from '../lib/env';

function toBool(value: string, fallback = false): boolean {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function isPaymentsV2Enabled(): boolean {
  return toBool(getEnv('PAYMENTS_V2_ENABLED'), false);
}

export function isPaymentsV2RefillEnabled(): boolean {
  return toBool(getEnv('PAYMENTS_V2_REFILL_ENABLED'), false);
}

export function isPaymentsFallbackEnabled(): boolean {
  return toBool(getEnv('PAYMENTS_V2_FALLBACK_LINKS_ENABLED'), true);
}

export function getStripePublishableKeyClient(): string {
  return getEnv('STRIPE_PUBLISHABLE_KEY');
}
