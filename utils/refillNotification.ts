const EDGE_FUNCTION_URL = 'https://cghnlrinjtexhvetngbe.supabase.co/functions/v1/email-trigger';

export const REFILL_NOTIFICATION_ENDPOINT = EDGE_FUNCTION_URL;

export type RefillNotificationBody = {
  source: 'refill';
  data: Record<string, unknown>;
};

export function buildRefillNotificationBody(
  payload: Record<string, unknown>,
  _submittedAt: Date = new Date(),
): RefillNotificationBody {
  return {
    source: 'refill',
    data: payload,
  };
}

export async function sendRefillNotification(
  body: RefillNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
