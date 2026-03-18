import {
  ARENDEN_PROJECT_FALLBACK,
  extractCanonicalProjectId,
  type TodoistCompletedTask,
  type TodoistOpenTask,
} from '../utils/todoistMirror.js';

const TODOIST_API_V1 = 'https://api.todoist.com/api/v1';

type TodoistProject = {
  id: string;
  name: string;
  color?: string | null;
  is_favorite?: boolean;
};

type TodoistSection = {
  id: string;
  name: string;
};

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asNullableString(value: unknown): string | null {
  const str = asString(value).trim();
  return str.length > 0 ? str : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function computeCompletionWindow() {
  const until = new Date();
  const since = new Date(until);
  since.setDate(until.getDate() - 89);
  return {
    since: since.toISOString(),
    until: until.toISOString(),
  };
}

function getDirectTodoistToken() {
  return String(process.env.TODOIST_API_KEY || '').trim();
}

async function directTodoistRequest<T = any>(input: {
  url: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  expectNoContent?: boolean;
}): Promise<T> {
  const token = getDirectTodoistToken();
  if (!token) throw new Error('Missing TODOIST_API_KEY');

  const response = await fetch(input.url, {
    method: input.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(input.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Todoist REST error (${response.status}): ${text || response.statusText}`);
  }

  if (input.expectNoContent || response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function normalizeOpenTasks(results: unknown): TodoistOpenTask[] {
  return toArray<Record<string, unknown>>(results).map((task) => {
    const dueRaw = task.due as Record<string, unknown> | null;
    const due = asNullableString(dueRaw?.datetime) || asNullableString(dueRaw?.date);
    return {
      task_id: asString(task.id),
      content: asString(task.content),
      project_id: asString(task.project_id),
      section_id: asNullableString(task.section_id),
      is_completed: false,
      description: asNullableString(task.description),
      priority: asNullableNumber(task.priority),
      due,
      created_at: asNullableString(task.created_at),
      url: asNullableString(task.url),
    };
  });
}

function normalizeCompletedTasks(results: unknown): TodoistCompletedTask[] {
  const items = Array.isArray((results as any)?.items)
    ? ((results as any).items as Array<Record<string, unknown>>)
    : toArray<Record<string, unknown>>(results);

  return items
    .map((task) => ({
      task_id: asString(task.id || task.task_id),
      content: asString(task.content),
      project_id: asString(task.project_id),
      section_id: asNullableString(task.section_id),
      completed_at: asString(task.completed_at),
    }))
    .filter((task) => task.task_id && task.completed_at);
}

function normalizeSections(results: unknown): TodoistSection[] {
  return toArray<Record<string, unknown>>(results)
    .map((section) => ({
      id: asString(section.id),
      name: asString(section.name),
    }))
    .filter((section) => section.id && section.name);
}

async function resolveProject(): Promise<TodoistProject> {
  const configuredId = extractCanonicalProjectId(
    process.env.TODOIST_AERENDEN_PROJECT_ID || ARENDEN_PROJECT_FALLBACK
  );

  const projects = await directTodoistRequest<Array<Record<string, unknown>>>({
    method: 'GET',
    url: `${TODOIST_API_V1}/projects`,
  });

  const byName = projects.find(
    (project) => asString(project.name).trim().toLowerCase() === 'ärenden'
  );
  const byId = configuredId
    ? projects.find((project) => asString(project.id) === configuredId)
    : null;

  const selected = byName || byId || null;
  if (selected) {
    return {
      id: asString(selected.id),
      name: asString(selected.name) || 'Ärenden',
      color: asNullableString(selected.color),
      is_favorite: Boolean(selected.is_favorite),
    };
  }

  if (configuredId) {
    return {
      id: configuredId,
      name: 'Ärenden',
      color: null,
      is_favorite: false,
    };
  }

  throw new Error('Missing Todoist project id for Ärenden');
}

export async function fetchTodoistSnapshot() {
  const project = await resolveProject();
  const { since, until } = computeCompletionWindow();

  const [sections, openTasks, completedResponse] = await Promise.all([
    directTodoistRequest<Array<Record<string, unknown>>>({
      method: 'GET',
      url: `${TODOIST_API_V1}/sections?project_id=${encodeURIComponent(project.id)}`,
    }),
    directTodoistRequest<Array<Record<string, unknown>>>({
      method: 'GET',
      url: `${TODOIST_API_V1}/tasks?project_id=${encodeURIComponent(project.id)}`,
    }),
    directTodoistRequest<Record<string, unknown>>({
      method: 'GET',
      url: `${TODOIST_API_V1}/tasks/completed/by_completion_date?project_id=${encodeURIComponent(project.id)}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
    }),
  ]);

  return {
    project,
    sections: normalizeSections(sections),
    openTasks: normalizeOpenTasks(openTasks),
    completedTasks: normalizeCompletedTasks(completedResponse),
  };
}

export async function createTodoistTask(input: {
  projectId: string;
  content: string;
  sectionId?: string | null;
}) {
  const created = await directTodoistRequest<Record<string, unknown>>({
    method: 'POST',
    url: `${TODOIST_API_V1}/tasks`,
    body: {
      project_id: input.projectId,
      content: input.content,
      ...(input.sectionId ? { section_id: input.sectionId } : {}),
    },
  });
  return { results: created };
}

export async function updateTodoistTask(input: {
  id: string;
  content?: string;
}) {
  await directTodoistRequest({
    method: 'POST',
    url: `${TODOIST_API_V1}/tasks/${encodeURIComponent(input.id)}`,
    body: {
      ...(input.content ? { content: input.content } : {}),
    },
    expectNoContent: true,
  });
  return { results: { id: input.id, content: input.content || null } };
}

export async function moveTodoistTaskToSection(input: {
  id: string;
  sectionId: string;
}) {
  await directTodoistRequest({
    method: 'POST',
    url: `${TODOIST_API_V1}/tasks/${encodeURIComponent(input.id)}`,
    body: {
      section_id: input.sectionId,
    },
    expectNoContent: true,
  });
  return { results: { id: input.id, section_id: input.sectionId } };
}

export async function toggleTodoistTaskCompletion(input: {
  id: string;
  completed: boolean;
}) {
  if (input.completed) {
    await directTodoistRequest({
      method: 'POST',
      url: `${TODOIST_API_V1}/tasks/${encodeURIComponent(input.id)}/close`,
      expectNoContent: true,
    });
    return { results: { id: input.id, completed: true } };
  }

  await directTodoistRequest({
    method: 'POST',
    url: `${TODOIST_API_V1}/tasks/${encodeURIComponent(input.id)}/reopen`,
    expectNoContent: true,
  });
  return { results: { id: input.id, completed: false } };
}
