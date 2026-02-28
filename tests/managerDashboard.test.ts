import { describe, it, expect } from 'vitest';
import { formatDateKey, getWorkweekDateKeys, summarizeWeek } from '../utils/managerDashboard';

describe('manager dashboard utils', () => {
  it('formats date keys in YYYY-MM-DD', () => {
    const key = formatDateKey(new Date('2026-02-27T10:00:00Z'));
    expect(key).toBe('2026-02-27');
  });

  it('returns five workweek date keys starting Monday', () => {
    const keys = getWorkweekDateKeys(new Date('2026-02-27T10:00:00Z'));
    expect(keys).toEqual([
      '2026-02-23',
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27'
    ]);
  });

  it('summarizes completion per user for a week', () => {
    const summary = summarizeWeek({
      dateKeys: ['2026-02-23', '2026-02-24'],
      templatesByDay: {
        '2026-02-23': [{ id: 't1' }, { id: 't2' }],
        '2026-02-24': [{ id: 't1' }]
      },
      completionsByUser: {
        u1: {
          '2026-02-23': ['t1'],
          '2026-02-24': ['t1']
        },
        u2: {
          '2026-02-23': ['t1', 't2'],
          '2026-02-24': []
        }
      }
    });

    expect(summary.byUser.u1.completed).toBe(2);
    expect(summary.byUser.u1.total).toBe(3);
    expect(summary.byUser.u2.completed).toBe(2);
    expect(summary.byUser.u2.total).toBe(3);
  });
});
