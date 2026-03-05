import { describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';

import handler from '../api/form-notifications';

type MockReq = {
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type MockRes = {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockRes;
  json: (body: unknown) => void;
  end: () => void;
};

type ResendEmailResponse = {
  id?: string;
  to?: string[] | string;
  subject?: string;
  last_event?: string;
};

const loadedEnv = loadEnv('development', process.cwd(), '');
Object.entries(loadedEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});

const LIVE_ENABLED = process.env.RESEND_LIVE_TEST === '1';
const describeLive = LIVE_ENABLED ? describe : describe.skip;
const EXTENSION_ADMIN_TO = 'info@privatetrainingonline.se';

const SUCCESS_EVENTS = new Set(['delivered', 'opened', 'clicked']);
const FAILURE_EVENTS = new Set(['bounced', 'complained', 'delivery_delayed']);

function createRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
    },
    end() {
      this.ended = true;
    },
  };

  return res;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRecipients(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getEmailById(emailId: string, apiKey: string): Promise<ResendEmailResponse> {
  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Failed to fetch email ${emailId}: ${response.status} ${details}`);
  }

  return (await response.json()) as ResendEmailResponse;
}

async function waitForDelivery(emailId: string, apiKey: string, timeoutMs = 90000, intervalMs = 3000) {
  const startedAt = Date.now();
  let lastEvent = 'unknown';

  while (Date.now() - startedAt < timeoutMs) {
    const details = await getEmailById(emailId, apiKey);
    const event = typeof details.last_event === 'string' ? details.last_event : '';
    lastEvent = event || 'unknown';

    if (SUCCESS_EVENTS.has(event)) {
      return details;
    }

    if (FAILURE_EVENTS.has(event)) {
      throw new Error(`Email ${emailId} failed with last_event=${event}`);
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for delivery of ${emailId}. Last event: ${lastEvent}`);
}

describeLive('form notifications api (live resend)', () => {
  it('sends startform email and reaches delivered status', async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const recipients = parseRecipients(process.env.RESEND_LIVE_TEST_TO || process.env.RESEND_FORM_TO);
    const userEmail = recipients[0] || EXTENSION_ADMIN_TO;

    expect(apiKey, 'Missing RESEND_API_KEY').toBeTruthy();

    const previousTo = process.env.RESEND_FORM_TO;
    if (recipients.length > 0) {
      process.env.RESEND_FORM_TO = recipients.join(',');
    } else {
      delete process.env.RESEND_FORM_TO;
    }

    try {
      const token = Date.now();
      const req: MockReq = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          source: 'startform',
          submitted_at: new Date().toISOString(),
          first_name: `Live${token}`,
          last_name: 'Resend',
          email: userEmail,
          sessions_per_week: '3 pass per vecka',
          goal_description: `Live test ${token}`,
        },
      };
      const res = createRes();

      await handler(req, res);

      if (res.statusCode !== 200) {
        const rawBody = JSON.stringify(res.jsonBody || {});
        const guidance = rawBody.includes('You can only send testing emails to your own email address')
          ? 'Resend-kontot är i testläge. Sätt RESEND_LIVE_TEST_TO till din verifierade kontoadress eller verifiera en domän och sätt RESEND_FORM_FROM.'
          : '';
        throw new Error(`Live send failed: ${rawBody}${guidance ? ` | ${guidance}` : ''}`);
      }

      const jsonBody = (res.jsonBody || {}) as { id?: string };
      expect(jsonBody.id).toBeTruthy();

      const details = await waitForDelivery(String(jsonBody.id), String(apiKey));
      expect(details.subject || '').toContain('Startformulär');

      const toValues = Array.isArray(details.to) ? details.to : typeof details.to === 'string' ? [details.to] : [];
      expect(toValues.some((value) => value.toLowerCase() === EXTENSION_ADMIN_TO)).toBe(true);
      expect(SUCCESS_EVENTS.has(String(details.last_event))).toBe(true);
    } finally {
      if (previousTo === undefined) {
        delete process.env.RESEND_FORM_TO;
      } else {
        process.env.RESEND_FORM_TO = previousTo;
      }
    }
  }, 120000);

  it('sends extension email to admin inbox and reaches delivered status', async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const replyToCandidates = parseRecipients(process.env.RESEND_LIVE_TEST_TO || process.env.RESEND_FORM_TO);
    const replyTo = replyToCandidates[0] || 'no-reply@privatetrainingonline.se';

    expect(apiKey, 'Missing RESEND_API_KEY').toBeTruthy();

    const token = Date.now();
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'forlangning',
        submitted_at: new Date().toISOString(),
        first_name: `Live${token}`,
        last_name: 'Extension',
        email: replyTo,
        current_expires_at: 'Ej registrerat',
        new_expires_at: '2026-12-31',
        billing_starts_at: '2026-03-05',
        months_extended: '10 månader',
        payment_method: 'Faktura utan extra avgifter',
      },
    };
    const res = createRes();

    await handler(req, res);

    if (res.statusCode !== 200) {
      const rawBody = JSON.stringify(res.jsonBody || {});
      const guidance = rawBody.includes('You can only send testing emails to your own email address')
        ? 'Resend-kontot är i testläge. Verifiera domänen och säkerställ att info@privatetrainingonline.se får ta emot utskick.'
        : '';
      throw new Error(`Live send failed: ${rawBody}${guidance ? ` | ${guidance}` : ''}`);
    }

    const jsonBody = (res.jsonBody || {}) as { id?: string };
    expect(jsonBody.id).toBeTruthy();

    const details = await waitForDelivery(String(jsonBody.id), String(apiKey));
    expect(details.subject || '').toContain('Förlängning');

    const toValues = Array.isArray(details.to) ? details.to : typeof details.to === 'string' ? [details.to] : [];
    expect(toValues.some((value) => value.toLowerCase() === EXTENSION_ADMIN_TO)).toBe(true);
    expect(SUCCESS_EVENTS.has(String(details.last_event))).toBe(true);
  }, 120000);
});
