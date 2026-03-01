import { describe, expect, it } from 'vitest';
import { buildHistoricalReportSummaries } from '../utils/managerHistoricalReports';

describe('manager historical report summaries', () => {
  it('computes planned/completed ratio and marks complete day as green', () => {
    const summaries = buildHistoricalReportSummaries({
      reports: [
        {
          user_id: 'u1',
          report_date: '2026-03-02',
          did: 'Gjorde allt',
          handover: 'Klart',
          start_time: '09:00',
          end_time: '17:00'
        }
      ],
      templates: [
        { id: 't1', title: 'Activity', schedule_days: ['MO'], sort_order: 1, estimated_minutes: 20 },
        { id: 't2', title: 'Admin', schedule_days: ['MO'], sort_order: 2, estimated_minutes: 15 }
      ],
      completions: [
        { user_id: 'u1', report_date: '2026-03-02', task_id: 't1' },
        { user_id: 'u1', report_date: '2026-03-02', task_id: 'custom:c1' }
      ],
      customTasks: [
        { id: 'c1', report_date: '2026-03-02', title: 'Ring kund', estimated_minutes: 10, is_active: true }
      ],
      removals: [
        { user_id: 'manager', report_date: '2026-03-02', task_id: 't2', is_removed: true }
      ]
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0].plannedCount).toBe(2);
    expect(summaries[0].completedCount).toBe(2);
    expect(summaries[0].status).toBe('complete');
    expect(summaries[0].completionLabel).toBe('2/2');
  });

  it('marks incomplete days as red', () => {
    const summaries = buildHistoricalReportSummaries({
      reports: [
        {
          user_id: 'u1',
          report_date: '2026-03-03',
          did: 'Delvis',
          handover: null,
          start_time: '09:00',
          end_time: '17:00'
        }
      ],
      templates: [
        { id: 't1', title: 'Activity', schedule_days: ['TU'], sort_order: 1, estimated_minutes: 20 },
        { id: 't2', title: 'Admin', schedule_days: ['TU'], sort_order: 2, estimated_minutes: 15 }
      ],
      completions: [{ user_id: 'u1', report_date: '2026-03-03', task_id: 't1' }],
      customTasks: [],
      removals: []
    });

    expect(summaries[0].plannedCount).toBe(2);
    expect(summaries[0].completedCount).toBe(1);
    expect(summaries[0].status).toBe('incomplete');
    expect(summaries[0].completionLabel).toBe('1/2');
  });

  it('returns neutral status when no tasks are planned', () => {
    const summaries = buildHistoricalReportSummaries({
      reports: [
        {
          user_id: 'u1',
          report_date: '2026-03-01',
          did: null,
          handover: null,
          start_time: null,
          end_time: null
        }
      ],
      templates: [
        { id: 't1', title: 'Weekday only', schedule_days: ['MO'], sort_order: 1, estimated_minutes: 20 }
      ],
      completions: [{ user_id: 'u1', report_date: '2026-03-01', task_id: 't1' }],
      customTasks: [],
      removals: []
    });

    expect(summaries[0].plannedCount).toBe(0);
    expect(summaries[0].completedCount).toBe(0);
    expect(summaries[0].status).toBe('no_plan');
    expect(summaries[0].completionLabel).toBe('0/0');
  });
});
