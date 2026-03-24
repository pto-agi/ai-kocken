import {
  readBody,
  isAllowedOrigin,
  setCors,
} from './_shared/apiHelpers.js';

type WebhookTarget =
  | 'forlangning'
  | 'forlangning_months'
  | 'refill'
  | 'report'
  | 'report_overtime';

const WEBHOOK_ENV_MAP: Record<WebhookTarget, string> = {
  forlangning: 'ZAPIER_FORLANGNING_WEBHOOK_URL',
  forlangning_months: 'ZAPIER_FORLANGNING_MONTHS_WEBHOOK_URL',
  refill: 'ZAPIER_REFILL_WEBHOOK_URL',
  report: 'ZAPIER_REPORT_WEBHOOK_URL',
  report_overtime: 'ZAPIER_REPORT_OVERTIME_WEBHOOK_URL',
};

const VALID_TARGETS = new Set<string>(Object.keys(WEBHOOK_ENV_MAP));
const NON_BLOCKING_TARGETS = new Set<WebhookTarget>(['forlangning_months']);

function firstHeaderValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return typeof value === 'string' ? value : '';
}

function normalizeFirstHeaderToken(value: unknown): string {
  return firstHeaderValue(value).split(',')[0]?.trim().toLowerCase() || '';
}

function isSameOriginRequest(req: any, origin: string | undefined): boolean {
  if (!origin) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originHost = originUrl.host.toLowerCase();
  const originProtocol = originUrl.protocol.replace(':', '').toLowerCase();

  const forwardedHost = normalizeFirstHeaderToken(req?.headers?.['x-forwarded-host']);
  const host = normalizeFirstHeaderToken(req?.headers?.host);
  const requestHosts = [forwardedHost, host].filter(Boolean);
  if (!requestHosts.includes(originHost)) return false;

  const forwardedProto = normalizeFirstHeaderToken(req?.headers?.['x-forwarded-proto']);
  if (!forwardedProto) return true;

  return forwardedProto === originProtocol;
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  const originAllowed = isAllowedOrigin(origin, 'WEBHOOK_PROXY_ALLOWED_ORIGINS') || isSameOriginRequest(req, origin);
  if (!originAllowed) {
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

  const body = await readBody(req);
  const target = body.target as string;

  if (!target || !VALID_TARGETS.has(target)) {
    setCors(res, origin);
    res.status(400).json({ error: 'Invalid or missing target' });
    return;
  }

  const envKey = WEBHOOK_ENV_MAP[target as WebhookTarget];
  const webhookUrl = (process.env[envKey] || '').trim();

  const typedTarget = target as WebhookTarget;
  const isNonBlockingTarget = NON_BLOCKING_TARGETS.has(typedTarget);

  if (!webhookUrl) {
    if (isNonBlockingTarget) {
      console.warn('Webhook proxy skipped: missing URL', { target });
      setCors(res, origin);
      res.status(200).json({ ok: true, target, skipped: true, reason: 'Webhook not configured' });
      return;
    }

    setCors(res, origin);
    res.status(501).json({ error: 'Webhook not configured', target });
    return;
  }

  // Strip the target key before forwarding
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { target: _target, ...payload } = body;

  const urlEncodedBody = new URLSearchParams(
    Object.entries(payload).map(([k, v]) => [k, String(v ?? '')]),
  ).toString();

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: urlEncodedBody,
    });

    if (!response.ok) {
      if (isNonBlockingTarget) {
        console.warn('Webhook proxy skipped: non-2xx response', { target, status: response.status });
        setCors(res, origin);
        res.status(200).json({ ok: true, target, skipped: true, reason: 'Webhook failed', status: response.status });
        return;
      }

      setCors(res, origin);
      res.status(502).json({ error: 'Webhook failed', status: response.status });
      return;
    }

    setCors(res, origin);
    res.status(200).json({ ok: true, target });
  } catch (error) {
    if (isNonBlockingTarget) {
      console.warn('Webhook proxy skipped: request error', { target, error });
      setCors(res, origin);
      res.status(200).json({ ok: true, target, skipped: true, reason: 'Webhook request failed' });
      return;
    }

    console.error('Webhook proxy error:', error);
    setCors(res, origin);
    res.status(502).json({ error: 'Webhook request failed' });
  }
}
