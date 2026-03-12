import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('form notifications api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FORM_TO;
    delete process.env.RESEND_FORM_FROM;
  });

  it('returns 405 for non-POST', async () => {
    const req: MockReq = { method: 'GET', headers: {} };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: 'Method not allowed' });
  });

  it('returns 500 when RESEND_API_KEY is missing', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { source: 'startform', email: 'user@example.com' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: 'Missing RESEND_API_KEY' });
  });

  it('returns 400 for unsupported source', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { source: 'other', email: 'user@example.com' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Unsupported source' });
  });

  it('posts email to Resend for startform payload without customer confirmation', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FORM_TO = 'admin1@example.com, admin2@example.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'startform',
        submitted_at: '2026-03-04T10:00:00.000Z',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        sessions_per_week: '3 pass per vecka',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');

    const parsedBody = JSON.parse(String(init.body));
    expect(parsedBody.subject).toContain('Startformulär');
    expect(parsedBody.text).toContain('Ada Lovelace');
    expect(parsedBody.text).toContain('[Kontaktuppgifter]');
    expect(parsedBody.text).not.toContain('[Kroppsmått]');
    expect(parsedBody.html).toContain('Startformulär inkommet');
    expect(parsedBody.html).toContain('Inskickade uppgifter');
    expect(parsedBody.html).toContain('Pass per vecka');
    expect(parsedBody.html).toContain('Kontaktuppgifter');
    expect(parsedBody.html).not.toContain('Kroppsmått');
    expect(parsedBody.html).not.toContain('Mått midja');
    expect(parsedBody.html).not.toContain('>—<');
    expect(parsedBody.to).toEqual(['info@privatetrainingonline.se', 'admin1@example.com', 'admin2@example.com']);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, id: 'email_123', channel: 'resend', confirmation_id: null });
  });

  it('posts email to Resend for uppfoljning payload', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FORM_TO = 'info@my,privatetrainingonline.se';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_upp_123' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_upp_confirm_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'uppfoljning',
        submitted_at: '2026-03-04T11:00:00.000Z',
        first_name: 'Alex',
        last_name: 'Test',
        email: 'alex@example.com',
        quick_keep_plan: true,
        sessions_per_week: 3,
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, adminInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const adminBody = JSON.parse(String(adminInit.body));
    expect(adminBody.subject).toContain('Uppföljning');
    expect(adminBody.text).toContain('[Snabbval]');
    expect(adminBody.text).toContain('Behåll nuvarande upplägg: Ja');
    expect(adminBody.html).toContain('Uppföljning inkommet');
    expect(adminBody.html).toContain('Behåll nuvarande upplägg');
    expect(adminBody.html).not.toContain('Mål');
    expect(adminBody.text).not.toContain('Pass per vecka (annat):');
    expect(adminBody.html).not.toContain('Pass per vecka (annat)');
    expect(adminBody.reply_to).toBe('alex@example.com');
    expect(adminBody.to).toEqual(['info@privatetrainingonline.se']);

    const [, confirmationInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const confirmationBody = JSON.parse(String(confirmationInit.body));
    expect(confirmationBody.to).toEqual(['alex@example.com']);
    expect(confirmationBody.subject).toBe('Tack för din uppföljning!');
    expect(confirmationBody.text).toContain('Vi har mottagit din uppföljning');
    expect(confirmationBody.html).toContain('Hej Alex Test,');
    expect(confirmationBody.html).toContain('Vi har mottagit din uppföljning och går igenom den inför nästa planering.');
    expect(confirmationBody.html).not.toContain('Din uppföljning är mottagen.');
    expect(confirmationBody.html).not.toContain('Öppna Mina sidor');
    expect(confirmationBody.html).not.toContain('background:#F6F1E7;border:1px solid #E6E1D8;border-radius:14px;padding:16px;');
    expect(confirmationBody.reply_to).toBe('info@privatetrainingonline.se');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, id: 'email_upp_123', channel: 'resend', confirmation_id: 'email_upp_confirm_123' });
  });

  it('deduplicates startform admin recipients and keeps fixed admin inbox first', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FORM_TO = 'INFO@privatetrainingonline.se, admin@example.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_start_456' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_start_confirm_456' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'startform',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        sessions_per_week: '3 pass per vecka',
      },
    };
    const res = createRes();

    await handler(req, res);

    const [, adminInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const adminBody = JSON.parse(String(adminInit.body));
    expect(adminBody.to).toEqual(['info@privatetrainingonline.se', 'admin@example.com']);
    expect(res.statusCode).toBe(200);
  });

  it('posts extension confirmation email to fixed admin inbox', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FORM_TO = 'other-admin@example.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_ext_123' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_ext_confirm_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'forlangning',
        submitted_at: '2026-03-05T14:00:00.000Z',
        first_name: 'Marcus',
        last_name: 'Test',
        email: 'marcus@example.com',
        current_expires_at: 'Ej registrerat',
        new_expires_at: '2026-12-31',
        billing_starts_at: '2026-03-05',
        months_extended: '10 månader',
        payment_method: 'Faktura utan extra avgifter',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsedBody = JSON.parse(String(init.body));
    expect(parsedBody.subject).toContain('Förlängning');
    expect(parsedBody.to).toEqual(['info@privatetrainingonline.se']);
    expect(parsedBody.text).toContain('[Förlängningsdetaljer]');
    expect(parsedBody.text).toContain('Antal månader förlängt: 10 månader');
    expect(parsedBody.html).toContain('Förlängning inkommet');
    expect(parsedBody.html).toContain('Förlängningsdetaljer');
    expect(parsedBody.html).toContain('Antal månader förlängt');
    expect(parsedBody.reply_to).toBe('info@privatetrainingonline.se');

    const [, confirmationInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const confirmationBody = JSON.parse(String(confirmationInit.body));
    expect(confirmationBody.to).toEqual(['marcus@example.com']);
    expect(confirmationBody.subject).toBe('Tack för din förlängning!');
    expect(confirmationBody.reply_to).toBe('info@privatetrainingonline.se');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, id: 'email_ext_123', channel: 'resend', confirmation_id: 'email_ext_confirm_123' });
  });

  it('posts refill purchase notification to fixed admin inbox', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.RESEND_FORM_TO = 'other-admin@example.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_refill_123' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_refill_confirm_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'refill',
        submitted_at: '2026-03-06T08:00:00.000Z',
        first_name: 'Maja',
        last_name: 'Test',
        email: 'maja@example.com',
        item_count: '2',
        subtotal: '1294',
        currency: 'SEK',
        items: '[{"id":"bcaa","qty":2}]',
        address_line1: 'Testvägen 1',
        postal_code: '12345',
        city: 'Stockholm',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, adminInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const adminBody = JSON.parse(String(adminInit.body));
    expect(adminBody.subject).toContain('Refill');
    expect(adminBody.to).toEqual(['info@privatetrainingonline.se']);
    expect(adminBody.text).toContain('[Beställning]');
    expect(adminBody.text).toContain('Antal produkter: 2');
    expect(adminBody.text).toContain('[Leverans]');
    expect(adminBody.html).toContain('Refill inkommet');
    expect(adminBody.html).toContain('Beställning');
    expect(adminBody.reply_to).toBe('maja@example.com');

    const [, confirmationInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const confirmationBody = JSON.parse(String(confirmationInit.body));
    expect(confirmationBody.to).toEqual(['maja@example.com']);
    expect(confirmationBody.subject).toBe('Tack för din refill-beställning!');
    expect(confirmationBody.reply_to).toBe('info@privatetrainingonline.se');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, id: 'email_refill_123', channel: 'resend', confirmation_id: 'email_refill_confirm_123' });
  });

  it('posts registration notification to fixed admin inbox without customer confirmation', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_registration_123' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        source: 'registrering',
        submitted_at: '2026-03-06T09:10:00.000Z',
        first_name: 'Anna',
        last_name: 'Ny',
        email: 'anna@example.com',
        user_id: 'user_new_1',
        registration_source: 'supabase_auth_signup',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, adminInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const adminBody = JSON.parse(String(adminInit.body));
    expect(adminBody.subject).toContain('Registrering');
    expect(adminBody.to).toEqual(['info@privatetrainingonline.se']);
    expect(adminBody.text).toContain('[Kontaktuppgifter]');
    expect(adminBody.text).toContain('E-post: anna@example.com');
    expect(adminBody.text).toContain('[System]');
    expect(adminBody.text).toContain('Källa: supabase_auth_signup');
    expect(adminBody.reply_to).toBe('anna@example.com');

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, id: 'email_registration_123', channel: 'resend', confirmation_id: null });
  });
});
