-- manager role flag
alter table public.profiles add column if not exists is_manager boolean not null default false;

-- agenda_completions baseline (if missing)
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

-- policies (drop + create to avoid IF NOT EXISTS syntax error)
drop policy if exists agenda_completions_select_own on public.agenda_completions;
create policy agenda_completions_select_own on public.agenda_completions
  for select using (auth.uid() = user_id);

drop policy if exists agenda_completions_insert_own on public.agenda_completions;
create policy agenda_completions_insert_own on public.agenda_completions
  for insert with check (auth.uid() = user_id);

drop policy if exists agenda_completions_update_own on public.agenda_completions;
create policy agenda_completions_update_own on public.agenda_completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists agenda_completions_select_manager on public.agenda_completions;
create policy agenda_completions_select_manager on public.agenda_completions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

drop policy if exists agenda_completions_update_manager on public.agenda_completions;
create policy agenda_completions_update_manager on public.agenda_completions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

-- completion items with timestamps
create table if not exists public.agenda_completion_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  task_id text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid not null references auth.users(id),
  source text not null default 'staff',
  primary key (user_id, report_date, task_id)
);
create index if not exists agenda_completion_items_user_id_idx on public.agenda_completion_items (user_id);
create index if not exists agenda_completion_items_report_date_idx on public.agenda_completion_items (report_date);
create index if not exists agenda_completion_items_task_id_idx on public.agenda_completion_items (task_id);
alter table public.agenda_completion_items enable row level security;

drop policy if exists agenda_completion_items_select_own on public.agenda_completion_items;
create policy agenda_completion_items_select_own on public.agenda_completion_items
  for select using (auth.uid() = user_id);

drop policy if exists agenda_completion_items_insert_own on public.agenda_completion_items;
create policy agenda_completion_items_insert_own on public.agenda_completion_items
  for insert with check (auth.uid() = user_id and auth.uid() = completed_by);

drop policy if exists agenda_completion_items_update_own on public.agenda_completion_items;
create policy agenda_completion_items_update_own on public.agenda_completion_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists agenda_completion_items_select_manager on public.agenda_completion_items;
create policy agenda_completion_items_select_manager on public.agenda_completion_items
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

drop policy if exists agenda_completion_items_update_manager on public.agenda_completion_items;
create policy agenda_completion_items_update_manager on public.agenda_completion_items
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

-- manager notes
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

drop policy if exists agenda_manager_notes_select_manager on public.agenda_manager_notes;
create policy agenda_manager_notes_select_manager on public.agenda_manager_notes
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );

drop policy if exists agenda_manager_notes_insert_manager on public.agenda_manager_notes;
create policy agenda_manager_notes_insert_manager on public.agenda_manager_notes
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
