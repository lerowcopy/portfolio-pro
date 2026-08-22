begin;

create type public.billing_plan as enum ('starter', 'pro', 'business');
create type public.billing_order_status as enum ('pending', 'paid', 'cancelled', 'refunded', 'failed');
create type public.subscription_status as enum ('active', 'past_due', 'cancelled', 'expired');

create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan public.billing_plan not null,
  status public.billing_order_status not null default 'pending',
  expected_amount_kopeks integer not null check (expected_amount_kopeks > 0),
  currency char(3) not null default 'RUB' check (currency = 'RUB'),
  period_days integer not null check (period_days between 1 and 366),
  freekassa_intid text unique,
  recurrent_order_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  freekassa_intid text not null unique,
  billing_order_id uuid not null references public.billing_orders(id) on delete restrict,
  merchant_id text not null,
  amount_kopeks integer not null check (amount_kopeks > 0),
  currency_id text,
  commission_kopeks integer,
  received_at timestamptz not null default timezone('utc', now())
);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.billing_plan not null,
  status public.subscription_status not null,
  current_period_end timestamptz not null,
  source_order_id uuid not null references public.billing_orders(id) on delete restrict,
  updated_at timestamptz not null default timezone('utc', now())
);

create index billing_orders_user_created_idx on public.billing_orders (user_id, created_at desc);
create index billing_orders_status_created_idx on public.billing_orders (status, created_at desc);
create index subscriptions_active_end_idx on public.subscriptions (status, current_period_end);

create trigger billing_orders_touch_updated_at before update on public.billing_orders for each row execute procedure public.touch_updated_at();

alter table public.billing_orders enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.billing_orders, public.billing_webhook_events, public.subscriptions from anon, authenticated;
grant select on public.billing_orders, public.subscriptions to authenticated;

create policy "Billing orders are visible only to their owner" on public.billing_orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "Subscriptions are visible only to their owner" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);

commit;
