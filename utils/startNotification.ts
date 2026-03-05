export const START_NOTIFICATION_ENDPOINT = '/api/form-notifications';

export type StartNotificationBody = Record<string, unknown> & {
  source: 'startform';
  submitted_at: string;
};

export function buildStartNotificationBody(
  payload: Record<string, unknown>,
  submittedAt: Date = new Date(),
): StartNotificationBody {
  return {
    ...payload,
    source: 'startform',
    submitted_at: submittedAt.toISOString(),
  };
}

export async function sendStartNotification(
  body: StartNotificationBody,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  return fetchFn(START_NOTIFICATION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
