import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const generateContentMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: generateContentMock,
    };
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

import handler from '../api/gemini';

type MockReq = {
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type MockRes = {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockRes;
  json: (body: unknown) => void;
};

function createRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    jsonBody: null,
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
  };

  return res;
}

describe('gemini api guardrails', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.GEMINI_RATE_LIMIT_MAX = '2';
    process.env.GEMINI_RATE_LIMIT_WINDOW_MS = '60000';
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    generateContentMock.mockResolvedValue({ text: '[]' });
  });

  it('returns 401 when access token is missing', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { contents: 'Skapa veckoplan' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Missing access token' });
  });

  it('returns 401 when access token cannot be verified', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req: MockReq = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer invalid-token',
      },
      body: { contents: 'Skapa veckoplan' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Invalid access token' });
  });

  it('returns 429 when request rate exceeds limit window', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: { contents: 'Skapa veckoplan' },
    };

    const first = createRes();
    const second = createRes();
    const third = createRes();

    await handler(req, first);
    await handler(req, second);
    await handler(req, third);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(third.jsonBody).toEqual({ error: 'Rate limit exceeded' });
  });
});
