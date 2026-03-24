import { beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/_payments/create-checkout-session';

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

describe('payments/create-checkout-session api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PAYMENTS_V2_ENABLED;
    delete process.env.PAYMENTS_V2_REFILL_ENABLED;
    delete process.env.PAYMENTS_V2_FALLBACK_LINKS_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.CHAT_ALLOWED_ORIGINS;
    delete process.env.APP_BASE_URL;
  });

  it('returns fallback url when v2 is disabled', async () => {
    process.env.PAYMENTS_V2_ENABLED = 'false';
    process.env.PAYMENTS_V2_FALLBACK_LINKS_ENABLED = 'true';

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { flow: 'premium', mode: 'subscription' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({
      ok: true,
      fallback: true,
    });
  });

  it('rejects invalid flow', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { flow: 'invalid', mode: 'payment' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid flow' });
  });

  it('requires auth for forlangning when v2 is enabled', async () => {
    process.env.PAYMENTS_V2_ENABLED = 'true';
    process.env.PAYMENTS_V2_REFILL_ENABLED = 'true';
    process.env.PAYMENTS_V2_FALLBACK_LINKS_ENABLED = 'false';
    process.env.CHAT_ALLOWED_ORIGINS = 'https://app.test';
    process.env.APP_BASE_URL = 'https://app.test';

    const req: MockReq = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://app.test',
        host: 'app.test',
        'x-forwarded-host': 'app.test',
        'x-forwarded-proto': 'https',
      },
      body: {
        flow: 'forlangning',
        mode: 'payment',
        forlangningOffer: {
          monthlyPrice: 249,
          monthCount: 6,
          totalPrice: 1494,
          campaignYear: 2026,
          billableDays: 180,
          calculationMode: 'test',
          currentExpiresAt: '2026-06-30',
          billingStartsAt: '2026-07-01',
          newExpiresAt: '2026-12-31',
        },
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Inloggning krävs för förlängning.' });
  });

});
