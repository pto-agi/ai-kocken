import { beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/member-actions';

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

describe('member actions api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.ZAPIER_PAUSE_WEBHOOK_URL;
    delete process.env.ZAPIER_REACTIVATE_WEBHOOK_URL;
    delete process.env.ZAPIER_DEACTIVATE_WEBHOOK_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FORM_FROM;
    delete process.env.RESEND_MEMBER_ACTION_TO;
  });

  it('returns 405 for non-POST', async () => {
    const req: MockReq = { method: 'GET', headers: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: 'Method not allowed' });
  });

  it('sends webhook and both admin + customer emails for pause', async () => {
    process.env.ZAPIER_PAUSE_WEBHOOK_URL = 'https://hooks.example.com/pause';
    process.env.RESEND_API_KEY = 'resend_test_key';
    process.env.RESEND_MEMBER_ACTION_TO = 'ops@example.com';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_pause_admin_123' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_pause_customer_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action_type: 'pause_membership',
        request_id: 'req_pause_1',
        requested_at: '2026-03-05T16:00:00.000Z',
        user_id: 'user_1',
        email: 'member@example.com',
        name: 'Member Test',
        membership_level: 'Premium',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [webhookUrl, webhookInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(webhookUrl).toBe('https://hooks.example.com/pause');
    expect(webhookInit.method).toBe('POST');
    expect(webhookInit.body).toContain('action_type=pause_membership');
    expect(webhookInit.body).toContain('request_id=req_pause_1');

    const [adminResendUrl, adminResendInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(adminResendUrl).toBe('https://api.resend.com/emails');
    const adminPayload = JSON.parse(String(adminResendInit.body));
    expect(adminPayload.to).toEqual(['info@privatetrainingonline.se', 'ops@example.com']);
    expect(adminPayload.subject).toContain('Paus');
    expect(adminPayload.reply_to).toBe('member@example.com');
    expect(adminPayload.text).toContain('Åtgärd: Paus av medlemskap');

    const [customerResendUrl, customerResendInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(customerResendUrl).toBe('https://api.resend.com/emails');
    const customerPayload = JSON.parse(String(customerResendInit.body));
    expect(customerPayload.to).toEqual(['member@example.com']);
    expect(customerPayload.subject).toBe('Vi har mottagit din pausbegäran');
    expect(customerPayload.reply_to).toBe('info@privatetrainingonline.se');
    expect(customerPayload.text).toContain('Vi har mottagit din begäran om att pausa medlemskapet.');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      action_type: 'pause_membership',
      request_id: 'req_pause_1',
      email_status: 'sent',
      email_id: 'email_pause_admin_123',
      confirmation_id: 'email_pause_customer_123',
    });
  });

  it('sends webhook and reactivation confirmation email with warm copy', async () => {
    process.env.ZAPIER_REACTIVATE_WEBHOOK_URL = 'https://hooks.example.com/reactivate';
    process.env.RESEND_API_KEY = 'resend_test_key';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_reactivate_admin_123' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_reactivate_customer_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action_type: 'reactivate_membership',
        request_id: 'req_reactivate_1',
        requested_at: '2026-03-05T16:00:00.000Z',
        user_id: 'user_2',
        email: 'member2@example.com',
        name: 'Member Two',
      },
    };
    const res = createRes();

    await handler(req, res);

    const [, confirmationInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    const confirmationPayload = JSON.parse(String(confirmationInit.body));
    expect(confirmationPayload.subject).toBe('Vi har mottagit din återaktivering');
    expect(confirmationPayload.text).toContain('Vi har mottagit din begäran om att återaktivera medlemskapet.');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      action_type: 'reactivate_membership',
      request_id: 'req_reactivate_1',
      email_status: 'sent',
      email_id: 'email_reactivate_admin_123',
      confirmation_id: 'email_reactivate_customer_123',
    });
  });

  it('does not fail member action when resend config is missing', async () => {
    process.env.ZAPIER_PAUSE_WEBHOOK_URL = 'https://hooks.example.com/pause';

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action_type: 'pause_membership',
        request_id: 'req_pause_no_resend',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      action_type: 'pause_membership',
      request_id: 'req_pause_no_resend',
      email_status: 'skipped',
      email_id: null,
      confirmation_id: null,
    });
  });
});
