import { describe, expect, it } from 'vitest';
import {
  extractCanonicalProjectId,
  mergeTodoistTasks,
  parseMcpToolTextPayload,
  type TodoistCompletedTask,
  type TodoistOpenTask,
} from '../utils/todoistMirror';

describe('todoist mirror utils', () => {
  it('extracts canonical project id from prefixed id', () => {
    expect(extractCanonicalProjectId('aerenden-6c47VwpqXfRJ3J7V')).toBe('6c47VwpqXfRJ3J7V');
    expect(extractCanonicalProjectId('6c47VwpqXfRJ3J7V')).toBe('6c47VwpqXfRJ3J7V');
  });

  it('parses json payload inside MCP text content', () => {
    const parsed = parseMcpToolTextPayload(
      '{"results":[{"task_id":"abc","content":"Task","is_completed":false}]}'
    ) as { results: Array<{ task_id: string; content: string; is_completed: boolean }> };

    expect(parsed.results[0].task_id).toBe('abc');
    expect(parsed.results[0].content).toBe('Task');
    expect(parsed.results[0].is_completed).toBe(false);
  });

  it('merges open and completed tasks and prefers open state on id collision', () => {
    const open: TodoistOpenTask[] = [
      {
        task_id: '1',
        content: 'Open task',
        project_id: 'p1',
        section_id: 's1',
        is_completed: false,
      },
      {
        task_id: '2',
        content: 'Reopened task',
        project_id: 'p1',
        section_id: null,
        is_completed: false,
      },
    ];

    const completed: TodoistCompletedTask[] = [
      {
        task_id: '2',
        content: 'Old completed version',
        project_id: 'p1',
        section_id: null,
        completed_at: '2026-03-02T10:00:00.000Z',
      },
      {
        task_id: '3',
        content: 'Completed task',
        project_id: 'p1',
        section_id: 's2',
        completed_at: '2026-03-01T10:00:00.000Z',
      },
    ];

    const merged = mergeTodoistTasks(open, completed);
    expect(merged).toHaveLength(3);
    expect(merged.find((task) => task.id === '1')?.is_completed).toBe(false);
    expect(merged.find((task) => task.id === '2')?.is_completed).toBe(false);
    expect(merged.find((task) => task.id === '3')?.is_completed).toBe(true);
  });
});
