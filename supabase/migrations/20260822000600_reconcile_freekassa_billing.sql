begin;

-- Существующая subscriptions уже использует text plan/status, UUID id и unique user_id.
-- Сохраняем эти данные, добавляя только недостающую связь с server-created billing order.
create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro', 'business')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  expected_amount_kopeks integer not null check (expected_amount_kopeks > 0),
  currency char(3) not null default 'RUB' check (currency = 'RUB'),
  period_days integer not null check (period_days between 1 and 366),
  freekassa_intid text unique,
  recurrent_order_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  freekassa_intid text not null unique,
  billing_order_id uuid not null references public.billing_orders(id) on delete restrict,
  merchant_id text not null,
  amount_kopeks integer not null check (amount_kopeks > 0),
  currency_id text,
  commission_kopeks integer,
  received_at timestamptz not null default timezone('utc', now())
);

alter table public.subscriptions
  add column if not exists source_order_id uuid references public.billing_orders(id) on delete restrict;

create index if not exists billing_orders_user_created_idx on public.billing_orders (user_id, created_at desc);
create index if not exists billing_orders_status_created_idx on public.billing_orders (status, created_at desc);
create index if not exists subscriptions_active_end_idx on public.subscriptions (status, current_period_end);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'billing_orders_touch_updated_at'
      and tgrelid = 'public.billing_orders'::regclass
  ) then
    create trigger billing_orders_touch_updated_at
      before update on public.billing_orders
      for each row execute procedure public.touch_updated_at();
  end if;
end
$$;

alter table public.billing_orders enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.billing_orders, public.billing_webhook_events from anon, authenticated;
grant select on public.billing_orders, public.subscriptions to authenticated;

drop policy if exists "Billing orders are visible only to their owner" on public.billing_orders;
create policy "Billing orders are visible only to their owner"
on public.billing_orders for select to authenticated
using ((select auth.uid()) = user_id);

commit;
