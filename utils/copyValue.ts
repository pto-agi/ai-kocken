export const resolveCopyText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`;
  }

  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized || normalized === '—') return null;
  return normalized;
};

