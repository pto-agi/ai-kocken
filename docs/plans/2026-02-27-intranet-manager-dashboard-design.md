# Intranet Manager Dashboard (Design)

Date: 2026-02-27

## Summary
Add a manager-only intranet dashboard at `/intranet/manager` that provides operational oversight across staff: weekly pace, completion trends, report coverage, and individual drilldowns. Introduce a `profiles.is_manager` flag for access control. Keep staff UX intact. Add manager coaching notes and track task completion timestamps to flag deviations and slow flow.

## Goals
- Give managers a fast, reliable view of operational flow and deviations.
- Show weekly pace and individual drilldowns (completion, reports, handover signals).
- Allow managers to correct task completion and add coaching notes.
- Capture per-task completion timestamps to detect slow or late completion.
- Preserve existing staff intranet experience.

## Non-Goals
- Redesign the staff intranet UI.
- Change task templates or schedule logic.
- Replace existing agenda storage immediately (migrate progressively).

## Current State (Observed)
- Agenda tasks are generated from `agenda_templates` and displayed in `/intranet`.
- Task completion is stored per user and date in `agenda_completions` (array of task ids).
- Reports are stored in `agenda_reports` and the UI reads only the signed-in user's data.
- Checklist gating is local and not persisted per sub-item.
- `agenda_completions` definition is not present in repo SQL; it likely exists in Supabase already.

## Proposed Architecture
- Add a new route: `/intranet/manager`.
- Add `profiles.is_manager` boolean.
- Add RLS policies to allow managers to read all staff agenda/report data.
- Introduce manager coaching notes with a dedicated table.
- Add completion timestamp tracking per task to support delay/deviation detection.

## Data Model Changes

### 1) `profiles.is_manager`
- Boolean column in `profiles`.
- Used by AuthGuard and RLS to grant manager access.

### 2) Completion timestamps
Current storage uses `agenda_completions` with `completed_task_ids` array. To measure delays per task, we need a timestamp per task completion. Two compatible options:

Option A (recommended): new table `agenda_completion_items`
- One row per task completion event.
- Allows timestamps, who completed, and manager overrides.

Option B: extend `agenda_completions` with JSON
- Add `completed_task_times` jsonb with task_id -> ISO timestamp.
- Less queryable, harder to aggregate at scale.

Recommendation: Option A, while continuing to write `agenda_completions` for compatibility and summary display. Staff UI can stay unchanged initially.

### 3) Manager coaching notes
- New table `agenda_manager_notes` with notes per user and date (and optional task).

## Manager Dashboard UX

### Main dashboard
- Week summary cards: completion rate, reports submitted, handover count.
- Deviation tiles: missing reports, incomplete days, late completions.
- Trends: completion per person (week), report frequency.

### Individual drilldown
- Per-user weekly timeline with:
  - Agenda tasks and completion status.
  - Completion timestamps.
  - Report (did/handover).
  - Manager notes.
- Manager can toggle a task completion for a specific user/day.

## Operational Signals (Examples)
- Late completion: task completed after end of workday or after report end_time.
- Slow day: completion time > estimated_minutes baseline per template.
- Missing report: no `agenda_reports` for a day with tasks.
- Incomplete past day: previous dates with open tasks.

Note: Without explicit per-task start times, delays are estimated by comparing `completed_at` with report start_time or day start. This is approximate but directionally useful.

## RLS / Access Control
- Staff can read/write only their own completions and reports.
- Managers can read all staff data; managers can update completions.
- Notes are manager-only unless explicitly shared.

## SQL Baseline (If Needed)
These are safe "create if not exists" templates if `agenda_completions` and the new tables are missing in Supabase. Review existing definitions before applying.

```sql
-- 1) profiles.is_manager
alter table public.profiles add column if not exists is_manager boolean not null default false;

-- 2) agenda_completions (if missing)
create table if not exists public.agenda_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  completed_task_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (user_id, report_date)
);
create index if not exists agenda_completions_user_id_idx on public.agenda_completions (user_id);
create index if not exists agenda_completions_report_date_idx on public.agenda_completions (report_date);
alter table public.agenda_completions enable row level security;

-- Staff can read/write own completions
create policy if not exists agenda_completions_select_own on public.agenda_completions
  for select using (auth.uid() = user_id);
create policy if not exists agenda_completions_upsert_own on public.agenda_completions
  for insert with check (auth.uid() = user_id);
create policy if not exists agenda_completions_update_own on public.agenda_completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Managers can read/update all
create policy if not exists agenda_completions_select_manager on public.agenda_completions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
create policy if not exists agenda_completions_update_manager on public.agenda_completions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

-- 3) agenda_completion_items (recommended)
create table if not exists public.agenda_completion_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  task_id text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid not null references auth.users(id),
  source text not null default 'staff', -- 'staff' or 'manager'
  primary key (user_id, report_date, task_id)
);
create index if not exists agenda_completion_items_user_id_idx on public.agenda_completion_items (user_id);
create index if not exists agenda_completion_items_report_date_idx on public.agenda_completion_items (report_date);
create index if not exists agenda_completion_items_task_id_idx on public.agenda_completion_items (task_id);
alter table public.agenda_completion_items enable row level security;

create policy if not exists agenda_completion_items_select_own on public.agenda_completion_items
  for select using (auth.uid() = user_id);
create policy if not exists agenda_completion_items_insert_own on public.agenda_completion_items
  for insert with check (auth.uid() = user_id and auth.uid() = completed_by);
create policy if not exists agenda_completion_items_update_own on public.agenda_completion_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists agenda_completion_items_select_manager on public.agenda_completion_items
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
create policy if not exists agenda_completion_items_update_manager on public.agenda_completion_items
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

-- 4) agenda_manager_notes
create table if not exists public.agenda_manager_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  task_id text,
  note text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists agenda_manager_notes_user_id_idx on public.agenda_manager_notes (user_id);
create index if not exists agenda_manager_notes_report_date_idx on public.agenda_manager_notes (report_date);
alter table public.agenda_manager_notes enable row level security;

create policy if not exists agenda_manager_notes_select_manager on public.agenda_manager_notes
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
create policy if not exists agenda_manager_notes_insert_manager on public.agenda_manager_notes
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
```

## Data Flow (Manager)
- Load staff list, templates, completions, and reports for a week range.
- Compute completion rate per person and deviations.
- Drilldown per person to render day-by-day status with timestamps and report text.

## Error Handling
- If Supabase is not configured: show empty state in manager view.
- If any manager fetch fails: display readable errors per section.

## Testing
- Staff completion appears in manager view in real-time or on refresh.
- Manager override updates are visible to staff.
- Manager notes saved and visible in manager view.
- RLS: staff cannot read other users data; manager can.

## Rollout
- Add DB changes first (profiles.is_manager, completion items, notes).
- Deploy manager UI behind is_manager check.
- Optional: backfill completion items from existing completions (best-effort for timestamps).
