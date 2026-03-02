import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  ARENDEN_PROJECT_FALLBACK,
  extractCanonicalProjectId,
  parseMcpToolTextPayload,
  type TodoistCompletedTask,
  type TodoistOpenTask,
} from '../utils/todoistMirror.js';

const DEFAULT_ZAPIER_MCP_URL = 'https://mcp.zapier.com/api/mcp/mcp';
const DEFAULT_ZAPIER_MCP_AUTH =
  'MTIyN2ZhYjItOTY2YS00YzM1LTk2NWQtYTIzYTI5YmE2MDg3Om5DOHFSVExHSDBEMmxNOVl6eDBUaVZnVWpDT1V4eTN0eHVtVFl3WTVqTkk9';

type CallToolParsedResponse = {
  isError?: boolean;
  error?: string;
  results?: unknown;
  followUpQuestion?: string;
};

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

function normalizeMcpAuthorization(rawValue: string): string {
  const token = String(rawValue || '').trim();
  if (!token) return '';
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function getZapierMcpSettings() {
  const serverUrl = (process.env.ZAPIER_MCP_SERVER_URL || DEFAULT_ZAPIER_MCP_URL).trim();
  const rawAuth =
    process.env.ZAPIER_MCP_AUTHORIZATION ||
    process.env.ZAPIER_MCP_AUTH ||
    DEFAULT_ZAPIER_MCP_AUTH;
  const authorization = normalizeMcpAuthorization(rawAuth);
  if (!authorization) {
    throw new Error('Missing Zapier MCP authorization');
  }
  return { serverUrl, authorization };
}

async function withTodoistClient<T>(handler: (client: Client) => Promise<T>): Promise<T> {
  const { serverUrl, authorization } = getZapierMcpSettings();
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: authorization,
      },
    },
  });
  const client = new Client({ name: 'ptoai-todoist-sync', version: '1.0.0' });
  try {
    await client.connect(transport);
    return await handler(client);
  } finally {
    await transport.close().catch(() => undefined);
  }
}

function readTextContent(callResult: any): string {
  const textPart = callResult?.content?.find((item: any) => item?.type === 'text');
  if (!textPart || typeof textPart.text !== 'string') {
    throw new Error('Todoist MCP response missing text payload');
  }
  return textPart.text;
}

function parseCallPayload(payloadText: string): CallToolParsedResponse {
  const parsed = parseMcpToolTextPayload(payloadText) as CallToolParsedResponse;
  if (parsed?.isError) {
    throw new Error(parsed.error || 'Todoist MCP tool call failed');
  }
  if (parsed?.followUpQuestion) {
    throw new Error(parsed.followUpQuestion);
  }
  return parsed;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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

async function callTodoistTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolParsedResponse> {
  const callResult = await client.request(
    {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
    CallToolResultSchema
  );

  const payloadText = readTextContent(callResult);
  return parseCallPayload(payloadText);
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

function normalizeOpenTasks(results: unknown): TodoistOpenTask[] {
  return toArray<Record<string, unknown>>(results).map((task) => ({
    task_id: asString(task.task_id),
    content: asString(task.content),
    project_id: asString(task.project_id),
    section_id: asNullableString(task.section_id),
    is_completed: Boolean(task.is_completed),
    description: asNullableString(task.description),
    priority: asNullableNumber(task.priority),
    due: asNullableString(task.due),
    created_at: asNullableString(task.created_at),
    url: asNullableString(task.url),
  }));
}

function normalizeCompletedTasks(results: unknown): TodoistCompletedTask[] {
  return toArray<Record<string, unknown>>(results)
    .map((task) => ({
      task_id: asString(task.task_id),
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

export async function fetchTodoistSnapshot() {
  return withTodoistClient(async (client) => {
    const projectResponse = await callTodoistTool(client, 'todoist_find_project', {
      instructions: 'Fetch Todoist project metadata for staff intranet sync.',
      name: 'Ärenden',
      output_hint: 'Return id, name, color and is_favorite.',
    });

    const projectResults = (projectResponse.results || {}) as Record<string, unknown>;
    const rawProjectId =
      asString(projectResults.id) ||
      extractCanonicalProjectId(process.env.TODOIST_AERENDEN_PROJECT_ID || ARENDEN_PROJECT_FALLBACK);
    const projectId = extractCanonicalProjectId(rawProjectId);
    if (!projectId) {
      throw new Error('Missing Todoist project id for Ärenden');
    }

    const project: TodoistProject = {
      id: projectId,
      name: asString(projectResults.name) || 'Ärenden',
      color: asNullableString(projectResults.color),
      is_favorite: Boolean(projectResults.is_favorite),
    };

    const { since, until } = computeCompletionWindow();
    const [sectionsResponse, openTasksResponse, completedTasksResponse] = await Promise.all([
      callTodoistTool(client, 'todoist_api_request_beta', {
        instructions: 'Fetch all sections for Todoist project mirror.',
        method: 'GET',
        url: 'https://api.todoist.com/api/v1/sections',
        querystring: `project_id=${projectId}`,
        output_hint: 'Return id and name for each section.',
      }),
      callTodoistTool(client, 'todoist_api_request_beta', {
        instructions: 'Fetch all open tasks for Todoist project mirror.',
        method: 'GET',
        url: 'https://api.todoist.com/api/v1/tasks',
        querystring: `project_id=${projectId}`,
        output_hint:
          'Return task_id, content, description, project_id, section_id, is_completed, priority, due, created_at and url.',
      }),
      callTodoistTool(client, 'todoist_api_request_beta', {
        instructions: 'Fetch completed tasks for Todoist project mirror.',
        method: 'GET',
        url: 'https://api.todoist.com/api/v1/tasks/completed/by_completion_date',
        querystring: `project_id=${projectId}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
        output_hint: 'Return task_id, content, project_id, section_id and completed_at.',
      }),
    ]);

    return {
      project,
      sections: normalizeSections(sectionsResponse.results),
      openTasks: normalizeOpenTasks(openTasksResponse.results),
      completedTasks: normalizeCompletedTasks(completedTasksResponse.results),
    };
  });
}

export async function createTodoistTask(input: {
  projectId: string;
  content: string;
  sectionId?: string | null;
}) {
  return withTodoistClient(async (client) => {
    return callTodoistTool(client, 'todoist_create_task', {
      instructions: 'Create a Todoist task from staff intranet dashboard.',
      project_id: input.projectId,
      content: input.content,
      section_id: input.sectionId || undefined,
      output_hint: 'Return created task id, content, project_id and section_id.',
    });
  });
}

export async function updateTodoistTask(input: {
  id: string;
  content?: string;
}) {
  return withTodoistClient(async (client) => {
    return callTodoistTool(client, 'todoist_update_task', {
      instructions: 'Update a Todoist task from staff intranet dashboard.',
      id: input.id,
      content: input.content,
      output_hint: 'Return updated task id and content.',
    });
  });
}

export async function moveTodoistTaskToSection(input: {
  id: string;
  sectionId: string;
}) {
  return withTodoistClient(async (client) => {
    return callTodoistTool(client, 'todoist_move_task_to_section', {
      instructions: 'Move task to another Todoist section from staff intranet dashboard.',
      id: input.id,
      section_id: input.sectionId,
      output_hint: 'Return moved task id and section id.',
    });
  });
}

export async function toggleTodoistTaskCompletion(input: {
  id: string;
  completed: boolean;
}) {
  return withTodoistClient(async (client) => {
    if (input.completed) {
      return callTodoistTool(client, 'todoist_mark_task_as_completed', {
        instructions: 'Mark task as completed from staff intranet dashboard.',
        id: input.id,
        output_hint: 'Return task id and completion status.',
      });
    }

    return callTodoistTool(client, 'todoist_api_request_beta', {
      instructions: 'Reopen completed task from staff intranet dashboard.',
      method: 'POST',
      url: `https://api.todoist.com/api/v1/tasks/${input.id}/reopen`,
      output_hint: 'Return response status.',
    });
  });
}
