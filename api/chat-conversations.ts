import { createClient } from '@supabase/supabase-js';

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

function getBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : undefined;
}

function setCors(res: any, origin: string | undefined) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
}

function getSupabaseForUser(accessToken: string) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    return createClient(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}

export default async function handler(req: any, res: any) {
    const origin = req.headers?.origin as string | undefined;
    setCors(res, origin);

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).end();
        return;
    }

    const accessToken = getBearerToken(req.headers?.authorization as string | undefined);
    if (!accessToken) {
        res.status(401).json({ error: 'Missing access token' });
        return;
    }

    const supabase = getSupabaseForUser(accessToken);
    if (!supabase) {
        res.status(500).json({ error: 'Supabase not configured' });
        return;
    }

    // Verify user
    const { data: authData } = await supabase.auth.getUser(accessToken);
    const userId = authData?.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Invalid access token' });
        return;
    }

    // GET — list conversations or get messages for a specific conversation
    if (req.method === 'GET') {
        const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
        const conversationId = url.searchParams.get('id');

        if (conversationId) {
            // Get messages for a specific conversation
            const { data: messages, error } = await supabase
                .from('chat_messages')
                .select('id, role, content, created_at')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) {
                res.status(500).json({ error: 'Failed to fetch messages' });
                return;
            }
            res.status(200).json({ conversation_id: conversationId, messages: messages || [] });
            return;
        }

        // List conversations (most recent first, max 50)
        const { data: conversations, error } = await supabase
            .from('chat_conversations')
            .select('id, title, created_at, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(50);

        if (error) {
            res.status(500).json({ error: 'Failed to fetch conversations' });
            return;
        }
        res.status(200).json({ conversations: conversations || [] });
        return;
    }

    // POST — create a new conversation
    if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const title = typeof body?.title === 'string' && body.title.trim()
            ? body.title.trim().slice(0, 100)
            : 'Ny chatt';

        const { data, error } = await supabase
            .from('chat_conversations')
            .insert({ user_id: userId, title })
            .select('id, title, created_at, updated_at')
            .single();

        if (error) {
            res.status(500).json({ error: 'Failed to create conversation' });
            return;
        }
        res.status(201).json(data);
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
