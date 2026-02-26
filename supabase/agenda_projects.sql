-- Projects for "Utveckling & Förbättring"

create extension if not exists "pgcrypto";

create table if not exists public.agenda_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_done boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agenda_projects_active_idx on public.agenda_projects (is_active, sort_order);

alter table public.agenda_projects enable row level security;

drop policy if exists "agenda_projects_select_staff" on public.agenda_projects;
create policy "agenda_projects_select_staff" on public.agenda_projects
  for select
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  );

drop policy if exists "agenda_projects_write_staff" on public.agenda_projects;
create policy "agenda_projects_write_staff" on public.agenda_projects
  for all
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

create or replace function public.set_focus_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agenda_projects_updated on public.agenda_projects;
create trigger trg_agenda_projects_updated
before update on public.agenda_projects
for each row
execute function public.set_focus_tasks_updated_at();

-- Optional seed data
insert into public.agenda_projects (title, description, sort_order, is_done)
select * from (
  values
    ('Uppföljningsmallar – gör dem vassare', 'Förtydliga mål, ta bort brus och lägg till 2 konkreta förbättringar som sparar tid.', 1, false),
    ('Kvalitetssäkra 3 profiler', 'Läs mål + historik och uppdatera måltexten så den blir tydlig och mätbar.', 2, false),
    ('Mikrochecklista för nya klienter', 'Skapa en 6–8 punkters check som minskar missar i första leveransen.', 3, true)
) as seed(title, description, sort_order, is_done)
where not exists (
  select 1 from public.agenda_projects
);
