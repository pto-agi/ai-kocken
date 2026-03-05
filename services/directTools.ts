/**
 * Direct API tools for the PTO Agent.
 * Replaces Zapier MCP and custom Render MCP with direct calls to:
 *  - Todoist REST API v2
 *  - Google Sheets API v4 (service account)
 *  - Supabase (user profile)
 */

import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

// ─── Todoist Direct API ──────────────────────────────────────────

const TODOIST_REST_V2 = 'https://api.todoist.com/rest/v2';

function getTodoistToken(): string {
    const token = (process.env.TODOIST_API_KEY || '').trim();
    if (!token) throw new Error('Missing TODOIST_API_KEY');
    return token;
}

async function todoistRequest<T = any>(input: {
    url: string;
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    expectNoContent?: boolean;
}): Promise<T> {
    const token = getTodoistToken();
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
        throw new Error(`Todoist API error (${response.status}): ${text || response.statusText}`);
    }

    if (input.expectNoContent || response.status === 204) return {} as T;
    return (await response.json()) as T;
}

/** Create a task in a Todoist project */
export async function todoistCreateTask(input: {
    projectId: string;
    content: string;
    description?: string;
    sectionId?: string | null;
}): Promise<string> {
    const result = await todoistRequest<Record<string, unknown>>({
        method: 'POST',
        url: `${TODOIST_REST_V2}/tasks`,
        body: {
            project_id: input.projectId,
            content: input.content,
            ...(input.description ? { description: input.description } : {}),
            ...(input.sectionId ? { section_id: input.sectionId } : {}),
        },
    });
    return JSON.stringify({
        ok: true,
        task_id: result.id,
        content: result.content,
        project_id: result.project_id,
        url: result.url,
    });
}

/** Find a project by name */
export async function todoistFindProject(name: string): Promise<string> {
    const projects = await todoistRequest<Array<Record<string, unknown>>>({
        url: `${TODOIST_REST_V2}/projects`,
    });
    const match = projects.find(
        (p) => (p.name as string || '').toLowerCase().trim() === name.toLowerCase().trim(),
    );
    if (!match) return JSON.stringify({ ok: false, error: `Project "${name}" not found` });
    return JSON.stringify({ ok: true, id: match.id, name: match.name });
}

/** Find tasks in a project (optionally filtered by content) */
export async function todoistFindTask(input: {
    projectId?: string;
    query?: string;
}): Promise<string> {
    let url = `${TODOIST_REST_V2}/tasks`;
    if (input.projectId) url += `?project_id=${encodeURIComponent(input.projectId)}`;
    const tasks = await todoistRequest<Array<Record<string, unknown>>>({ url });
    let filtered = tasks;
    if (input.query) {
        const q = input.query.toLowerCase();
        filtered = tasks.filter((t) => (t.content as string || '').toLowerCase().includes(q));
    }
    const summary = filtered.slice(0, 20).map((t) => ({
        id: t.id,
        content: t.content,
        section_id: t.section_id,
        due: (t.due as any)?.date || null,
        url: t.url,
    }));
    return JSON.stringify({ ok: true, count: filtered.length, tasks: summary });
}

/** Add a comment to a task */
export async function todoistAddComment(taskId: string, content: string): Promise<string> {
    const result = await todoistRequest<Record<string, unknown>>({
        method: 'POST',
        url: `${TODOIST_REST_V2}/comments`,
        body: { task_id: taskId, content },
    });
    return JSON.stringify({ ok: true, comment_id: result.id });
}

// ─── Google Sheets Direct API ────────────────────────────────────

async function getSheetsToken(): Promise<string> {
    const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
    const keyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
    if (!email || !keyRaw) throw new Error('Missing Google service account credentials');
    const key = keyRaw.replace(/\\n/g, '\n');
    const auth = new JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const tokenResponse = await auth.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    if (!token) throw new Error('Failed to get Google Sheets access token');
    return token;
}

/** Get rows from a worksheet. Returns header + data rows. */
export async function sheetsGetWorksheetData(input: {
    sheetId: string;
    worksheetName: string;
    range?: string;
}): Promise<string> {
    const token = await getSheetsToken();
    const rangeParam = input.range
        ? `${encodeURIComponent(input.worksheetName)}!${input.range}`
        : encodeURIComponent(input.worksheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.sheetId}/values/${rangeParam}?majorDimension=ROWS`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Sheets API error (${response.status}): ${text}`);
    }
    const data = await response.json();
    const values: string[][] = Array.isArray(data?.values) ? data.values : [];
    if (values.length === 0) return JSON.stringify({ ok: true, rows: [], headers: [] });
    const [headers, ...rows] = values;
    return JSON.stringify({ ok: true, headers, row_count: rows.length, rows: rows.slice(0, 100) });
}

/** Lookup a row by email in a worksheet */
export async function sheetsLookupByEmail(input: {
    sheetId: string;
    worksheetName: string;
    email: string;
    columnsToReturn?: string[];
}): Promise<string> {
    const token = await getSheetsToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.sheetId}/values/${encodeURIComponent(input.worksheetName)}?majorDimension=ROWS`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Sheets API error (${response.status}): ${text}`);
    }
    const data = await response.json();
    const values: string[][] = Array.isArray(data?.values) ? data.values : [];
    if (values.length < 2) return JSON.stringify({ ok: true, found: false });

    const [headers, ...rows] = values;
    const normalizeKey = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const emailIndex = headers.findIndex((h) => normalizeKey(h) === 'epost' || normalizeKey(h) === 'email');
    if (emailIndex === -1) return JSON.stringify({ ok: false, error: 'No email column found', headers });

    const target = input.email.toLowerCase().trim();
    for (const row of rows) {
        const rowEmail = (row[emailIndex] || '').toString().trim().toLowerCase();
        if (rowEmail !== target) continue;

        const result: Record<string, string> = {};
        headers.forEach((h, i) => {
            if (!input.columnsToReturn || input.columnsToReturn.length === 0 || input.columnsToReturn.includes(h)) {
                result[h] = row[i] || '';
            }
        });
        return JSON.stringify({ ok: true, found: true, data: result });
    }

    return JSON.stringify({ ok: true, found: false });
}

/** Get spreadsheet metadata (worksheets list) */
export async function sheetsGetSpreadsheetInfo(sheetId: string): Promise<string> {
    const token = await getSheetsToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error(`Sheets API error (${response.status})`);
    }
    const data = await response.json();
    const sheets = (data?.sheets || []).map((s: any) => ({
        title: s?.properties?.title,
        index: s?.properties?.index,
        rowCount: s?.properties?.gridProperties?.rowCount,
    }));
    return JSON.stringify({
        ok: true,
        title: data?.properties?.title,
        worksheets: sheets,
    });
}

// ─── Supabase Profile (replaces Render MCP) ──────────────────────

export async function getProfileDirect(accessToken: string): Promise<Record<string, any> | null> {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey || !accessToken) return null;

    const supabase = createClient(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: authData } = await supabase.auth.getUser(accessToken);
    if (!authData?.user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    return profile
        ? {
            ...profile,
            email: authData.user.email || profile.email,
            user_id: authData.user.id,
        }
        : null;
}
