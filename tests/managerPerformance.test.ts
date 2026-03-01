import { describe, it, expect } from 'vitest';
import { computeWeeklyPerformance } from '../utils/managerPerformance';

describe('manager performance metrics', () => {
  it('computes adherence, report coverage, quality coverage, and slow task counts', () => {
    const result = computeWeeklyPerformance({
      dateKeys: ['2026-02-27', '2026-02-28'],
      staff: [{ id: 'u1' }, { id: 'u2' }],
      templates: [
        { id: 't1', title: 'Startupplägg', schedule_days: ['FR'], sort_order: 1, estimated_minutes: 60 },
        { id: 't2', title: 'Admin', schedule_days: ['FR'], sort_order: 2, estimated_minutes: 20 },
        { id: 't3', title: 'Ärenden', schedule_days: ['SA'], sort_order: 1, estimated_minutes: 30 }
      ],
      completionItems: [
        { user_id: 'u1', report_date: '2026-02-27', task_id: 't1', completed_at: '2026-02-27T09:15:00Z' },
        { user_id: 'u1', report_date: '2026-02-27', task_id: 't2', completed_at: '2026-02-27T08:05:00Z' },
        { user_id: 'u1', report_date: '2026-02-28', task_id: 't3', completed_at: '2026-02-28T08:20:00Z' },
        { user_id: 'u2', report_date: '2026-02-27', task_id: 't2', completed_at: '2026-02-27T08:25:00Z' }
      ],
      reports: [
        { user_id: 'u1', report_date: '2026-02-27', start_time: '08:00' },
        { user_id: 'u1', report_date: '2026-02-28', start_time: '08:00' },
        { user_id: 'u2', report_date: '2026-02-27', start_time: '08:00' }
      ]
    });

    expect(result.byUser.u1.expectedTasks).toBe(3);
    expect(result.byUser.u1.completedTasks).toBe(3);
    expect(result.byUser.u1.adherencePct).toBe(100);
    expect(result.byUser.u1.reportCoveragePct).toBe(100);
    expect(result.byUser.u1.qualityCoveragePct).toBe(100);
    expect(result.byUser.u1.slowTasks).toBe(3);

    expect(result.byUser.u2.expectedTasks).toBe(3);
    expect(result.byUser.u2.completedTasks).toBe(1);
    expect(result.byUser.u2.adherencePct).toBe(33);
    expect(result.byUser.u2.reportCoveragePct).toBe(50);

    expect(result.totals.expectedTasks).toBe(6);
    expect(result.totals.completedTasks).toBe(4);
    expect(result.totals.adherencePct).toBe(67);
  });

  it('supports start_time values with seconds', () => {
    const result = computeWeeklyPerformance({
      dateKeys: ['2026-02-28'],
      staff: [{ id: 'u1' }],
      templates: [
        { id: 't1', title: 'Admin', schedule_days: ['SA'], sort_order: 1, estimated_minutes: 20 }
      ],
      completionItems: [
        { user_id: 'u1', report_date: '2026-02-28', task_id: 't1', completed_at: '2026-02-28T08:30:00Z' }
      ],
      reports: [
        { user_id: 'u1', report_date: '2026-02-28', start_time: '08:00:00' }
      ]
    });

    expect(result.byUser.u1.completedTasks).toBe(1);
    expect(result.totals.completedTasks).toBe(1);
  });
});
