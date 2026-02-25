type MemberAction = 'pause_membership' | 'deactivate_membership' | 'reactivate_membership';

const ACTION_WEBHOOKS: Record<MemberAction, string> = {
  pause_membership:
    process.env.ZAPIER_PAUSE_WEBHOOK_URL ||
    'https://hooks.zapier.com/hooks/catch/1514319/ucxgs7s/',
  deactivate_membership: process.env.ZAPIER_DEACTIVATE_WEBHOOK_URL || '',
  reactivate_membership: process.env.ZAPIER_REACTIVATE_WEBHOOK_URL || '',
};

async function readBody(req: any): Promise<Record<string, unknown>> {
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
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  const contentType = String(req?.headers?.['content-type'] || '');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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

function ensureRequestId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFormBody(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });
  return params.toString();
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

  const body = await readBody(req);
  const actionType = body.action_type;

  if (typeof actionType !== 'string') {
    setCors(res, origin);
    res.status(400).json({ error: 'Missing action_type' });
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(ACTION_WEBHOOKS, actionType)) {
    setCors(res, origin);
    res.status(400).json({ error: 'Unsupported action_type' });
    return;
  }

  const webhookUrl = ACTION_WEBHOOKS[actionType as MemberAction];
  if (!webhookUrl) {
    setCors(res, origin);
    res.status(501).json({ error: 'Action not enabled yet', action_type: actionType });
    return;
  }

  const payload: Record<string, unknown> = {
    ...body,
    action_type: actionType,
    request_id: ensureRequestId(body.request_id),
    requested_at: body.requested_at || new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody(payload),
    });

    if (!response.ok) {
      setCors(res, origin);
      res.status(502).json({ error: 'Webhook failed', status: response.status });
      return;
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      action_type: actionType,
      request_id: payload.request_id,
    });
  } catch (error: any) {
    console.error('Member action webhook error', error);
    setCors(res, origin);
    res.status(502).json({ error: 'Webhook failed' });
  }
}
