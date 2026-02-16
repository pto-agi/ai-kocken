-- Formulärtabeller för /start och /uppfoljning

create extension if not exists "pgcrypto";

create table if not exists public.startformular (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  desired_start_date date,
  weight_kg numeric not null,
  height_cm numeric not null,
  age integer not null,
  focus_areas text[] not null default '{}',
  goal_description text,
  injuries text,
  training_experience text,
  activity_last_6_months text,
  diet_last_6_months text,
  training_forms text[] default '{}',
  training_forms_other text,
  training_places text[] default '{}',
  training_places_other text,
  sessions_per_week text not null,
  sessions_per_week_other text,
  measurement_chest_back numeric,
  measurement_arm_right numeric,
  measurement_arm_left numeric,
  measurement_shoulders numeric,
  measurement_waist numeric,
  measurement_thigh_right numeric,
  measurement_thigh_left numeric,
  measurement_calf_right numeric,
  measurement_calf_left numeric
);

create table if not exists public.uppfoljningar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  quick_keep_plan boolean not null default false,
  summary_feedback text not null,
  goal text,
  other_activity text[] default '{}',
  training_places text[] default '{}',
  training_places_other text,
  sessions_per_week integer,
  refill_products text[] default '{}',
  auto_continue text
);

create index if not exists startformular_user_id_idx on public.startformular (user_id);
create index if not exists uppfoljningar_user_id_idx on public.uppfoljningar (user_id);

alter table public.startformular enable row level security;
alter table public.uppfoljningar enable row level security;

create policy "startformular_insert_own" on public.startformular
  for insert
  with check (auth.uid() = user_id);

create policy "startformular_select_own" on public.startformular
  for select
  using (auth.uid() = user_id);

create policy "uppfoljningar_insert_own" on public.uppfoljningar
  for insert
  with check (auth.uid() = user_id);

create policy "uppfoljningar_select_own" on public.uppfoljningar
  for select
  using (auth.uid() = user_id);
