---
name: supabase_database
description: How to work with the Supabase database — migrations, RLS, queries, edge functions, and the MCP server.
---

# Supabase Database Skill

## Connection

- **Client-side**: Uses `lib/supabase.ts` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- **Server-side**: Uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations (bypasses RLS).
- **MCP Server**: The `supabase-mcp-server` is available for direct DB operations via tools like `execute_sql`, `apply_migration`, `list_tables`, etc.

## Working with Migrations

Migration SQL files live in `supabase/`. When making schema changes:

1. **Always use `apply_migration`** MCP tool for DDL changes (CREATE TABLE, ALTER, etc.).
2. **Use `execute_sql`** MCP tool for data queries and DML (SELECT, INSERT, etc.).
3. Name migrations in `snake_case`, e.g. `add_referral_tracking`.
4. Check for security advisories after DDL changes: use `get_advisors` with type `security`.

## Key Tables (Known)

- `profiles` – User profiles (linked to Supabase Auth `auth.users`)
- `chat_conversations` – Chat sessions with `user_id`, `title`, timestamps
- `chat_messages` – Individual messages with `conversation_id`, `role`, `content`
- `staff_faq` – FAQ entries for staff/agent
- Various form/notification tables

## RLS (Row Level Security)

- Always enable RLS on new tables.
- Typical policy pattern: `auth.uid() = user_id` for user-owned data.
- Service-role key bypasses RLS for server-side operations.

## Edge Functions

- Deploy via `deploy_edge_function` MCP tool.
- Always enable JWT verification unless custom auth is implemented.
- Use `list_edge_functions` to see existing functions.

## Common Operations

```sql
-- List all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

## Environment Variables

| Variable | Context | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Public anon key |
| `SUPABASE_URL` | Server | Same URL for server-side |
| `SUPABASE_ANON_KEY` | Server | Anon key for server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin key (bypasses RLS) |
