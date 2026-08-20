begin;

create table if not exists public.storage_cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique check (storage_path like 'storage://%'),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text not null,
  created_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists storage_cleanup_tasks_pending_idx
  on public.storage_cleanup_tasks (resolved_at, last_attempt_at asc);

alter table public.storage_cleanup_tasks enable row level security;
revoke all on table public.storage_cleanup_tasks from anon, authenticated;

commit;
