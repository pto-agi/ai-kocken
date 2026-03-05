import { describe, expect, it } from 'vitest';
import { buildCompletionMapByDate, parseCompletedTaskIds, resolveCompletedTaskIds } from '../utils/agendaCompletionState';

describe('resolveCompletedTaskIds', () => {
  it('prefers completion item ids when available', () => {
    const ids = resolveCompletedTaskIds({
      completionItemsAvailable: true,
      completionItemRows: [{ task_id: 'task-1' }, { task_id: 'task-2' }],
      legacyCompletedTaskIds: ['task-legacy']
    });
    expect(ids).toEqual(['task-1', 'task-2']);
  });

  it('falls back to legacy ids when completion items are unavailable', () => {
    const ids = resolveCompletedTaskIds({
      completionItemsAvailable: false,
      completionItemRows: [],
      legacyCompletedTaskIds: ['task-legacy']
    });
    expect(ids).toEqual(['task-legacy']);
  });

  it('ignores legacy ids when completion items are available but empty', () => {
    const ids = resolveCompletedTaskIds({
      completionItemsAvailable: true,
      completionItemRows: [],
      legacyCompletedTaskIds: ['task-legacy']
    });
    expect(ids).toEqual([]);
  });

  it('returns empty list when no source has values', () => {
    const ids = resolveCompletedTaskIds({
      completionItemsAvailable: false,
      completionItemRows: [],
      legacyCompletedTaskIds: []
    });
    expect(ids).toEqual([]);
  });
});

describe('parseCompletedTaskIds', () => {
  it('parses arrays directly', () => {
    expect(parseCompletedTaskIds(['task-1', 'task-2'])).toEqual(['task-1', 'task-2']);
  });

  it('parses json array strings', () => {
    expect(parseCompletedTaskIds('["task-1","task-2"]')).toEqual(['task-1', 'task-2']);
  });

  it('returns empty on invalid values', () => {
    expect(parseCompletedTaskIds('not-json')).toEqual([]);
    expect(parseCompletedTaskIds(null)).toEqual([]);
  });
});

describe('buildCompletionMapByDate', () => {
  it('groups completion item rows by report date and keeps unique task ids', () => {
    const map = buildCompletionMapByDate({
      dateKeys: ['2026-03-02', '2026-03-03', '2026-03-04'],
      completionItemRows: [
        { report_date: '2026-03-03', task_id: 'task-1' },
        { report_date: '2026-03-03', task_id: 'task-1' },
        { report_date: '2026-03-03', task_id: 'task-2' },
        { report_date: '2026-03-04', task_id: 'task-3' },
      ],
      legacyRows: []
    });

    expect(map).toEqual({
      '2026-03-02': [],
      '2026-03-03': ['task-1', 'task-2'],
      '2026-03-04': ['task-3']
    });
  });

  it('falls back to legacy completed_task_ids when completion item rows are unavailable', () => {
    const map = buildCompletionMapByDate({
      dateKeys: ['2026-03-02', '2026-03-03'],
      completionItemRows: [],
      legacyRows: [
        { report_date: '2026-03-02', completed_task_ids: ['legacy-1'] },
        { report_date: '2026-03-03', completed_task_ids: '["legacy-2","legacy-3"]' }
      ]
    });

    expect(map).toEqual({
      '2026-03-02': ['legacy-1'],
      '2026-03-03': ['legacy-2', 'legacy-3']
    });
  });
});
