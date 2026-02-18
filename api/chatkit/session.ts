import { randomUUID } from 'node:crypto';

const COOKIE_NAME = 'chatkit_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar
const FETCH_TIMEOUT_MS = 10_000;

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (!k || !v) return acc;
    acc[k.trim()] = decodeURIComponent(v.trim());
    return acc;
  }, {} as Record<string, string>);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.CHATKIT_ALLOWED_ORIGINS || '')
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.CHATKIT_WORKFLOW_ID;
  const workflowVersion = process.env.CHATKIT_WORKFLOW_VERSION;

  if (!apiKey) {
    setCors(res, origin);
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    return;
  }

  if (!workflowId) {
    setCors(res, origin);
    res.status(500).json({ error: 'Missing CHATKIT_WORKFLOW_ID' });
    return;
  }

  const cookies = parseCookies(req.headers?.cookie);
  let user = cookies[COOKIE_NAME];
  const isNewUser = !user;
  if (!user) user = randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream: Response;
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
  } catch (error: any) {
    clearTimeout(timeout);
    setCors(res, origin);
    const isAbort = error instanceof Error && error.name === 'AbortError';
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? 'Upstream timeout' : 'Upstream request failed' });
    return;
  } finally {
    clearTimeout(timeout);
  }

  let payload: any = {};
  try {
    payload = await upstream.json();
  } catch {
    payload = {};
  }

  setCors(res, origin);

  if (!upstream.ok) {
    const requestId = upstream.headers.get('x-request-id') || undefined;
    const errorMessage =
      payload?.error?.message ||
      payload?.error?.code ||
      payload?.error ||
      'Failed to create session';
    console.error('ChatKit session create failed', {
      status: upstream.status,
      requestId,
      error: errorMessage,
    });
    res.status(upstream.status).json({
      error: errorMessage,
      request_id: requestId,
    });
    return;
  }

  if (!payload?.client_secret) {
    res.status(502).json({ error: 'No client_secret returned' });
    return;
  }

  if (isNewUser) {
    const proto = (req.headers?.['x-forwarded-proto'] as string | undefined) || '';
    const isSecure = proto === 'https' || origin?.startsWith('https://');
    const cookie = [
      `${COOKIE_NAME}=${encodeURIComponent(user)}`,
      `Max-Age=${COOKIE_MAX_AGE}`,
      'Path=/',
      'SameSite=Lax',
      'HttpOnly',
      isSecure ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
    res.setHeader('Set-Cookie', cookie);
  }

  res.status(200).json({
    client_secret: payload.client_secret,
    expires_at: payload.expires_at ?? null,
  });
}
