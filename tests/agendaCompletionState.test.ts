import { describe, expect, it } from 'vitest';
import { parseCompletedTaskIds, resolveCompletedTaskIds } from '../utils/agendaCompletionState';

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
