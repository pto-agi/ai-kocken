import { describe, it, expect } from 'vitest';
import { buildCompletionItemAction } from '../utils/agendaCompletionItems';

describe('agenda completion items', () => {
  it('returns insert payload when checking a task', () => {
    const result = buildCompletionItemAction({
      wasChecked: false,
      userId: 'u1',
      reportDate: '2026-02-27',
      taskId: 't1'
    });

    expect(result.type).toBe('insert');
    if (result.type === 'insert') {
      expect(result.payload.user_id).toBe('u1');
      expect(result.payload.task_id).toBe('t1');
    }
  });

  it('returns delete selector when unchecking a task', () => {
    const result = buildCompletionItemAction({
      wasChecked: true,
      userId: 'u1',
      reportDate: '2026-02-27',
      taskId: 't1'
    });

    expect(result.type).toBe('delete');
    if (result.type === 'delete') {
      expect(result.selector).toEqual({
        user_id: 'u1',
        report_date: '2026-02-27',
        task_id: 't1'
      });
    }
  });
});
