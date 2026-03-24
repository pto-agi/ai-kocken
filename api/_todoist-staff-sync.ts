import { createClient } from '@supabase/supabase-js';
import {
  createTodoistTask,
  fetchTodoistSnapshot,
  moveTodoistTaskToSection,
  toggleTodoistTaskCompletion,
  updateTodoistTask,
} from './_todoistMcp.js';
import {
  ARENDEN_PROJECT_FALLBACK,
  extractCanonicalProjectId,
  mergeTodoistTasks,
} from '../utils/todoistMirror.js';

type AuthContext = {
  userId: string;
};

function getEnv(name: string, fallback = ''): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();
  return fallback;
}

function getBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.ACTION_ALLOWED_ORIGINS || process.env.CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

function setCors(res: any, origin: string | undefined) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

async function readJsonBody(req: any): Promise<Record<string, unknown>> {
  if (req?.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  if (req && req.readable) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

async function authenticateStaffManager(req: any): Promise<AuthContext> {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    throw new Error('unauthorized');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    throw new Error('unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_staff, is_manager')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    throw new Error('auth_profile_read_failed');
  }

  if (profile?.is_staff !== true || profile?.is_manager !== true) {
    throw new Error('forbidden');
  }

  return { userId: authData.user.id };
}

function buildProjectIdFromInput(input: unknown): string {
  const provided = typeof input === 'string' ? input.trim() : '';
  const source = provided || process.env.TODOIST_AERENDEN_PROJECT_ID || ARENDEN_PROJECT_FALLBACK;
  return extractCanonicalProjectId(source);
}

function sortMirrorTasks(tasks: ReturnType<typeof mergeTodoistTasks>) {
  return [...tasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return Number(a.is_completed) - Number(b.is_completed);
    }

    if (a.is_completed && b.is_completed) {
      const left = a.completed_at || '';
      const right = b.completed_at || '';
      return right.localeCompare(left);
    }

    return a.content.localeCompare(b.content, 'sv');
  });
}

async function buildSnapshotResponse() {
  const snapshot = await fetchTodoistSnapshot();
  const tasks = sortMirrorTasks(mergeTodoistTasks(snapshot.openTasks, snapshot.completedTasks));
  return {
    project: snapshot.project,
    sections: snapshot.sections,
    tasks,
    synced_at: new Date().toISOString(),
  };
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await authenticateStaffManager(req);
  } catch (error: any) {
    setCors(res, origin);
    if (error?.message === 'forbidden') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const snapshot = await buildSnapshotResponse();
      setCors(res, origin);
      res.status(200).json({ ok: true, ...snapshot });
      return;
    } catch (error: any) {
      console.error('Todoist snapshot failed', error);
      setCors(res, origin);
      res.status(502).json({ error: error?.message || 'Todoist snapshot failed' });
      return;
    }
  }

  const body = await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  try {
    let actionResult: any = null;

    if (action === 'toggle_task_completion') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const completed = Boolean(body.completed);
      if (!id) {
        setCors(res, origin);
        res.status(400).json({ error: 'Missing task id' });
        return;
      }
      actionResult = await toggleTodoistTaskCompletion({ id, completed });
    } else if (action === 'create_task') {
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const sectionId = typeof body.section_id === 'string' ? body.section_id.trim() : '';
      const projectId = buildProjectIdFromInput(body.project_id);
      if (!content || !projectId) {
        setCors(res, origin);
        res.status(400).json({ error: 'Missing content or project id' });
        return;
      }
      actionResult = await createTodoistTask({
        projectId,
        content,
        sectionId: sectionId || null,
      });
    } else if (action === 'update_task') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!id || !content) {
        setCors(res, origin);
        res.status(400).json({ error: 'Missing task id or content' });
        return;
      }
      actionResult = await updateTodoistTask({ id, content });
    } else if (action === 'move_task_to_section') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const sectionId = typeof body.section_id === 'string' ? body.section_id.trim() : '';
      if (!id || !sectionId) {
        setCors(res, origin);
        res.status(400).json({ error: 'Missing task id or section id' });
        return;
      }
      actionResult = await moveTodoistTaskToSection({ id, sectionId });
    } else if (action === 'refresh') {
      actionResult = null;
    } else {
      setCors(res, origin);
      res.status(400).json({ error: 'Unsupported action' });
      return;
    }

    const includeSnapshot = body.include_snapshot !== false;
    const snapshot = includeSnapshot ? await buildSnapshotResponse() : null;

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      action,
      result: actionResult?.results ?? null,
      ...(snapshot || {}),
    });
  } catch (error: any) {
    console.error('Todoist action failed', { action, error: error?.message || String(error) });
    setCors(res, origin);
    res.status(502).json({ error: error?.message || 'Todoist action failed' });
  }
}
