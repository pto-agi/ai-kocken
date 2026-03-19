const EDGE_FUNCTION_URL = 'https://cghnlrinjtexhvetngbe.supabase.co/functions/v1/email-trigger';

export const UPPFOLJNING_NOTIFICATION_ENDPOINT = EDGE_FUNCTION_URL;

export type UppfoljningNotificationBody = {
  source: 'uppfoljning';
  data: Record<string, unknown>;
};

export function buildUppfoljningNotificationBody(
  payload: Record<string, unknown>,
  _submittedAt: Date = new Date(),
): UppfoljningNotificationBody {
  return {
    source: 'uppfoljning',
    data: payload,
  };
}

export async function sendUppfoljningNotification(
  body: UppfoljningNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
