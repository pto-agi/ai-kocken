import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const updateSubscriptionMock = vi.fn();
  const resolveAuthUserMock = vi.fn();
  const profileSingleMock = vi.fn();
  const profileUpdateEqMock = vi.fn();
  const profileSelectEqMock = vi.fn(() => ({ single: profileSingleMock }));
  const profileSelectMock = vi.fn(() => ({ eq: profileSelectEqMock }));
  const profileUpdateMock = vi.fn(() => ({ eq: profileUpdateEqMock }));
  const logInsertMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: profileSelectMock,
        update: profileUpdateMock,
      };
    }

    if (table === 'agent_activity_log') {
      return {
        insert: logInsertMock,
      };
    }

    return {
      insert: vi.fn(),
    };
  });

  return {
    updateSubscriptionMock,
    resolveAuthUserMock,
    profileSingleMock,
    profileUpdateEqMock,
    logInsertMock,
    fromMock,
  };
});

vi.mock('../api/_shared/paymentHelpers.js', () => ({
  getStripeClient: () => ({
    subscriptions: {
      update: mocks.updateSubscriptionMock,
    },
  }),
  getSupabaseAdmin: () => ({
    from: mocks.fromMock,
  }),
  resolveAuthUser: mocks.resolveAuthUserMock,
}));

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

describe('member actions api cancel_subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthUserMock.mockResolvedValue({ id: 'user_123' });
    mocks.profileSingleMock.mockResolvedValue({
      data: {
        stripe_subscription_id: 'sub_123',
        stripe_customer_id: 'cus_123',
        email: 'member@example.com',
        full_name: 'Member Test',
        membership_type: 'premium',
      },
      error: null,
    });
    mocks.profileUpdateEqMock.mockResolvedValue({ error: null });
    mocks.logInsertMock.mockResolvedValue({ error: null });
    mocks.updateSubscriptionMock.mockResolvedValue({ cancel_at: 1798675200 });
  });

  it('requires bearer token for cancel subscription', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { action_type: 'cancel_subscription' },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({
      error: 'Du måste vara inloggad för att avbryta din prenumeration.',
    });
    expect(mocks.resolveAuthUserMock).not.toHaveBeenCalled();
    expect(mocks.updateSubscriptionMock).not.toHaveBeenCalled();
  });

  it('cancels subscription at period end for authenticated user', async () => {
    const req: MockReq = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token_123',
      },
      body: {
        action_type: 'cancel_subscription',
        reason: 'cost',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(mocks.resolveAuthUserMock).toHaveBeenCalledWith('token_123');
    expect(mocks.updateSubscriptionMock).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
      metadata: expect.objectContaining({
        cancel_reason: 'cost',
        canceled_by: 'customer_self_service',
      }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      ok: true,
      message: expect.stringContaining('Din prenumeration avslutas'),
      cancelAt: expect.any(String),
    });
  });
});
