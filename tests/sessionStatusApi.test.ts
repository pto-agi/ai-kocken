import { beforeEach, describe, expect, it, vi } from 'vitest';

const retrieveMock = vi.fn();

vi.mock('../api/_shared/paymentHelpers.js', () => ({
  getStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: retrieveMock,
      },
    },
  }),
}));

import handler from '../lib/paymentHandlers/session-status';

type MockReq = {
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
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

describe('payments/session-status api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only session fields without exposing internal transaction records', async () => {
    retrieveMock.mockResolvedValue({
      id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
      mode: 'payment',
      customer_details: { email: 'guest@example.com' },
      customer_email: null,
      metadata: { flow: 'refill' },
    });

    const req: MockReq = {
      method: 'GET',
      headers: {},
      query: { session_id: 'cs_test_123' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      session_id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
      mode: 'payment',
      customer_email: 'guest@example.com',
      flow: 'refill',
    });
  });
});
