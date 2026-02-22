const FETCH_TIMEOUT_MS = 15_000;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcp-0brh.onrender.com/mcp';
const MCP_SERVER_LABEL = process.env.MCP_SERVER_LABEL || 'supabase_mcp';
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';
const MCP_ALLOWED_TOOLS = [
  'get_profile',
  'get_start_intake_latest',
  'get_followup_latest',
  'get_weekly_plans',
  'save_weekly_plan',
];
const SYSTEM_INSTRUCTIONS = [
  'Du är en supportagent i vår app.',
  'Du har tillgång till användarens data via MCP-verktyg.',
  'När användaren frågar efter profil- eller kontouppgifter (t.ex. e-post, namn, medlemskap),',
  'ska du använda verktygen (t.ex. get_profile) för att hämta uppgifterna och svara direkt.',
  'Fråga inte om extra tillstånd om du kan hämta data via MCP.',
].join(' ');

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

function buildOpenAIInput(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const parts = extractTextParts(message);
      if (!parts.length) return null;
      return {
        role: message.role || 'user',
        content: parts.join('\n'),
      };
    })
    .filter(Boolean);
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
    model: OPENAI_MODEL,
  };

  if (!accessToken) {
    console.warn('Chat stream: missing access token', requestMeta);
    setCors(res, origin);
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  const input = buildOpenAIInput(messages);
  if (!input.length) {
    setCors(res, origin);
    res.status(400).json({ error: 'No valid messages to send' });
    return;
  }

  const tools = [
    {
      type: 'mcp',
      server_label: MCP_SERVER_LABEL,
      server_url: MCP_SERVER_URL,
      allowed_tools: MCP_ALLOWED_TOOLS,
      headers: { Authorization: `Bearer ${accessToken}` },
      require_approval: 'never',
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  req.on('close', () => controller.abort());

  let upstream: Response;
  try {
    console.info('Chat stream: sending request', {
      ...requestMeta,
      mcp_server_label: MCP_SERVER_LABEL,
      mcp_server_url: MCP_SERVER_URL,
    });

    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        tools,
        tool_choice: 'auto',
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeout);
    const isAbort = error instanceof Error && error.name === 'AbortError';
    console.error('Chat stream: upstream request failed', {
      error: error?.message || String(error),
      isAbort,
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    setCors(res, origin);
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? 'Upstream timeout' : 'Upstream request failed' });
    return;
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => '');
    const requestId = upstream.headers.get('x-request-id') || undefined;
    console.error('Chat stream: upstream error', {
      status: upstream.status,
      requestId,
      error: errorText || 'Upstream error',
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
    setCors(res, origin);
    res.status(upstream.status).json({
      error: errorText || 'Upstream error',
      request_id: requestId,
    });
    return;
  }

  const requestId = upstream.headers.get('x-request-id') || undefined;
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  } as Record<string, string>;

  setCors(res, origin);
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines = chunk
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''));

        if (!dataLines.length) {
          boundary = buffer.indexOf('\n\n');
          continue;
        }

        const data = dataLines.join('\n');
        if (data === '[DONE]') {
          boundary = buffer.indexOf('\n\n');
          continue;
        }

        let event: any;
        try {
          event = JSON.parse(data);
        } catch (error) {
          console.warn('Chat stream: failed to parse upstream event', { data });
          boundary = buffer.indexOf('\n\n');
          continue;
        }

        if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          res.write(event.delta);
        }

        if (event?.type === 'response.failed') {
          console.error('Chat stream: response failed', {
            error: event?.error?.message || event?.error || 'Unknown error',
          });
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error: any) {
    console.error('Chat stream: streaming error', {
      error: error?.message || String(error),
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
  } finally {
    res.end();
    console.info('Chat stream: completed', {
      requestId,
      duration_ms: Date.now() - startedAt,
      ...requestMeta,
    });
  }
}
