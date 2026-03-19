const EDGE_FUNCTION_URL = 'https://cghnlrinjtexhvetngbe.supabase.co/functions/v1/email-trigger';

export const START_NOTIFICATION_ENDPOINT = EDGE_FUNCTION_URL;

export type StartNotificationBody = {
  source: 'startform';
  data: Record<string, unknown>;
};

export function buildStartNotificationBody(
  payload: Record<string, unknown>,
  _submittedAt: Date = new Date(),
): StartNotificationBody {
  return {
    source: 'startform',
    data: payload,
  };
}

export async function sendStartNotification(
  body: StartNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
