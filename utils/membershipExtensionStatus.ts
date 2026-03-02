const EXTENSION_PATTERNS = [
  'forlang',
  'förläng',
  'extend',
  'extension',
  'renew',
  'renewal',
] as const;

export const hasSubmittedExtension = (subscriptionStatus?: string | null): boolean => {
  if (!subscriptionStatus) return false;
  const normalized = subscriptionStatus.toLowerCase().trim();
  if (!normalized) return false;
  return EXTENSION_PATTERNS.some((pattern) => normalized.includes(pattern));
};
