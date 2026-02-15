import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { parse } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = process.env.CHATKIT_PORT || 5174;
const COOKIE_NAME = 'chatkit_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar
const FETCH_TIMEOUT_MS = 10_000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitStore = new Map();

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '')
    .split(',')[0]
    .trim();
  return ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (!k || !v) return acc;
    acc[k.trim()] = decodeURIComponent(v.trim());
    return acc;
  }, {});
}

function sendJson(res, statusCode, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    ...headers,
  });
  res.end(json);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allowed = (process.env.CHATKIT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

async function createSession(user) {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.CHATKIT_WORKFLOW_ID;
  const workflowVersion = process.env.CHATKIT_WORKFLOW_VERSION;

  if (!apiKey) {
    return { status: 500, body: { error: 'Missing OPENAI_API_KEY' } };
  }
  if (!workflowId) {
    return { status: 500, body: { error: 'Missing CHATKIT_WORKFLOW_ID' } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'chatkit_beta=v1',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        user,
        workflow: {
          id: workflowId,
          ...(workflowVersion ? { version: workflowVersion } : {}),
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return { status: isAbort ? 504 : 502, body: { error: isAbort ? 'Upstream timeout' : 'Upstream request failed' } };
  } finally {
    clearTimeout(timeout);
  }

  let payload = {};
  try {
    payload = await upstream.json();
  } catch {
    payload = {};
  }

  if (!upstream.ok) {
    return { status: upstream.status, body: { error: payload?.error ?? payload ?? 'Failed to create session' } };
  }

  const client_secret = payload?.client_secret;
  if (!client_secret) {
    return { status: 502, body: { error: 'No client_secret returned' } };
  }

  return {
    status: 200,
    body: {
      client_secret,
      expires_at: payload?.expires_at ?? null,
    },
  };
}

loadEnv();

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url, true);
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return sendJson(res, 403, { error: 'Forbidden origin' }, { 'Access-Control-Allow-Origin': origin });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    });
    return res.end();
  }

  if (req.method !== 'POST' || pathname !== '/api/chatkit/session') {
    res.writeHead(404);
    return res.end();
  }

  const clientKey = getClientKey(req);
  if (isRateLimited(clientKey)) {
    return sendJson(res, 429, { error: 'Rate limit exceeded' }, { 'Access-Control-Allow-Origin': origin || '*' });
  }

  const cookies = parseCookies(req);
  let user = cookies[COOKIE_NAME];
  const isNewUser = !user;
  if (!user) user = randomUUID();

  const result = await createSession(user);

  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (isNewUser) {
    headers['Set-Cookie'] = `${COOKIE_NAME}=${encodeURIComponent(user)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  }

  return sendJson(res, result.status, result.body, headers);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ChatKit session server listening on http://localhost:${PORT}`);
});
