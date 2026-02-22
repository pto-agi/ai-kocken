import { randomUUID } from 'node:crypto';

const COOKIE_NAME = 'chatkit_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagar
const FETCH_TIMEOUT_MS = 10_000;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcp-0brh.onrender.com/mcp';
const MCP_SERVER_LABEL = process.env.MCP_SERVER_LABEL || 'supabase_mcp';
const MCP_ALLOWED_TOOLS = [
  'get_profile',
  'get_start_intake_latest',
  'get_followup_latest',
  'get_weekly_plans',
  'save_weekly_plan',
];

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

function normalizeStateVariables(input: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const result: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key || key.length > 64) continue;

    if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      result[key] = rawValue as string | number | boolean | null;
      continue;
    }

    try {
      result[key] = JSON.stringify(rawValue);
    } catch {
      // Skip values that cannot be stringified.
    }
  }

  return Object.keys(result).length ? result : undefined;
}

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

function getBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
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

  const body = await readJsonBody(req);
  const requestedUserId = typeof body?.user_id === 'string' && body.user_id.trim()
    ? body.user_id.trim()
    : undefined;
  const stateVariables = normalizeStateVariables(body?.state_variables);

  const cookies = parseCookies(req.headers?.cookie);
  const cookieUser = cookies[COOKIE_NAME];
  let user = requestedUserId || cookieUser;
  if (!user) user = randomUUID();
  const shouldSetCookie = !requestedUserId && !cookieUser;

  const accessToken =
    getBearerToken(req.headers?.authorization as string | undefined) ||
    (typeof body?.access_token === 'string' ? body.access_token : undefined);

  const requestMeta = {
    user_id: user,
    origin,
    workflow_id: workflowId,
    workflow_version: workflowVersion ?? null,
  };

  if (!accessToken) {
    console.warn('ChatKit session: missing access token for MCP', {
      hasAuthorizationHeader: Boolean(req.headers?.authorization),
      ...requestMeta,
    });
  }

  const tools = MCP_SERVER_URL
    ? [
        {
          type: 'mcp',
          server_label: MCP_SERVER_LABEL,
          server_url: MCP_SERVER_URL,
          allowed_tools: MCP_ALLOWED_TOOLS,
          require_approval: 'never',
          ...(accessToken
            ? { headers: { Authorization: `Bearer ${accessToken}` } }
            : {}),
        },
      ]
    : undefined;

  if (tools) {
    console.info('ChatKit session: MCP tools enabled', {
      server_url: MCP_SERVER_URL,
      server_label: MCP_SERVER_LABEL,
      allowed_tools: MCP_ALLOWED_TOOLS,
      hasAccessToken: Boolean(accessToken),
      ...requestMeta,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

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
          ...(stateVariables ? { state_variables: stateVariables } : {}),
        },
        ...(tools ? { tools } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeout);
    setCors(res, origin);
    const isAbort = error instanceof Error && error.name === 'AbortError';
    console.error('ChatKit session: upstream request failed', {
      error: error?.message || String(error),
      isAbort,
      duration_ms: Date.now() - startedAt,
      hasAccessToken: Boolean(accessToken),
      server_url: MCP_SERVER_URL,
      server_label: MCP_SERVER_LABEL,
      allowed_tools: MCP_ALLOWED_TOOLS,
      ...requestMeta,
    });
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
      hasAccessToken: Boolean(accessToken),
      server_url: MCP_SERVER_URL,
      server_label: MCP_SERVER_LABEL,
      allowed_tools: MCP_ALLOWED_TOOLS,
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    res.status(upstream.status).json({
      error: errorMessage,
      request_id: requestId,
    });
    return;
  }

  if (!payload?.client_secret) {
    const requestId = upstream.headers.get('x-request-id') || undefined;
    console.error('ChatKit session: missing client_secret', {
      status: upstream.status,
      requestId,
      hasAccessToken: Boolean(accessToken),
      server_url: MCP_SERVER_URL,
      server_label: MCP_SERVER_LABEL,
      allowed_tools: MCP_ALLOWED_TOOLS,
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    res.status(502).json({ error: 'No client_secret returned' });
    return;
  }

  if (shouldSetCookie) {
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

  const requestId = upstream.headers.get('x-request-id') || undefined;
  console.info('ChatKit session: created', {
    requestId,
    duration_ms: Date.now() - startedAt,
    hasAccessToken: Boolean(accessToken),
    server_url: MCP_SERVER_URL,
    server_label: MCP_SERVER_LABEL,
    allowed_tools: MCP_ALLOWED_TOOLS,
    ...requestMeta,
  });

  res.status(200).json({
    client_secret: payload.client_secret,
    expires_at: payload.expires_at ?? null,
  });
}
