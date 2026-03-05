const DEFAULT_MONTHLY_PRICE = 249;
const DAY_MS = 24 * 60 * 60 * 1000;

export type OfferCalculationMode = 'daily_prorated' | 'full_months';

type ComputeYearEndOfferInput = {
  now?: Date | string;
  coachingExpiresAt?: string | null;
  monthlyPrice?: number;
};

export type YearEndOffer = {
  campaignYear: number;
  campaignEndsAt: string;
  currentExpiresAt: string | null;
  billingStartsAt: string;
  billableDays: number;
  calculationMode: OfferCalculationMode;
  monthCount: number;
  monthlyPrice: number;
  totalPrice: number;
  newExpiresAt: string;
};

function parseDateInput(value: Date | string | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function firstDayOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function toDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  if (start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function daysInYear(year: number): number {
  const start = new Date(Date.UTC(year, 0, 1));
  const next = new Date(Date.UTC(year + 1, 0, 1));
  return Math.floor((next.getTime() - start.getTime()) / DAY_MS);
}

function monthDiffInclusive(start: Date, end: Date): number {
  const diff = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return diff > 0 ? diff : 0;
}

export function computeYearEndOffer(input: ComputeYearEndOfferInput = {}): YearEndOffer {
  const nowDate = parseDateInput(input.now || new Date()) || new Date();
  const normalizedNow = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));
  const expiresAt = parseDateInput(input.coachingExpiresAt || null);

  const campaignYear = normalizedNow.getUTCFullYear();
  const campaignEndsAtDate = new Date(Date.UTC(campaignYear, 11, 31));

  const monthlyPrice = Number.isFinite(input.monthlyPrice) && (input.monthlyPrice as number) > 0
    ? Math.round(input.monthlyPrice as number)
    : DEFAULT_MONTHLY_PRICE;

  const hasFutureExpiry = Boolean(expiresAt && expiresAt >= normalizedNow);
  const billingStartDate = hasFutureExpiry
    ? firstDayOfNextMonth(expiresAt)
    : normalizedNow;

  const billableDays = daysBetweenInclusive(billingStartDate, campaignEndsAtDate);
  const calculationMode: OfferCalculationMode = hasFutureExpiry ? 'full_months' : 'daily_prorated';

  let monthCount = 0;
  let totalPrice = 0;

  if (calculationMode === 'full_months') {
    monthCount = monthDiffInclusive(billingStartDate, campaignEndsAtDate);
    totalPrice = monthCount * monthlyPrice;
  } else {
    const monthlyDays = daysInYear(campaignYear) / 12;
    const monthEquivalent = billableDays / monthlyDays;
    monthCount = Number(monthEquivalent.toFixed(2));
    totalPrice = Math.round(monthEquivalent * monthlyPrice);
  }

  return {
    campaignYear,
    campaignEndsAt: toDateOnly(campaignEndsAtDate),
    currentExpiresAt: expiresAt ? toDateOnly(expiresAt) : null,
    billingStartsAt: toDateOnly(billingStartDate),
    billableDays,
    calculationMode,
    monthCount,
    monthlyPrice,
    totalPrice,
    newExpiresAt: toDateOnly(campaignEndsAtDate),
  };
}
