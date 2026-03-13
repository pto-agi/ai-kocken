import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_RATE_LIMIT_MAX = 20;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

function parseIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitConfig() {
  return {
    max: parseIntEnv(process.env.GEMINI_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    windowMs: parseIntEnv(process.env.GEMINI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
  };
}

function pruneRateLimit(now: number, windowMs: number) {
  rateLimitMap.forEach((entry, key) => {
    if (now - entry.windowStart > windowMs * 2) {
      rateLimitMap.delete(key);
    }
  });
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const { max, windowMs } = getRateLimitConfig();
  pruneRateLimit(now, windowMs);

  const current = rateLimitMap.get(key);
  if (!current || now - current.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (current.count >= max) {
    return true;
  }

  current.count += 1;
  rateLimitMap.set(key, current);
  return false;
}

function getBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

async function verifyUserFromToken(accessToken: string): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data } = await userClient.auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

function sanitizeConfig(rawConfig: unknown): Record<string, unknown> | undefined {
  if (!rawConfig || typeof rawConfig !== 'object') return undefined;
  const config = rawConfig as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  const copyNumber = (key: string, min: number, max: number) => {
    const value = config[key];
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    output[key] = Math.min(max, Math.max(min, value));
  };

  const copyString = (key: string) => {
    const value = config[key];
    if (typeof value !== 'string' || !value.trim()) return;
    output[key] = value;
  };

  copyString('responseMimeType');
  if (config.responseSchema && typeof config.responseSchema === 'object') {
    output.responseSchema = config.responseSchema;
  }
  copyNumber('temperature', 0, 2);
  copyNumber('topP', 0, 1);
  copyNumber('topK', 1, 100);
  copyNumber('maxOutputTokens', 32, 8192);
  copyNumber('candidateCount', 1, 4);

  if (Array.isArray(config.stopSequences)) {
    output.stopSequences = config.stopSequences
      .filter((item) => typeof item === 'string')
      .slice(0, 8);
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    return;
  }

  try {
    const { contents, config, access_token: bodyToken } = req.body || {};
    if (!contents || (typeof contents !== 'string' && !Array.isArray(contents))) {
      res.status(400).json({ error: 'Missing contents' });
      return;
    }

    const accessToken = getBearerToken(req.headers?.authorization as string | undefined)
      || (typeof bodyToken === 'string' ? bodyToken : undefined);
    if (!accessToken) {
      res.status(401).json({ error: 'Missing access token' });
      return;
    }

    const userId = await verifyUserFromToken(accessToken);
    if (!userId) {
      res.status(401).json({ error: 'Invalid access token' });
      return;
    }

    const forwardedFor = req.headers?.['x-forwarded-for'];
    const ip = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : '';
    const rateKey = ip ? `${userId}:${ip}` : userId;
    if (isRateLimited(rateKey)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
      contents,
      config: sanitizeConfig(config),
    });

    res.status(200).json({ text: response.text || "" });
  } catch (err: any) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
}
