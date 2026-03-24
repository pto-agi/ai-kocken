import { beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/webhook-proxy';

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

describe('webhook proxy api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.WEBHOOK_PROXY_ALLOWED_ORIGINS;
    delete process.env.ZAPIER_FORLANGNING_WEBHOOK_URL;
    delete process.env.ZAPIER_FORLANGNING_MONTHS_WEBHOOK_URL;
    delete process.env.ZAPIER_REFILL_WEBHOOK_URL;
    delete process.env.ZAPIER_REPORT_WEBHOOK_URL;
    delete process.env.ZAPIER_REPORT_OVERTIME_WEBHOOK_URL;
  });

  it('treats forlangning_months as non-blocking when webhook URL is missing', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        target: 'forlangning_months',
        email: 'member@example.com',
        months_extended: '6 månader',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      target: 'forlangning_months',
      skipped: true,
      reason: 'Webhook not configured',
    });
  });

  it('keeps primary forlangning webhook strict when webhook URL is missing', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        target: 'forlangning',
        email: 'member@example.com',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(501);
    expect(res.jsonBody).toEqual({ error: 'Webhook not configured', target: 'forlangning' });
  });

  it('treats forlangning_months as non-blocking when upstream webhook returns non-2xx', async () => {
    process.env.ZAPIER_FORLANGNING_MONTHS_WEBHOOK_URL = 'https://example.com/months';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        target: 'forlangning_months',
        email: 'member@example.com',
        months_extended: '6 månader',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      target: 'forlangning_months',
      skipped: true,
      reason: 'Webhook failed',
      status: 500,
    });
  });
});
