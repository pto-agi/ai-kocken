export type TodoistOpenTask = {
  task_id: string;
  content: string;
  project_id: string;
  section_id: string | null;
  is_completed: boolean;
  description?: string | null;
  priority?: number | null;
  due?: string | null;
  created_at?: string | null;
  url?: string | null;
};

export type TodoistCompletedTask = {
  task_id: string;
  content: string;
  project_id: string;
  section_id: string | null;
  completed_at: string;
};

export type TodoistMirrorTask = {
  id: string;
  content: string;
  project_id: string;
  section_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  description: string | null;
  priority: number | null;
  due: string | null;
  created_at: string | null;
  url: string | null;
};

export const ARENDEN_PROJECT_FALLBACK = 'aerenden-6c47VwpqXfRJ3J7V';

export function extractCanonicalProjectId(projectId: string): string {
  const trimmed = String(projectId || '').trim();
  if (!trimmed) return '';
  if (!trimmed.includes('-')) return trimmed;
  if (trimmed.startsWith('aerenden-')) {
    const [, canonical = ''] = trimmed.split('aerenden-');
    return canonical || trimmed;
  }
  const parts = trimmed.split('-').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

export function parseMcpToolTextPayload(payloadText: string): unknown {
  if (typeof payloadText !== 'string' || payloadText.trim().length === 0) {
    throw new Error('Missing MCP payload text');
  }
  try {
    return JSON.parse(payloadText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid MCP payload JSON: ${message}`, { cause: error });
  }
}

export function mergeTodoistTasks(
  openTasks: TodoistOpenTask[],
  completedTasks: TodoistCompletedTask[]
): TodoistMirrorTask[] {
  const merged = new Map<string, TodoistMirrorTask>();

  completedTasks.forEach((task) => {
    if (!task?.task_id) return;
    merged.set(task.task_id, {
      id: task.task_id,
      content: task.content || '',
      project_id: task.project_id || '',
      section_id: task.section_id || null,
      is_completed: true,
      completed_at: task.completed_at || null,
      description: null,
      priority: null,
      due: null,
      created_at: null,
      url: null,
    });
  });

  openTasks.forEach((task) => {
    if (!task?.task_id) return;
    merged.set(task.task_id, {
      id: task.task_id,
      content: task.content || '',
      project_id: task.project_id || '',
      section_id: task.section_id || null,
      is_completed: false,
      completed_at: null,
      description: task.description ?? null,
      priority: task.priority ?? null,
      due: task.due ?? null,
      created_at: task.created_at ?? null,
      url: task.url ?? null,
    });
  });

  return Array.from(merged.values());
}
