export const UPPFOLJNING_NOTIFICATION_ENDPOINT = '/api/form-notifications';

export type UppfoljningNotificationBody = Record<string, unknown> & {
  source: 'uppfoljning';
  submitted_at: string;
};

export function buildUppfoljningNotificationBody(
  payload: Record<string, unknown>,
  submittedAt: Date = new Date(),
): UppfoljningNotificationBody {
  return {
    ...payload,
    source: 'uppfoljning',
    submitted_at: submittedAt.toISOString(),
  };
}

export async function sendUppfoljningNotification(
  body: UppfoljningNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(UPPFOLJNING_NOTIFICATION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
