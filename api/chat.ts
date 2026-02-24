import { runWorkflow } from '../services/agentWorkflow.js';

type UIMessage = {
  id?: string;
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
};

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

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.CHAT_ALLOWED_ORIGINS || process.env.CHATKIT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

function setCors(res: any, origin: string | undefined) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
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

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    setCors(res, origin);
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    return;
  }

  const body = await readJsonBody(req);
  const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : [];
  const accessToken =
    getBearerToken(req.headers?.authorization as string | undefined) ||
    (typeof body?.access_token === 'string' ? body.access_token : undefined);

  const requestMeta = {
    origin,
    message_count: messages.length,
    hasAccessToken: Boolean(accessToken),
  };

  if (!accessToken) {
    console.warn('Chat stream: missing access token', requestMeta);
    setCors(res, origin);
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  const inputText = getLatestUserText(messages);
  if (!inputText) {
    setCors(res, origin);
    res.status(400).json({ error: 'No valid messages to send' });
    return;
  }

  const startedAt = Date.now();

  try {
    console.info('Chat stream: running workflow', {
      ...requestMeta,
      workflow_id: 'wf_698f3221c2a481909c391387fd6efe8e0a3f823293ebb086',
    });
    const result = await runWorkflow(messages, accessToken);
    const outputText =
      typeof result?.output_text === 'string' && result.output_text.trim().length > 0
        ? result.output_text
        : JSON.stringify(result ?? {});

    setCors(res, origin);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(outputText);
    console.info('Chat stream: completed', {
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
  } catch (error: any) {
    console.error('Chat stream: workflow error', {
      error: error?.message || String(error),
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    setCors(res, origin);
    res.status(502).json({ error: 'Workflow run failed' });
  }
}
