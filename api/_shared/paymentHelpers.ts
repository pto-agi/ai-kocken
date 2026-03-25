import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();
  return fallback || '';
}

export function isFlagEnabled(name: string, defaultValue = false): boolean {
  const raw = env(name);
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function getRequestBaseUrl(req: any): string {
  const explicit = env('APP_BASE_URL') || env('MAIL_APP_BASE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');

  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin) return origin.replace(/\/+$/, '');

  const host = (req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').toString().trim();
  if (host) {
    const proto = (req?.headers?.['x-forwarded-proto'] || 'https').toString().trim();
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return '';
}

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const secret = env('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  stripeClient = new Stripe(secret);
  return stripeClient;
}

export function getStripePublishableKey(): string {
  const key = env('STRIPE_PUBLISHABLE_KEY') || env('VITE_STRIPE_PUBLISHABLE_KEY');
  if (!key) throw new Error('Missing STRIPE_PUBLISHABLE_KEY');
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  return secret;
}

export function getSupabaseAdmin() {
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
}

export function getSupabaseAuthClient() {
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const supabaseAnon = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnon) return null;
  return createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } });
}

export async function resolveAuthUser(accessToken: string | undefined) {
  if (!accessToken) return null;
  const client = getSupabaseAuthClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

export async function readRawBody(req: any): Promise<Buffer> {
  if (Buffer.isBuffer(req?.body)) return req.body as Buffer;
  if (typeof req?.body === 'string') return Buffer.from(req.body, 'utf8');

  const chunks: Buffer[] = [];
  if (req && req.readable) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

export function safeJsonParse<T = Record<string, unknown>>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Swedish inclusive tax rates (auto-created in Stripe on first use)
// ---------------------------------------------------------------------------

const taxRateCache: Record<string, string> = {};

/**
 * Get or create an inclusive Stripe TaxRate.
 * Checks env var first (e.g. STRIPE_TAX_RATE_12), then Stripe API, then creates.
 */
async function getOrCreateTaxRate(
  stripe: Stripe,
  percentage: number,
  displayName: string,
  description: string,
): Promise<string> {
  const cacheKey = `inclusive_${percentage}`;
  if (taxRateCache[cacheKey]) return taxRateCache[cacheKey];

  // Check env var
  const envKey = `STRIPE_TAX_RATE_${percentage}`;
  const envId = env(envKey);
  if (envId) {
    taxRateCache[cacheKey] = envId;
    return envId;
  }

  // Search existing tax rates
  const existing = await stripe.taxRates.list({ limit: 100, active: true, inclusive: true });
  const match = existing.data.find(
    (tr) => tr.percentage === percentage && tr.inclusive === true,
  );
  if (match) {
    taxRateCache[cacheKey] = match.id;
    return match.id;
  }

  // Create new
  const created = await stripe.taxRates.create({
    display_name: displayName,
    description,
    percentage,
    inclusive: true,
    country: 'SE',
    jurisdiction: 'SE',
  });
  taxRateCache[cacheKey] = created.id;
  console.log(`[tax] Created inclusive ${percentage}% tax rate: ${created.id}`);
  return created.id;
}

/** 12% inclusive (Swedish reduced VAT — supplements/food) */
export async function getSupplementTaxRateId(stripe: Stripe): Promise<string> {
  return getOrCreateTaxRate(stripe, 12, 'Moms', 'Svensk moms 12% (livsmedel/kosttillskott)');
}

/** 25% inclusive (Swedish standard VAT — services) */
export async function getServiceTaxRateId(stripe: Stripe): Promise<string> {
  return getOrCreateTaxRate(stripe, 25, 'Moms', 'Svensk moms 25% (tjänster)');
}
