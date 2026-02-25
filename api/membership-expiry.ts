import { createClient } from '@supabase/supabase-js';
import { JWT } from 'google-auth-library';

type SheetLookupResult = {
  found: boolean;
  expiresAt?: string;
  rawRow?: Record<string, unknown> | null;
};

const SHEET_ID_DEFAULT = '1DHKLVUhJmaTBFooHnn_OAAlPe_kR0Fs84FibCr9zoAM';

function getEnv(name: string, fallback?: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();
  return fallback;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function pickField(row: Record<string, unknown>, preferredKey: string): string | null {
  const direct = row[preferredKey];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const target = normalizeKey(preferredKey);
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) !== target) continue;
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function normalizeExpiry(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return trimmed;
}

async function lookupExpiry(email: string): Promise<SheetLookupResult> {
  const sheetId = getEnv('GOOGLE_SHEET_ID') || getEnv('CLIENT_SHEET_ID', SHEET_ID_DEFAULT);
  const worksheetName = getEnv('CLIENT_SHEET_WORKSHEET', 'Aktiva');
  const emailColumn = getEnv('CLIENT_SHEET_EMAIL_COLUMN', 'Epost');
  const expiryColumn = getEnv('CLIENT_SHEET_EXPIRY_COLUMN', 'Utgångsdatum');

  const serviceEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKeyRaw = getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (!serviceEmail || !privateKeyRaw) {
    throw new Error('Missing Google service account credentials');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  const auth = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const tokenResponse = await auth.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Failed to obtain Google access token');
  }

  const range = encodeURIComponent(worksheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?majorDimension=ROWS`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Google Sheets API request failed');
  }

  const data = await response.json();
  const values: string[][] = Array.isArray(data?.values) ? data.values : [];
  if (values.length === 0) return { found: false };

  const [headerRow, ...rows] = values;
  if (!headerRow) return { found: false };

  const headerMap = headerRow.reduce<Record<string, number>>((acc, value, index) => {
    if (typeof value === 'string') {
      acc[normalizeKey(value)] = index;
    }
    return acc;
  }, {});

  const emailIndex = headerMap[normalizeKey(emailColumn)];
  const expiryIndex = headerMap[normalizeKey(expiryColumn)];
  if (emailIndex === undefined || expiryIndex === undefined) {
    return { found: false };
  }

  const target = email.toLowerCase();
  for (const row of rows) {
    const rowEmail = (row[emailIndex] || '').toString().trim().toLowerCase();
    if (!rowEmail || rowEmail !== target) continue;
    const rawExpiry = row[expiryIndex] ? row[expiryIndex].toString() : '';
    const normalized = normalizeExpiry(rawExpiry);
    if (!normalized) return { found: false };
    return { found: true, expiresAt: normalized };
  }

  return { found: false };
}

function getBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.ACTION_ALLOWED_ORIGINS || process.env.CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

function setCors(res: any, origin: string | undefined) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

async function readJsonBody(req: any): Promise<Record<string, unknown>> {
  if (req?.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  if (req && req.readable) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await readJsonBody(req);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';

  if (!email) {
    setCors(res, origin);
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  const accessToken = getBearerToken(req.headers?.authorization as string | undefined);

  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    setCors(res, origin);
    res.status(401).json({ error: 'Missing authentication' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    setCors(res, origin);
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  if (userId && authData.user.id !== userId) {
    setCors(res, origin);
    res.status(403).json({ error: 'User mismatch' });
    return;
  }

  if (authData.user.email && authData.user.email.toLowerCase() !== email.toLowerCase()) {
    setCors(res, origin);
    res.status(403).json({ error: 'Email mismatch' });
    return;
  }

  try {
    const lookup = await lookupExpiry(email);
    if (!lookup.found || !lookup.expiresAt) {
      setCors(res, origin);
      res.status(200).json({ ok: true, found: false });
      return;
    }

    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      setCors(res, origin);
      res.status(200).json({
        ok: true,
        found: true,
        coaching_expires_at: lookup.expiresAt,
        updated: false,
      });
      return;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { error: updateError } = await admin
      .from('profiles')
      .update({ coaching_expires_at: lookup.expiresAt })
      .eq('id', authData.user.id);

    if (updateError) {
      setCors(res, origin);
      res.status(502).json({ error: 'Supabase update failed' });
      return;
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      found: true,
      coaching_expires_at: lookup.expiresAt,
      updated: true,
    });
  } catch (error: any) {
    console.error('Membership expiry sync failed', error);
    setCors(res, origin);
    res.status(502).json({ error: error?.message || 'Sync failed' });
  }
}
