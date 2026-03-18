import { runWorkflowStream } from '../services/agentWorkflow.js';
import { createClient } from '@supabase/supabase-js';
import { readJsonBody, getBearerToken, isAllowedOrigin, setCors } from './_shared/apiHelpers.js';

type UIMessage = {
  id?: string;
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
};

function createRequestId(): string {
  const cryptoObj = (globalThis as any)?.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function setStandardHeaders(res: any, origin: string | undefined, requestId: string) {
  setCors(res, origin);
  res.setHeader('X-Request-Id', requestId);
}

function extractTextParts(message: UIMessage): string[] {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .filter((text) => text.trim().length > 0);
  }

  if (typeof message.content === 'string' && message.content.trim().length > 0) {
    return [message.content];
  }

  return [];
}

function getLatestUserText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const parts = extractTextParts(message);
    if (parts.length) return parts.join('\n');
  }
  return null;
}

// Create a Supabase service-role client for server-side persistence
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Verify Supabase JWT and return user ID
async function verifyUserFromToken(accessToken: string): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data } = await userClient.auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

async function persistMessages(
  userId: string,
  conversationId: string | null,
  userText: string,
  assistantText: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return conversationId;

  try {
    let convId = conversationId;

    // Create conversation if none provided
    if (!convId) {
      const title = userText.slice(0, 60) + (userText.length > 60 ? '…' : '');
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ user_id: userId, title })
        .select('id')
        .single();
      if (error || !data) {
        console.warn('Failed to create conversation', error);
        return null;
      }
      convId = data.id;
    } else {
      // Update timestamp on existing conversation
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);
    }

    // Insert both messages
    const { error } = await supabase.from('chat_messages').insert([
      { conversation_id: convId, role: 'user', content: userText },
      { conversation_id: convId, role: 'assistant', content: assistantText },
    ]);
    if (error) console.warn('Failed to persist messages', error);

    return convId;
  } catch (err) {
    console.warn('Persistence error', err);
    return conversationId;
  }
}

// SSE helper
function sendSSE(res: any, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  const requestId = createRequestId();

  if (!isAllowedOrigin(origin)) {
    setStandardHeaders(res, origin, requestId);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setStandardHeaders(res, origin, requestId);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setStandardHeaders(res, origin, requestId);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    setStandardHeaders(res, origin, requestId);
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    return;
  }

  const body = await readJsonBody(req);
  const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];
  const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : null;
  const accessToken =
    getBearerToken(req.headers?.authorization as string | undefined) ||
    (typeof body?.access_token === 'string' ? body.access_token : undefined);

  const requestMeta = {
    request_id: requestId,
    origin,
    message_count: messages.length,
    hasAccessToken: Boolean(accessToken),
  };

  if (!accessToken) {
    console.warn('Chat stream: missing access token', requestMeta);
    setStandardHeaders(res, origin, requestId);
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  const inputText = getLatestUserText(messages);
  if (!inputText) {
    setStandardHeaders(res, origin, requestId);
    res.status(400).json({ error: 'No valid messages to send' });
    return;
  }

  const startedAt = Date.now();

  // Set up SSE streaming response
  setStandardHeaders(res, origin, requestId);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders?.();

  let fullOutput = '';

  try {
    console.info('Chat stream: running workflow', requestMeta);

    await runWorkflowStream(messages, accessToken, (chunk, done) => {
      fullOutput += chunk;
      sendSSE(res, 'chunk', { text: chunk });
      if (done) {
        sendSSE(res, 'done', { text: '' });
      }
    });

    // Persist messages after successful completion (non-critical – don't break UX if this fails)
    let resultConvId: string | null = conversationId;
    try {
      const userId = await verifyUserFromToken(accessToken);
      if (userId && fullOutput.trim()) {
        resultConvId = await persistMessages(userId, conversationId, inputText, fullOutput);
      }
    } catch (persistErr: any) {
      console.warn('Chat stream: persistence failed (non-critical)', {
        error: persistErr?.message || String(persistErr),
        ...requestMeta,
      });
    }

    // Send final metadata including conversation_id
    sendSSE(res, 'meta', { conversation_id: resultConvId });

    console.info('Chat stream: completed', {
      duration_ms: Date.now() - startedAt,
      conversation_id: resultConvId,
      ...requestMeta,
    });
  } catch (error: any) {
    console.error('Chat stream: workflow error', {
      error: error?.message || String(error),
      stack: error?.stack,
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    sendSSE(res, 'error', {
      message: error?.message || 'Något gick fel. Försök igen.',
    });
  } finally {
    res.end();
  }
}
