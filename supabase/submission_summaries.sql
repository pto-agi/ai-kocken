create table if not exists public.submission_summaries (
  id uuid primary key default gen_random_uuid(),
  submission_type text not null check (submission_type in ('start', 'uppfoljning')),
  submission_id text not null,
  language text not null default 'sv',
  source_hash text not null,
  model text not null,
  summary_json jsonb not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists submission_summaries_unique_idx
  on public.submission_summaries (submission_type, submission_id, language);

create index if not exists submission_summaries_hash_idx
  on public.submission_summaries (source_hash);

create or replace function public.touch_submission_summaries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_submission_summaries_updated_at on public.submission_summaries;
create trigger trg_submission_summaries_updated_at
before update on public.submission_summaries
for each row execute function public.touch_submission_summaries_updated_at();
