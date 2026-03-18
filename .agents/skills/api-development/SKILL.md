---
name: api_development
description: How to create and modify Vercel serverless API endpoints — patterns, auth, CORS, and SSE streaming.
---

# API Development Skill

## File Convention

Every file in `api/` becomes a Vercel serverless function at `/api/[filename]`.

```
api/chat.ts         → /api/chat
api/gemini.ts       → /api/gemini
api/health.ts       → /api/health
```

## Handler Pattern

```typescript
export default async function handler(req: any, res: any) {
  // 1. CORS
  if (req.method === 'OPTIONS') {
    setCors(res, req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 3. Auth (Bearer token → Supabase)
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  // 4. Business logic
  const body = await readJsonBody(req);
  // ... process ...

  // 5. Response
  res.status(200).json({ ok: true, data: result });
}
```

## Authentication

Two patterns used:

1. **Bearer token**: Extract from `Authorization: Bearer <token>`, verify via Supabase `auth.getUser(token)`
2. **Service role**: Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations

```typescript
function getBearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
```

## SSE Streaming Pattern (from chat.ts)

```typescript
// Set SSE headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache, no-transform');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');
res.status(200);
res.flushHeaders?.();

// Send events
function sendSSE(res: any, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Events: 'chunk', 'done', 'meta', 'error'
```

## CORS

```typescript
function setCors(res: any, origin: string | undefined) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}
```

Allowed origins configured via `CHAT_ALLOWED_ORIGINS` env var (comma-separated).

## Error Handling

Always return structured JSON errors with appropriate status codes. Log errors server-side with context.
