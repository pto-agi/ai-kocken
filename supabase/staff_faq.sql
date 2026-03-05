-- Staff FAQ entries for intranet

create extension if not exists "pgcrypto";

create table if not exists public.staff_faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  how_to text,
  category text not null default 'Policy',
  tags text[] not null default '{}'::text[],
  link_label text,
  link_href text,
  show_on_intranet boolean not null default false,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_faq_entries_active_idx on public.staff_faq_entries (is_active, sort_order, created_at desc);
create index if not exists staff_faq_entries_tags_idx on public.staff_faq_entries using gin (tags);

alter table public.staff_faq_entries
  add column if not exists show_on_intranet boolean not null default false;

alter table public.staff_faq_entries enable row level security;

drop policy if exists "staff_faq_select_staff" on public.staff_faq_entries;
create policy "staff_faq_select_staff" on public.staff_faq_entries
  for select
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  );

drop policy if exists "staff_faq_insert_staff" on public.staff_faq_entries;
create policy "staff_faq_insert_staff" on public.staff_faq_entries
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_staff = true
    )
  );

drop policy if exists "staff_faq_update_staff" on public.staff_faq_entries;
create policy "staff_faq_update_staff" on public.staff_faq_entries
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

drop policy if exists "staff_faq_delete_manager" on public.staff_faq_entries;
create policy "staff_faq_delete_manager" on public.staff_faq_entries
  for delete
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_manager = true
    )
  );

create or replace function public.set_staff_faq_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_staff_faq_set_updated_at on public.staff_faq_entries;
create trigger trg_staff_faq_set_updated_at
  before update on public.staff_faq_entries
  for each row
  execute function public.set_staff_faq_updated_at();

insert into public.staff_faq_entries (
  question,
  answer,
  how_to,
  category,
  tags,
  link_label,
  link_href,
  show_on_intranet,
  sort_order
)
select * from (
  values
    (
      'Vilket Swish-nummer använder vi?',
      'Swish-nummer för betalning är 123 003 73 17.',
      null,
      'Betalning',
      array['swish','betalning','nummer']::text[],
      null,
      null,
      true,
      10
    ),
    (
      'Vilka betalningssätt gäller för medlemskap och förlängning?',
      'Kort, Swish, faktura, delbetalning och Apple Pay hanteras via Stripe/Klarna.',
      null,
      'Betalning',
      array['betalning','kort','faktura','klarna','apple pay','stripe']::text[],
      null,
      null,
      true,
      20
    ),
    (
      'Var hittar jag intranätets huvudsidor?',
      'Använd snabblänkarna nedan för daglig drift.',
      'Öppna rätt sida direkt beroende på arbetsflöde.',
      'Snabblänkar',
      array['intranät','snabblänk','manager','todoist','sales']::text[],
      'Intranät',
      '/intranet',
      true,
      30
    ),
    (
      'Var ser jag senaste ändringar i systemet?',
      'Öppna changelog för att se senaste releaser och vad som ändrats.',
      null,
      'Snabblänkar',
      array['changelog','release','ändringar']::text[],
      'Changelog',
      '/changelog',
      false,
      40
    )
) as seed(question, answer, how_to, category, tags, link_label, link_href, show_on_intranet, sort_order)
where not exists (select 1 from public.staff_faq_entries);
