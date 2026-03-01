import { describe, it, expect } from 'vitest';
import { buildAgendaItemsForDate } from '../utils/agendaTaskCatalog';

describe('agenda task catalog', () => {
  it('includes active custom manager tasks for selected date in intranet agenda', () => {
    const result = buildAgendaItemsForDate({
      dateKey: '2026-03-02',
      dayCode: 'MO',
      templates: [
        { id: 't1', title: 'Startupplägg', schedule_days: ['MO'], sort_order: 1, input_type: 'none', estimated_minutes: 30 }
      ],
      customTasks: [
        { id: 'c1', report_date: '2026-03-02', title: 'Ring 3 kunder', estimated_minutes: 15, is_active: true }
      ]
    });

    expect(result.map((task) => task.id)).toEqual(['t1', 'custom:c1']);
    expect(result[1].title).toBe('Ring 3 kunder');
  });

  it('excludes inactive and wrong-date custom tasks', () => {
    const result = buildAgendaItemsForDate({
      dateKey: '2026-03-02',
      dayCode: 'MO',
      templates: [],
      customTasks: [
        { id: 'c1', report_date: '2026-03-01', title: 'Fel dag', estimated_minutes: 15, is_active: true },
        { id: 'c2', report_date: '2026-03-02', title: 'Inaktiv', estimated_minutes: 15, is_active: false }
      ]
    });

    expect(result).toEqual([]);
  });

  it('hides removed recurring task for current user/date', () => {
    const result = buildAgendaItemsForDate({
      dateKey: '2026-03-02',
      dayCode: 'MO',
      currentUserId: 'u1',
      templates: [
        { id: 't1', title: 'Startupplägg', schedule_days: ['MO'], sort_order: 1, input_type: 'none', estimated_minutes: 30 }
      ],
      customTasks: [],
      removals: [
        { user_id: 'u1', report_date: '2026-03-02', task_id: 't1', is_removed: true }
      ]
    });

    expect(result).toEqual([]);
  });

  it('does not hide tasks removed for another user when current user is different', () => {
    const result = buildAgendaItemsForDate({
      dateKey: '2026-03-02',
      dayCode: 'MO',
      currentUserId: 'staff-user',
      templates: [
        { id: 't1', title: 'Startupplägg', schedule_days: ['MO'], sort_order: 1, input_type: 'none', estimated_minutes: 30 }
      ],
      customTasks: [],
      removals: [
        { user_id: 'manager-user', report_date: '2026-03-02', task_id: 't1', is_removed: true }
      ]
    });

    expect(result.map((task) => task.id)).toEqual(['t1']);
  });

  it('treats removals as global when current user id is omitted', () => {
    const result = buildAgendaItemsForDate({
      dateKey: '2026-03-02',
      dayCode: 'MO',
      templates: [
        { id: 't1', title: 'Startupplägg', schedule_days: ['MO'], sort_order: 1, input_type: 'none', estimated_minutes: 30 }
      ],
      customTasks: [],
      removals: [
        { user_id: 'manager-user', report_date: '2026-03-02', task_id: 't1', is_removed: true }
      ]
    });

    expect(result).toEqual([]);
  });
});
