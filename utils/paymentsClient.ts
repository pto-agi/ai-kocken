import type { CreateCheckoutSessionPayload, CreateCheckoutSessionResponse } from '../lib/paymentTypes';

export async function createCheckoutSession(
  payload: CreateCheckoutSessionPayload,
  accessToken?: string | null,
): Promise<CreateCheckoutSessionResponse> {
  const response = await fetch('/api/payments/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : 'Kunde inte starta checkout',
    };
  }

  return data as CreateCheckoutSessionResponse;
}

export async function fetchCheckoutSessionStatus(sessionId: string): Promise<Record<string, unknown>> {
  const url = `/api/payments/session-status?session_id=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Kunde inte hämta checkout-status');
  }
  return data as Record<string, unknown>;
}

export async function claimPendingEntitlements(
  accessToken: string | null | undefined,
): Promise<{ ok: boolean; resolved_count?: number; applied?: string[]; error?: string }> {
  if (!accessToken) {
    return { ok: false, error: 'Authentication required' };
  }

  const response = await fetch('/api/payments/claim-pending-entitlements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : 'Kunde inte claima pending entitlements',
    };
  }

  return data as { ok: boolean; resolved_count?: number; applied?: string[] };
}
