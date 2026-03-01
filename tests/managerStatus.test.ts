import { describe, expect, it } from 'vitest';
import { computeOverEstimateDays } from '../utils/managerStatus';

describe('manager status metrics', () => {
  it('computes percent of days above estimated agenda time in selected window', () => {
    const result = computeOverEstimateDays({
      dateKeys: ['2026-03-01', '2026-03-02'],
      templates: [
        { id: 't1', schedule_days: ['SU', 'MO'], estimated_minutes: 120 },
        { id: 't2', schedule_days: ['SU'], estimated_minutes: 30 }
      ],
      customTasks: [
        { id: 'c1', report_date: '2026-03-01', estimated_minutes: 200, is_active: true }
      ],
      removals: [
        { report_date: '2026-03-01', task_id: 't2', is_removed: true }
      ],
      reports: [
        { user_id: 'u1', report_date: '2026-03-01', start_time: '09:00', end_time: '13:00' },
        { user_id: 'u1', report_date: '2026-03-02', start_time: '09:00', end_time: '10:30' },
        { user_id: 'u2', report_date: '2026-03-01', start_time: '09:00', end_time: '15:30' }
      ]
    });

    expect(result.comparableDays).toBe(2);
    expect(result.overEstimateDays).toBe(1);
    expect(result.overEstimatePct).toBe(50);
  });

  it('ignores days without valid report duration or estimated time', () => {
    const result = computeOverEstimateDays({
      dateKeys: ['2026-03-03'],
      templates: [
        { id: 't1', schedule_days: ['MO'], estimated_minutes: null }
      ],
      customTasks: [],
      removals: [],
      reports: [
        { user_id: 'u1', report_date: '2026-03-03', start_time: null, end_time: '12:00' }
      ]
    });

    expect(result.comparableDays).toBe(0);
    expect(result.overEstimateDays).toBe(0);
    expect(result.overEstimatePct).toBe(0);
  });
});
