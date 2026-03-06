import { describe, expect, it, vi } from 'vitest';

import {
  REFILL_NOTIFICATION_ENDPOINT,
  buildRefillNotificationBody,
  sendRefillNotification,
} from '../utils/refillNotification';

describe('refill notification helper', () => {
  it('uses only internal notification endpoint (no webhook url)', () => {
    expect(REFILL_NOTIFICATION_ENDPOINT).toBe('/api/form-notifications');
    expect(REFILL_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('zapier');
    expect(REFILL_NOTIFICATION_ENDPOINT.toLowerCase()).not.toContain('webhook');
  });

  it('builds payload with fixed source and submitted_at', () => {
    const payload = buildRefillNotificationBody(
      { first_name: 'Ada', item_count: '2' },
      new Date('2026-03-06T10:00:00.000Z'),
    );

    expect(payload).toMatchObject({
      first_name: 'Ada',
      item_count: '2',
      source: 'refill',
      submitted_at: '2026-03-06T10:00:00.000Z',
    });
  });

  it('posts notification body to internal form-notifications endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));

    await sendRefillNotification(
      { first_name: 'Ada', source: 'refill', submitted_at: '2026-03-06T10:00:00.000Z' },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/form-notifications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      source: 'refill',
      first_name: 'Ada',
    });
  });
});
