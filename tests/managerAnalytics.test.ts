import { describe, it, expect } from 'vitest';
import { buildTaskDeltaAnalysis } from '../utils/managerAnalytics';

describe('manager analytics', () => {
  it('computes expected time and severity from estimated minutes', () => {
    const result = buildTaskDeltaAnalysis({
      currentDateKey: '2026-03-01',
      dateKeys: ['2026-02-28'],
      staff: [{ id: 'u1' }],
      templates: [
        { id: 't1', title: 'Task 1', sort_order: 1, schedule_days: ['SA'], estimated_minutes: 30 },
        { id: 't2', title: 'Task 2', sort_order: 2, schedule_days: ['SA'], estimated_minutes: 30 }
      ],
      completionItems: [
        { user_id: 'u1', report_date: '2026-02-28', task_id: 't1', completed_at: '2026-02-28T09:20:00' },
        { user_id: 'u1', report_date: '2026-02-28', task_id: 't2', completed_at: '2026-02-28T10:40:00' }
      ],
      reports: [
        { user_id: 'u1', report_date: '2026-02-28', start_time: '08:00' }
      ],
      overrides: []
    });

    const first = result.rows.find((row) => row.task_id === 't1');
    const second = result.rows.find((row) => row.task_id === 't2');

    expect(first?.delta_minutes).toBe(-10);
    expect(first?.auto_level).toBe('ok');
    expect(second?.delta_minutes).toBe(40);
    expect(second?.auto_level).toBe('warning');
  });

  it('marks missing historical tasks and supports manager override', () => {
    const result = buildTaskDeltaAnalysis({
      currentDateKey: '2026-03-01',
      dateKeys: ['2026-02-27'],
      staff: [{ id: 'u1' }],
      templates: [
        { id: 't1', title: 'Task 1', sort_order: 1, schedule_days: ['FR'], estimated_minutes: 20 }
      ],
      completionItems: [],
      reports: [],
      overrides: [
        {
          user_id: 'u1',
          report_date: '2026-02-27',
          task_id: 't1',
          is_alarming: false,
          reason: 'Approved delay'
        }
      ]
    });

    expect(result.rows[0].auto_level).toBe('missing');
    expect(result.rows[0].final_is_alarming).toBe(false);
    expect(result.rows[0].manager_reason).toBe('Approved delay');
  });

  it('summarizes totals for alarming and completion rates', () => {
    const result = buildTaskDeltaAnalysis({
      currentDateKey: '2026-03-01',
      dateKeys: ['2026-02-28'],
      staff: [{ id: 'u1' }],
      templates: [
        { id: 't1', title: 'Task 1', sort_order: 1, schedule_days: ['SA'], estimated_minutes: 15 },
        { id: 't2', title: 'Task 2', sort_order: 2, schedule_days: ['SA'], estimated_minutes: 15 }
      ],
      completionItems: [
        { user_id: 'u1', report_date: '2026-02-28', task_id: 't1', completed_at: '2026-02-28T08:50:00.000Z' }
      ],
      reports: [
        { user_id: 'u1', report_date: '2026-02-28', start_time: '08:00' }
      ],
      overrides: []
    });

    expect(result.totals.scheduled_tasks).toBe(2);
    expect(result.totals.completed_tasks).toBe(1);
    expect(result.totals.completion_pct).toBe(50);
    expect(result.totals.warning_tasks + result.totals.critical_tasks + result.totals.missing_tasks).toBeGreaterThan(0);
  });

  it('does not crash when report start_time is invalid', () => {
    const result = buildTaskDeltaAnalysis({
      currentDateKey: '2026-03-01',
      dateKeys: ['2026-02-28'],
      staff: [{ id: 'u1' }],
      templates: [
        { id: 't1', title: 'Task 1', sort_order: 1, schedule_days: ['SA'], estimated_minutes: 15 }
      ],
      completionItems: [],
      reports: [
        { user_id: 'u1', report_date: '2026-02-28', start_time: '99:99' }
      ],
      overrides: []
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].expected_completed_at).toContain('T');
  });
});
