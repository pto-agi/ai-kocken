import { describe, it, expect } from 'vitest';
import { buildTaskRemovalSet, isTaskRemoved } from '../utils/managerTaskRemovals';

describe('manager task removals', () => {
  it('marks only removed tasks as hidden', () => {
    const removedSet = buildTaskRemovalSet([
      { user_id: 'u1', report_date: '2026-03-01', task_id: 't1', is_removed: true },
      { user_id: 'u1', report_date: '2026-03-01', task_id: 't2', is_removed: false }
    ]);

    expect(isTaskRemoved(removedSet, 'u1', '2026-03-01', 't1')).toBe(true);
    expect(isTaskRemoved(removedSet, 'u1', '2026-03-01', 't2')).toBe(false);
  });

  it('respects user and report date boundaries', () => {
    const removedSet = buildTaskRemovalSet([
      { user_id: 'u1', report_date: '2026-03-01', task_id: 't1', is_removed: true }
    ]);

    expect(isTaskRemoved(removedSet, 'u1', '2026-03-02', 't1')).toBe(false);
    expect(isTaskRemoved(removedSet, 'u2', '2026-03-01', 't1')).toBe(false);
  });
});
