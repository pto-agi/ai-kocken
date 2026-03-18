---
name: vercel_deployment
description: How the app is deployed on Vercel — serverless functions, rewrites, env vars, and build process.
---

# Vercel Deployment Skill

## Configuration

- **`vercel.json`**: Configures URL rewrites
  - `/api/:path*` → Vercel serverless functions
  - `/api-proxy/:path*` → Proxies to `generativelanguage.googleapis.com` (Gemini)
  - All other routes → `/index.html` (SPA fallback)
- **No trailing slash**: `"trailingSlash": false`

## Serverless Functions

All files in `api/` are auto-deployed as Vercel serverless functions:

| Endpoint | File | Purpose |
|---|---|---|
| `/api/chat` | `api/chat.ts` | AI chat (OpenAI Agent, SSE) |
| `/api/gemini` | `api/gemini.ts` | Gemini AI proxy |
| `/api/form-notifications` | `api/form-notifications.ts` | Email notifications (Resend) |
| `/api/member-actions` | `api/member-actions.ts` | Membership management |
| `/api/membership-expiry` | `api/membership-expiry.ts` | Expiry checks |
| `/api/order-import` | `api/order-import.ts` | Order imports |
| `/api/chat-conversations` | `api/chat-conversations.ts` | Chat history CRUD |
| `/api/health` | `api/health.ts` | Health check |
| `/api/staff-agenda` | `api/staff-agenda.ts` | Staff agenda |
| `/api/todoist-staff-sync` | `api/todoist-staff-sync.ts` | Todoist sync |

## Build Process

```bash
npm run build    # Runs: vite build
```

- Output: `dist/` directory
- Chunk size warning limit: 1500KB (configured in `vite.config.ts`)
- TypeScript compilation is checked via `npm run typecheck`

## Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables.

**Client-side** (prefixed with `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Server-side** (not exposed to client):
- `OPENAI_API_KEY`, `AGENT_MODEL`
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TODOIST_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID`
- `CHAT_ALLOWED_ORIGINS`
- `RESEND_API_KEY`

## Testing Before Deploy

Always run the full test pipeline before deploying:

```bash
npm run test    # typecheck → lint → unit tests → build
```
