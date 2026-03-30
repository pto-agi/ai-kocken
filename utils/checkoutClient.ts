/**
 * Checkout Client — API utilities for the new checkout page
 */

export interface CreateIntentPayload {
  planId: string;
  email: string;
  fullName?: string;
  userId?: string;
}

export interface CreateIntentResponse {
  ok: boolean;
  clientSecret?: string;
  mode?: 'payment' | 'subscription';
  publishableKey?: string;
  customerId?: string;
  amount?: number;
  currency?: string;
  planId?: string;
  error?: string;
}

export async function createIntent(
  payload: CreateIntentPayload,
  accessToken?: string | null,
): Promise<CreateIntentResponse> {
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;
  return {
    ok: false,
    error: typeof data?.error === 'string' ? data.error : 'Kunde inte starta betalning',
  };
}
