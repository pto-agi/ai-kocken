-- Unified agenda reports (replaces staff_reports + staff_handovers)

create extension if not exists "pgcrypto";

create table if not exists public.agenda_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  start_time text,
  end_time text,
  did text,
  handover text,
  completed_tasks text[] not null default '{}'::text[],
  incomplete_tasks text[] not null default '{}'::text[],
  completed_task_ids text[] not null default '{}'::text[],
  incomplete_task_ids text[] not null default '{}'::text[],
  overtime boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agenda_reports_user_id_idx on public.agenda_reports (user_id);
create index if not exists agenda_reports_report_date_idx on public.agenda_reports (report_date);

alter table public.agenda_reports enable row level security;

drop policy if exists "agenda_reports_insert_own" on public.agenda_reports;
create policy "agenda_reports_insert_own" on public.agenda_reports
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "agenda_reports_select_own" on public.agenda_reports;
create policy "agenda_reports_select_own" on public.agenda_reports
  for select
  using (auth.uid() = user_id);

drop policy if exists "agenda_reports_select_staff" on public.agenda_reports;
create policy "agenda_reports_select_staff" on public.agenda_reports
  for select
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  );

drop policy if exists "agenda_reports_update_staff" on public.agenda_reports;
create policy "agenda_reports_update_staff" on public.agenda_reports
  for update
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  );

-- Backfill from staff_reports (run once)
insert into public.agenda_reports (
  user_id,
  report_date,
  start_time,
  end_time,
  did,
  handover,
  completed_tasks,
  incomplete_tasks,
  completed_task_ids,
  incomplete_task_ids,
  overtime,
  created_at
)
select
  user_id,
  report_date,
  start_time,
  end_time,
  did,
  handover,
  completed_tasks,
  incomplete_tasks,
  completed_task_ids,
  incomplete_task_ids,
  overtime,
  created_at
from public.staff_reports sr
where not exists (
  select 1
  from public.agenda_reports ar
  where ar.user_id = sr.user_id
    and ar.report_date = sr.report_date
);

-- Remove old tables
drop table if exists public.staff_handovers;
drop table if exists public.staff_reports;
