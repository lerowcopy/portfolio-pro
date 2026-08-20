begin;

do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end
$$;

alter table public.profiles
  add column if not exists role public.app_role not null default 'user';

alter table public.portfolios
  add column if not exists services jsonb,
  add column if not exists posts jsonb,
  add column if not exists contact_email varchar(320),
  add column if not exists slug_manually_edited boolean not null default false;

alter table public.portfolios
  alter column social_links set default '[]'::jsonb;

create index if not exists portfolios_user_updated_idx
  on public.portfolios (user_id, updated_at desc);
create index if not exists portfolios_public_slug_idx
  on public.portfolios (is_published, slug);
create index if not exists portfolio_projects_portfolio_order_idx
  on public.portfolio_projects (portfolio_id, sort_order);
create index if not exists portfolio_projects_portfolio_created_idx
  on public.portfolio_projects (portfolio_id, created_at desc);

create or replace function public.handle_new_user()
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

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_touch_updated_at' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'portfolios_touch_updated_at' and tgrelid = 'public.portfolios'::regclass) then
    create trigger portfolios_touch_updated_at before update on public.portfolios for each row execute procedure public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'portfolio_projects_touch_updated_at' and tgrelid = 'public.portfolio_projects'::regclass) then
    create trigger portfolio_projects_touch_updated_at before update on public.portfolio_projects for each row execute procedure public.touch_updated_at();
  end if;
end
$$;

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_projects enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.portfolios from anon, authenticated;
revoke all on table public.portfolio_projects from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path) on table public.profiles to authenticated;
grant select on table public.portfolios to anon, authenticated;
grant insert, update, delete on table public.portfolios to authenticated;
grant select on table public.portfolio_projects to anon, authenticated;
grant insert, update, delete on table public.portfolio_projects to authenticated;

drop policy if exists "profiles own read" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "portfolio owner all" on public.portfolios;
drop policy if exists "published portfolios public read" on public.portfolios;
drop policy if exists "project owner all" on public.portfolio_projects;
drop policy if exists "published project public read" on public.portfolio_projects;

create policy "Profiles are visible only to their owner"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Profile owners can update permitted profile fields"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Published portfolios are publicly readable"
on public.portfolios for select to anon, authenticated
using (is_published = true);

create policy "Owners can read their draft portfolios"
on public.portfolios for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own portfolios"
on public.portfolios for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Owners can update their own portfolios"
on public.portfolios for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Owners can delete their own portfolios"
on public.portfolios for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Published project records are publicly readable"
on public.portfolio_projects for select to anon, authenticated
using (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.is_published = true
));

create policy "Owners can read draft project records"
on public.portfolio_projects for select to authenticated
using (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.user_id = (select auth.uid())
));

create policy "Owners can create project records"
on public.portfolio_projects for insert to authenticated
with check (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.user_id = (select auth.uid())
));

create policy "Owners can update project records"
on public.portfolio_projects for update to authenticated
using (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.user_id = (select auth.uid())
));

create policy "Owners can delete project records"
on public.portfolio_projects for delete to authenticated
using (exists (
  select 1 from public.portfolios
  where public.portfolios.id = portfolio_projects.portfolio_id
    and public.portfolios.user_id = (select auth.uid())
));

revoke all on function public.handle_new_user() from public;

commit;
