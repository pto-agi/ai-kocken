import { describe, expect, it, vi } from 'vitest';

import {
  START_NOTIFICATION_ENDPOINT,
  buildStartNotificationBody,
  sendStartNotification,
} from '../utils/startNotification';

describe('start notification helper', () => {
  it('uses only internal notification endpoint (no webhook url)', () => {
    expect(START_NOTIFICATION_ENDPOINT).toBe('/api/form-notifications');
    expect(START_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('zapier');
    expect(START_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('webhook');
  });

  it('builds payload with fixed source and submitted_at', () => {
    const payload = buildStartNotificationBody(
      { first_name: 'Ada', sessions_per_week: '3 pass per vecka' },
      new Date('2026-03-05T13:00:00.000Z'),
    );

    expect(payload).toMatchObject({
      first_name: 'Ada',
      sessions_per_week: '3 pass per vecka',
      source: 'startform',
      submitted_at: '2026-03-05T13:00:00.000Z',
    });
  });

  it('posts notification body to internal form-notifications endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));

    await sendStartNotification(
      { first_name: 'Ada', source: 'startform', submitted_at: '2026-03-05T13:00:00.000Z' },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/form-notifications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      source: 'startform',
      first_name: 'Ada',
    });
  });
});
