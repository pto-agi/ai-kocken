export const REFILL_NOTIFICATION_ENDPOINT = '/api/form-notifications';

export type RefillNotificationBody = Record<string, unknown> & {
  source: 'refill';
  submitted_at: string;
};

export function buildRefillNotificationBody(
  payload: Record<string, unknown>,
  submittedAt: Date = new Date(),
): RefillNotificationBody {
  return {
    ...payload,
    source: 'refill',
    submitted_at: submittedAt.toISOString(),
  };
}

export async function sendRefillNotification(
  body: RefillNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(REFILL_NOTIFICATION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
