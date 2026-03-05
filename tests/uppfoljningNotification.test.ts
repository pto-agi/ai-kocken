import { describe, expect, it, vi } from 'vitest';

import {
  UPPFOLJNING_NOTIFICATION_ENDPOINT,
  buildUppfoljningNotificationBody,
  sendUppfoljningNotification,
} from '../utils/uppfoljningNotification';

describe('uppfoljning notification helper', () => {
  it('uses only internal notification endpoint (no webhook url)', () => {
    expect(UPPFOLJNING_NOTIFICATION_ENDPOINT).toBe('/api/form-notifications');
    expect(UPPFOLJNING_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('zapier');
    expect(UPPFOLJNING_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('webhook');
  });

  it('builds payload with fixed source and submitted_at', () => {
    const payload = buildUppfoljningNotificationBody(
      { first_name: 'Ada', quick_keep_plan: true },
      new Date('2026-03-05T13:00:00.000Z'),
    );

    expect(payload).toMatchObject({
      first_name: 'Ada',
      quick_keep_plan: true,
      source: 'uppfoljning',
      submitted_at: '2026-03-05T13:00:00.000Z',
    });
  });

  it('posts notification body to internal form-notifications endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));

    await sendUppfoljningNotification(
      { first_name: 'Ada', source: 'uppfoljning', submitted_at: '2026-03-05T13:00:00.000Z' },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/form-notifications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      source: 'uppfoljning',
      first_name: 'Ada',
    });
  });
});
