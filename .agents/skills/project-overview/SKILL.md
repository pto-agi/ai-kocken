---
name: project_overview
description: Full architecture overview of the PTO AI App — tech stack, file structure, conventions, and deployment.
---

# PTO AI App – Project Overview

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, TailwindCSS 3 |
| State | Zustand (`store/authStore.ts`) |
| Routing | react-router-dom v7 |
| Backend API | Vercel Serverless Functions (`api/` directory) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, magic link) |
| AI – Chat Agent | OpenAI Agents SDK (`@openai/agents`, model: `gpt-5-mini`) with `@openai/guardrails` |
| AI – Meal Planning | Google Gemini (`@google/genai`) via `/api/gemini` proxy |
| Integrations | Todoist API v1, Google Sheets API v4, Stripe (payments) |
| Testing | Vitest (43 unit tests in `tests/`) |
| Linting | ESLint + typescript-eslint |
| Deployment | Vercel (`vercel.json` with SPA rewrites) |

## Directory Structure

```
├── api/                   # Vercel serverless functions
│   ├── chat.ts            # SSE chat endpoint (OpenAI Agent)
│   ├── gemini.ts          # Gemini proxy endpoint
│   ├── form-notifications.ts  # Resend email notifications
│   ├── member-actions.ts  # Membership management APIs
│   └── ...
├── components/            # Shared React components
│   ├── SupportChat.tsx    # Chat widget (SSE streaming)
│   ├── AuthScreen.tsx     # Login/signup
│   ├── WeeklyPlanner.tsx  # Meal planner UI
│   ├── Navbar.tsx         # Navigation
│   └── ...
├── pages/                 # Route pages
│   ├── Home.tsx
│   ├── Intranet.tsx       # Staff dashboard (191KB)
│   ├── IntranetManager.tsx # Manager dashboard (155KB)
│   ├── Profile.tsx        # User profile (69KB)
│   ├── Start.tsx          # Onboarding form (49KB)
│   └── ...
├── services/              # Core business logic
│   ├── agentWorkflow.ts   # OpenAI Agent orchestration
│   ├── geminiService.ts   # Gemini meal generation
│   ├── directTools.ts     # Todoist + Sheets + Supabase tools
│   └── databaseService.ts # Database helpers
├── lib/                   # Shared config
│   ├── supabase.ts        # Supabase client
│   ├── env.ts             # Env var helpers
│   └── queryClient.ts     # TanStack React Query
├── store/
│   └── authStore.ts       # Zustand auth state
├── utils/                 # 35 utility modules
├── tests/                 # 43 unit test files
├── supabase/              # SQL migration files
├── scripts/               # Automation scripts
├── data/                  # Static data files
└── docs/                  # Documentation
```

## Key Conventions

1. **Language**: Swedish for user-facing text, English for code/comments.
2. **API routes**: All under `api/`, auto-deployed as Vercel serverless functions.
3. **Env vars**: Prefixed with `VITE_` for client-side, unprefixed for server-side.
4. **Testing**: `npm run test` = typecheck → lint → unit tests → build.
5. **Imports**: Use `@/` alias mapped to project root.
6. **State**: Zustand for global auth state. React Query for server state.

## Running Locally

```bash
npm run dev        # Vite dev server
npm run test:unit  # Unit tests only
npm run test       # Full test pipeline
npm run build      # Production build
```
