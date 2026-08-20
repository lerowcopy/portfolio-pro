begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(120) not null,
  bio text not null,
  logo_url text,
  avatar_url text,
  social_links jsonb not null default '[]'::jsonb,
  template varchar(20) not null default 'minimal' check (template in ('minimal', 'gallery', 'cards', 'blog', 'creative', 'agency', 'showcase')),
  color_scheme varchar(20) not null default 'blue' check (color_scheme in ('blue', 'dark', 'purple', 'green', 'warm')),
  font_family varchar(20) not null default 'inter' check (font_family in ('inter', 'playfair', 'georgia')),
  services jsonb,
  posts jsonb,
  contact_email varchar(320),
  is_published boolean not null default false,
  published_at timestamptz,
  slug varchar(50) not null,
  slug_manually_edited boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint portfolios_slug_unique unique (slug)
);

create index portfolios_owner_updated_idx on public.portfolios (owner_id, updated_at desc);
create index portfolios_public_slug_idx on public.portfolios (is_published, slug);

create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  title varchar(100) not null,
  description varchar(1000) not null,
  images jsonb not null default '[]'::jsonb,
  project_url varchar(500),
  tags jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index portfolio_projects_portfolio_order_idx on public.portfolio_projects (portfolio_id, sort_order);
create index portfolio_projects_portfolio_created_idx on public.portfolio_projects (portfolio_id, created_at desc);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

create trigger portfolios_touch_updated_at
  before update on public.portfolios
  for each row execute procedure public.touch_updated_at();

create trigger portfolio_projects_touch_updated_at
  before update on public.portfolio_projects
  for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_projects enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.portfolios from anon, authenticated;
revoke all on table public.portfolio_projects from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

grant select on table public.portfolios to anon, authenticated;
grant insert, update, delete on table public.portfolios to authenticated;

grant select on table public.portfolio_projects to anon, authenticated;
grant insert, update, delete on table public.portfolio_projects to authenticated;

create policy "Profiles are visible only to their owner"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Profile owners can update permitted profile fields"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Published portfolios are publicly readable"
on public.portfolios
for select
to anon, authenticated
using (is_published = true);

create policy "Owners can read their draft portfolios"
on public.portfolios
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own portfolios"
on public.portfolios
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their own portfolios"
on public.portfolios
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their own portfolios"
on public.portfolios
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Published project records are publicly readable"
on public.portfolio_projects
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.is_published = true
  )
);

create policy "Owners can read draft project records"
on public.portfolio_projects
for select
to authenticated
using (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.owner_id = (select auth.uid())
  )
);

create policy "Owners can create project records"
on public.portfolio_projects
for insert
to authenticated
with check (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.owner_id = (select auth.uid())
  )
);

create policy "Owners can update project records"
on public.portfolio_projects
for update
to authenticated
using (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete project records"
on public.portfolio_projects
for delete
to authenticated
using (
  exists (
    select 1
    from public.portfolios
    where public.portfolios.id = portfolio_projects.portfolio_id
      and public.portfolios.owner_id = (select auth.uid())
  )
);

revoke all on function public.handle_new_user() from public;

commit;
