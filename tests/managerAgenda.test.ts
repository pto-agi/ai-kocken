import { describe, it, expect } from 'vitest';
import { buildDailyAgendaSummary, isSlowTask } from '../utils/managerAgenda';

describe('manager agenda', () => {
  it('flags slow task when completion exceeds estimated minutes', () => {
    const result = isSlowTask({
      completedAt: '2026-02-27T09:10:00Z',
      anchorTime: '2026-02-27T08:00:00Z',
      estimatedMinutes: 60
    });
    expect(result).toBe(true);
  });

  it('builds per-user daily summary with totals', () => {
    const summary = buildDailyAgendaSummary({
      dateKey: '2026-02-27',
      staff: [{ id: 'u1' }, { id: 'u2' }],
      templates: [
        { id: 't1', title: 'Startupplägg', sort_order: 1, estimated_minutes: 60, schedule_days: ['FR'] },
        { id: 't2', title: 'Ärenden', sort_order: 2, estimated_minutes: 30, schedule_days: ['FR'] }
      ],
      completionItems: [
        { user_id: 'u1', report_date: '2026-02-27', task_id: 't1', completed_at: '2026-02-27T09:10:00Z', completed_by: 'u1' }
      ],
      reportsByUser: {
        u1: { start_time: '08:00' },
        u2: { start_time: null }
      }
    });

    expect(summary.byUser.u1.completed).toBe(1);
    expect(summary.byUser.u1.total).toBe(2);
    expect(summary.byUser.u1.tasks[0].is_slow).toBe(true);
    expect(summary.byUser.u1.tasks[0].requires_quality_check).toBe(true);
    expect(summary.byUser.u2.completed).toBe(0);
    expect(summary.byUser.u2.total).toBe(2);
  });
});
