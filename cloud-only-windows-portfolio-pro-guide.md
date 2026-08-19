# Portfolio Pro: подробная Windows-инструкция без локальной установки

> **Цель:** развернуть внешний проект Portfolio Pro полностью через браузер. На Windows не нужно устанавливать Node.js, Git, Docker, Supabase CLI, Vercel CLI, Stripe CLI или FreeKassa SDK. Работа с кодом выполняется во встроенном **GitHub Codespaces**, а инфраструктура настраивается в GitHub, Vercel, Supabase, FreeKassa и Resend.

## 1. Итоговая схема и решение по стеку

Используйте следующую архитектуру.

```text
GitHub repository
       ↓ push / pull request
Vercel (Next.js App Router, Preview и Production deployments)
       ├── Supabase Auth + Postgres + Storage
       ├── FreeKassa Checkout + Recurring + Result Callback
       └── Resend (письма приложения)
```

| Область | Сервис | Что он делает |
|---|---|---|
| Код и история изменений | GitHub | Private repository, pull requests, review и ветки. |
| Разработка без локального ПК | GitHub Codespaces | Браузерный VS Code, облачный terminal, preview port и git commit/push [1]. |
| Frontend, SSR, API и cron | Next.js на Vercel | Public pages, dashboard, Route Handlers, Preview deployments и запуск scheduled renewal route. [2] |
| Login, database и files | Supabase | Auth, Postgres, RLS и Storage. |
| Billing | FreeKassa | Hosted checkout, Result URL callback и recurring orders через API. [6] [8] |
| Письма приложения | Resend | Email verification, password reset и product emails. |

> **Ключевое отличие от Stripe:** FreeKassa не использует Stripe-style JSON webhook, готовый Customer Portal и автоматический subscription state machine. Результат платежа приходит на **Result URL** как `form-data`; приложение проверяет подпись, сумму и локальный order. Для каждого последующего списания приложение создаёт recurring order через API с ранее сохранённым `recurrent_order_id`. Успешный callback получает текстовый ответ `YES`. [6] [8]

На старте не добавляйте отдельный Express server, tRPC backend, NextAuth, Prisma и Vercel Blob, если выбрана эта схема. Supabase Auth заменяет самостоятельную auth-систему, Supabase Storage — Vercel Blob, а Postgres SQL migrations и generated types дают простую базовую модель данных.

## 2. Что нужно подготовить в браузере

| Аккаунт | Действие | Нужен на старте |
|---|---|---|
| GitHub | Создать аккаунт и включить 2FA. | Да |
| Vercel | Зарегистрироваться через GitHub. | Да |
| Supabase | Зарегистрироваться через GitHub. | Да |
| FreeKassa | Создать merchant account на [merchant.freekassa.net](https://merchant.freekassa.net/), добавить магазин и получить реквизиты. | Для billing |
| Resend | Создать account. | Для production emails |
| Домен | Купить или подключить позднее через Vercel. | Не обязателен для первого deploy |

Сохраните database password Supabase, Supabase service-role key, FreeKassa API key, оба Secret Word и Resend API key в password manager. **Никогда** не публикуйте их в GitHub issue, commit, screenshot, чат или browser environment variable.

## 3. Шаг 1 — создать отдельный внешний Next.js repository

> **Причина вашей ошибки:** существующий `portfolio-pro` — это репозиторий текущего Manus-приложения. В его `package.json` есть Vite и Express, но нет зависимости `next`, поэтому Vercel не может определить Next.js version. Его не нужно и нельзя использовать как исходный repository для описанного в этой инструкции внешнего Next.js 14 deploy.

Создайте отдельный private repository для внешней реализации. Ниже используется имя **`portfolio-pro-next`**; оно не конфликтует с уже существующим `portfolio-pro`.

1. В GitHub нажмите **New repository**.
2. В поле **Repository name** укажите `portfolio-pro-next`.
3. Выберите **Private**.
4. Важно: **не** отмечайте `Add a README file`, `.gitignore` или license. Repository должен быть пустым, чтобы `create-next-app` смог создать проект в его корне.
5. Нажмите **Create repository**.
6. Не импортируйте текущий `portfolio-pro` в Vercel. Ошибочный Vercel project можно оставить как неактивный либо удалить через **Settings → General → Delete Project**; это не удаляет GitHub repository.

## 4. Шаг 2 — создать Next.js 14 приложение в GitHub Codespaces

1. Откройте новый GitHub repository `portfolio-pro-next`.
2. Нажмите зелёную кнопку **Code**.
3. Откройте вкладку **Codespaces**.
4. Нажмите **Create codespace on main**.
5. Дождитесь browser-based VS Code. В нижней части окна находится cloud terminal.

В cloud terminal выполните команды ниже. Первая команда создаёт настоящий Next.js 14 project и добавляет `next` в `dependencies`; именно этого не хватало в Vercel build log.

```bash
corepack enable

pnpm create next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

pnpm add @supabase/supabase-js @supabase/ssr \
  zod react-hook-form @hookform/resolvers \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  lucide-react framer-motion resend

# Одобрить build scripts только известных transitive dependencies Next.js/Tailwind.
pnpm approve-builds

pnpm exec next --version
pnpm build
```

В зависимости от точной версии starter pnpm может показать разные ожидаемые пакеты, например `@tailwindcss/oxide`, `esbuild` или `unrs-resolver`. При выполнении `pnpm approve-builds` используйте пробел, чтобы выбрать **только точные имена, показанные в текущем `ERR_PNPM_IGNORED_BUILDS` сообщении**, затем нажмите Enter. Не добавляйте имена вручную и не одобряйте незнакомый package.

Если `create-next-app` завершился сообщением `pnpm install has failed` после генерации файлов, **не запускайте `pnpm create next-app@14 .` повторно**. Файлы проекта уже созданы. Выполните recovery-команды в том же Codespaces terminal:

```bash
pnpm approve-builds
# В интерактивном списке выберите только packages из текущего ERR_PNPM_IGNORED_BUILDS.
pnpm install
pnpm exec next --version
pnpm build
```

После успешного `pnpm build` продолжайте с commit и Vercel import. Если следующий `pnpm install` снова показывает ignored build script, повторите `pnpm approve-builds` только для нового package, указанного pnpm, а не для произвольных зависимостей.

Команда `pnpm exec next --version` должна вывести версию `14.x`.

### 4.1 Первый commit и push из Codespaces

После успешного `pnpm build` отправьте файлы в **уже созданный** GitHub repository `portfolio-pro-next`. Новый repository создавать не нужно: Codespaces уже подключён к нему как к `origin`.

1. В левой панели Codespaces нажмите **Source Control** (иконка ветки).
2. В блоке **Changes** нажмите `+` рядом с каждым файлом либо кнопку `+` рядом с заголовком **Changes**, чтобы stage all changes.
3. В поле **Message** введите: `Initialize Next.js 14 external application`.
4. Нажмите **Commit**. Если Codespaces спросит, нужно ли автоматически stage all files, выберите **Yes**.
5. Нажмите **Sync Changes**. При первом push может отображаться **Publish Branch** — выберите его. После завершения откройте GitHub repository `portfolio-pro-next` в новой вкладке: должны появиться `package.json`, `pnpm-lock.yaml`, `src/`, `public/` и другие файлы Next.js.

Тот же результат можно получить в cloud terminal, если удобнее команды:

```bash
git status
git add .
git commit -m "Initialize Next.js 14 external application"
git push origin main
```

Используйте **один** способ: либо Source Control, либо terminal commands; не выполняйте commit второй раз. GitHub документирует browser flow для commit/push и private repositories. [1]

## 5. Шаг 3 — импортировать новый Next.js repository в Vercel

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard) и войдите через тот же GitHub account.
2. Нажмите **Add New → Project**.
3. В разделе **Import Git Repository** найдите `portfolio-pro-next` и нажмите **Import**. Не выбирайте **Clone Template**.
4. Проверьте настройки import: Framework Preset — **Next.js**, Root Directory — `./`, Build Command — стандартный `next build`.
5. Нажмите **Deploy**.
6. После успешного deploy откройте **Go to Dashboard**. Сохраните адрес наподобие `https://portfolio-pro-next-<scope>.vercel.app` — это временный production URL.

Если `portfolio-pro-next` не появляется в списке Vercel, откройте **Add GitHub Account** или **Configure GitHub App** на том же экране и предоставьте Vercel доступ именно к этому repository. После выдачи доступа обновите список и нажмите **Import**.

После import Vercel связан с GitHub repository автоматически. Каждый последующий push в `main` запускает новый **Production Deployment**; push в другую ветку или pull request создаёт **Preview Deployment**. Вручную загружать ZIP или повторно создавать Vercel project не нужно. [2]

> Vercel автоматически создаёт Preview Deployment для каждого push и pull request; push в production branch `main` обновляет production deployment. [2]

После initial deployment вернитесь в Codespaces нового `portfolio-pro-next`. Для запуска development server выполните:

```bash
pnpm dev
```

Codespaces предложит открыть forwarded port 3000 в новой browser tab. Для FreeKassa не устанавливайте случайный npm SDK и не добавляйте `date-fns` только ради одного `addDays`: используйте встроенный `fetch` Next.js, `node:crypto` и небольшую локальную функцию для работы с датами. Официальная документация FreeKassa описывает HTTP API и алгоритмы подписи. [6] [7]

## 6. Шаг 4 — создать Supabase проект

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/) и войдите через GitHub.
2. Нажмите **New project**.
3. Выберите organization, назовите проект `portfolio-pro-prod`.
4. Выберите region ближе к основной аудитории.
5. Укажите сильный database password и сохраните его в password manager.
6. Дождитесь состояния **Healthy**.
7. Откройте **Settings → API** и приготовьте Project URL, Publishable key и Service role key.

### 6.1 Подключить Supabase к Vercel

1. В Vercel откройте проект, импортированный из `portfolio-pro-next`.
2. Перейдите в **Settings → Integrations → Browse Marketplace**.
3. Найдите **Supabase** и нажмите **Add Integration**.
4. Выберите Vercel project и Supabase project `portfolio-pro-prod`.
5. Подтвердите установку.

Supabase документирует browser-only путь: создать проект на Vercel, затем установить Supabase integration из Vercel Marketplace; database schema можно применить через Supabase SQL Editor. [3]

## 7. Шаг 5 — создать схему в Supabase SQL Editor

1. В Supabase откройте **SQL Editor → New query**.
2. Вставьте SQL ниже одним блоком.
3. Нажмите **Run**.
4. После успеха откройте **Table Editor** и убедитесь, что появились таблицы.

```sql
-- Portfolio Pro baseline schema. Выполняется в Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  logo_path text,
  avatar_path text,
  social_links jsonb not null default '[]'::jsonb,
  template text not null default 'minimal' check (template in ('minimal','gallery','cards','blog','creative','agency','showcase')),
  color_scheme text not null default 'blue' check (color_scheme in ('blue','dark','purple','green','warm')),
  font_family text not null default 'inter' check (font_family in ('inter','playfair','georgia')),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolios_user_updated_idx on public.portfolios(user_id, updated_at desc);
create index if not exists portfolios_public_slug_idx on public.portfolios(is_published, slug);

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  image_paths text[] not null default '{}',
  tags text[] not null default '{}',
  project_url text,
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists portfolio_projects_order_idx on public.portfolio_projects(portfolio_id, sort_order);

-- Доступ пользователя к тарифу. recurring ID не является секретом, но его
-- нельзя принимать из browser request.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('starter','pro','business')),
  status text not null default 'pending' check (status in ('pending','active','past_due','canceled','expired')),
  fk_recurring_id bigint unique,
  payer_ip inet,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_due_idx
  on public.subscriptions(status, next_payment_at)
  where cancel_at_period_end = false;

-- Одна строка на локальный order. Unique keys защищают от повторной доставки
-- Result URL и от повторной выдачи оплаченного доступа.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  merchant_order_id text not null unique,
  fk_order_id bigint unique,
  fk_transaction_id text unique,
  amount_kopeks integer not null check (amount_kopeks >= 100),
  currency text not null default 'RUB' check (currency = 'RUB'),
  plan text not null check (plan in ('starter','pro','business')),
  kind text not null check (kind in ('initial','renewal')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','canceled')),
  paid_at timestamptz,
  received_at timestamptz,
  processed_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_events_user_created_idx on public.payment_events(user_id, created_at desc);
create index if not exists payment_events_status_created_idx on public.payment_events(status, created_at);

-- Создаёт профиль после создания пользователя в Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);

create policy "portfolio owner all" on public.portfolios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published portfolios public read" on public.portfolios for select using (is_published = true);

create policy "project owner all" on public.portfolio_projects for all using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);
create policy "published project public read" on public.portfolio_projects for select using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.is_published = true)
);

create policy "subscription own read" on public.subscriptions for select using (auth.uid() = user_id);
create policy "payment event own read" on public.payment_events for select using (auth.uid() = user_id);
-- Не создавайте client-side insert/update policy для subscriptions или payment_events.
-- Их меняет только server-side code с service-role key после проверки callback.
```

> **Security rule:** Supabase Auth user identity должна подтверждаться на сервере через `getClaims()` или `getUser()`; не доверяйте непроверенному объекту browser `getSession()`. [4]

**Важно для Stripe migration:** не удаляйте исторические Stripe-колонки и таблицы до reconciliation. Сначала отключите Stripe webhook, завершите проверку FreeKassa в тестовой среде, подтвердите callback flow и только после этого отдельной миграцией архивируйте или удалите legacy Stripe data.

## 8. Шаг 6 — настроить Supabase Auth

В Supabase откройте **Authentication → Providers**.

1. Включите **Email**.
2. Включите **Confirm email**.
3. При необходимости включите GitHub и Google OAuth. Их client secret остаётся только в Supabase provider settings.
4. Откройте **Authentication → URL Configuration** и задайте Site URL как Vercel production URL, а Redirect URLs как production URL с `/**` и preview wildcard, например `https://*-<your-vercel-scope>.vercel.app/**`. [5]

Для MVP используйте Supabase Auth вместо самостоятельной password hashing/login системы. Он поддерживает verification и password reset.

## 9. Шаг 7 — создать Storage buckets и policies

В Supabase откройте **Storage → New bucket** и создайте private buckets.

| Bucket | Public | Назначение |
|---|---:|---|
| `avatars` | Нет | Portrait пользователя. |
| `logos` | Нет | Logo портфолио. |
| `project-images` | Нет | Изображения case studies. |

Для первого безопасного запуска оставьте buckets private. Server Action или Route Handler проверяет владельца и выдаёт signed URL, например для пути:

```text
<auth-user-id>/<portfolio-id>/<random-uuid>.webp
```

Добавьте Storage RLS policies в SQL Editor:

```sql
create policy "user uploads own avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user reads own avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "user uploads own logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user reads own logos" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "user uploads own project images" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user reads own project images" on storage.objects for select to authenticated
  using (bucket_id = 'project-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

Добавьте server-side allow-list: JPEG, PNG, WebP; максимум 5 MB; не более пяти изображений на проект; generated filenames; проверка ownership portfolio до выдачи signed upload URL.

## 10. Шаг 8 — задать environment variables в Vercel

В Vercel откройте **Project → Settings → Environment Variables**. Добавляйте значения только через браузер.

| Переменная | Где взять | Environments |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel production URL | Production; для Preview используйте runtime URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | Development, Preview, Production. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Settings → API | Development, Preview, Production. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API | Только server environments; никогда `NEXT_PUBLIC_`. |
| `FREEKASSA_SHOP_ID` | FreeKassa merchant dashboard → настройки магазина | Server environments. |
| `FREEKASSA_API_KEY` | FreeKassa merchant dashboard → API | Server environments. |
| `FREEKASSA_SECRET_WORD_1` | FreeKassa merchant dashboard → SCI/payment form settings | Server environments. |
| `FREEKASSA_SECRET_WORD_2` | FreeKassa merchant dashboard → Result URL/callback settings | Server environments. |
| `FREEKASSA_PAYMENT_SYSTEM_ID` | ID разрешённой payment system | Server environments. |
| `FREEKASSA_STARTER_AMOUNT_KOPEKS` | Ваша server-side цена, например `49000` | Server environments. |
| `FREEKASSA_PRO_AMOUNT_KOPEKS` | Ваша server-side цена, например `99000` | Server environments. |
| `FREEKASSA_BUSINESS_AMOUNT_KOPEKS` | Ваша server-side цена, например `199000` | Server environments. |
| `FREEKASSA_ENFORCE_IP_ALLOWLIST` | `false` до проверки trusted-proxy headers, затем `true` | Production. |
| `CRON_SECRET` | Сгенерируйте random 32+ character value | Production. |
| `RESEND_API_KEY` | Resend API Keys | Server environments. |
| `RESEND_FROM_EMAIL` | Verified Resend domain sender | Server environments. |

После добавления environment variables сделайте **Redeploy** в Vercel. Никогда не добавляйте `NEXT_PUBLIC_` к FreeKassa API key или Secret Word.

## 11. Шаг 9 — настроить FreeKassa без локальной машины

Все действия выполняются в [FreeKassa Merchant Dashboard](https://merchant.freekassa.net/). Названия экранов могут немного отличаться в зависимости от статуса merchant account, поэтому при сомнении сверяйтесь с официальной документацией. [6]

1. Войдите в merchant dashboard и создайте или выберите магазин Portfolio Pro.
2. Откройте настройки магазина и сохраните **Shop/Merchant ID** как `FREEKASSA_SHOP_ID`.
3. В разделе API создайте ключ с минимально необходимым доступом и сохраните его только как `FREEKASSA_API_KEY` в Vercel.
4. Задайте два разных сильных Secret Word:
   - **Secret Word 1** — подпись checkout/payment form;
   - **Secret Word 2** — проверка Result URL callback.
5. В настройках уведомлений задайте **Result URL**:

```text
https://<ваш-production-домен>/api/webhooks/freekassa
```

6. Выберите метод **POST** для callback, если этот параметр доступен в кабинете. Route Handler должен читать `await request.formData()`, а не JSON.
7. Задайте отдельные Success и Failure URLs:

```text
https://<ваш-production-домен>/billing/success
https://<ваш-production-домен>/pricing?payment=failed
```

8. Включите test mode/sandbox, **если он доступен вашему merchant account**, и создайте первый тестовый checkout строго по доступному flow в кабинете. Тестовые карты Stripe к FreeKassa не применимы.
9. До обработки реальных оплат проверьте, какие payment systems разрешены вашему магазину, и сохраните выбранный ID в `FREEKASSA_PAYMENT_SYSTEM_ID`. [7]

### 10.1 Обязательная серверная логика Result URL

Result URL — единственный источник выдачи платного доступа. Redirect пользователя на success page **не подтверждает оплату**. Route Handler обязан выполнить все проверки до изменения `subscriptions`.

| Проверка | Зачем нужна |
|---|---|
| Принять `form-data` | Callback FreeKassa не является JSON webhook. [6] |
| Проверить `MERCHANT_ID` | Исключает callback другого магазина. |
| Проверить MD5 подпись Secret Word 2 constant-time comparison | Подтверждает callback, сформированный с серверным секретом. |
| Сверить сумму в копейках, `currency` и локальный `merchant_order_id` | Нельзя доверять цене, plan или user ID из browser/callback без локальной сверки. |
| Использовать unique `merchant_order_id` и `fk_transaction_id` | Делает повторную доставку идемпотентной. |
| Вернуть `YES` только после успешной обработки | Подтверждает доставку платёжному провайдеру. [6] |

Подпись callback строится по формату:

```text
MD5(MERCHANT_ID:AMOUNT:SECRET_WORD_2:MERCHANT_ORDER_ID)
```

Повторный callback для уже оплаченного order должен снова вернуть `YES`, но не должен второй раз продлить `current_period_end`. При временной ошибке database transaction верните `500`, чтобы провайдер мог повторить уведомление.

### 10.2 Настроить recurring payments через Vercel Cron

Первый order для подписки создаётся с `recurrent: "Y"`. После его подтверждения сохраните на сервере `fk_recurring_id`, `next_payment_at`, тариф и IP плательщика. Для следующего списания приложение вызывает FreeKassa order API с `recurrent_order_id`; это не «вечный» разовый checkout. [8]

Создайте в project root файл `vercel.json` в Codespaces:

```json
{
  "crons": [
    {
      "path": "/api/cron/freekassa-renew",
      "schedule": "15 3 * * *"
    }
  ]
}
```

Endpoint `/api/cron/freekassa-renew` обязан сверять заголовок `Authorization` со значением `Bearer ${CRON_SECRET}`. Он выбирает активные подписки с `next_payment_at <= now()`, создаёт локальную строку `payment_events` в статусе `pending`, затем вызывает FreeKassa API с соответствующим `fk_recurring_id`. Не используйте фиктивный IP и не создавайте renewal, если для подписки уже существует pending renewal.

> **Практическое правило:** cancellation в собственной billing UI означает `cancel_at_period_end = true`. Пользователь сохраняет доступ до `current_period_end`, но исключается из следующего cron renewal.

## 12. Шаг 10 — настроить Resend

1. Откройте [Resend](https://resend.com/) и создайте account.
2. В **Domains** добавьте свой домен.
3. Скопируйте DNS records в Vercel **Domains** или в DNS provider домена.
4. Дождитесь статуса **Verified**.
5. Создайте API key, ограниченный этим проектом.
6. В Vercel добавьте `RESEND_API_KEY` и `RESEND_FROM_EMAIL`.

Для первого MVP verification/password-reset лучше отправлять через Supabase Auth SMTP/настройки. Resend используйте для branded product emails: успешный платёж, неуспешное продление и отмена подписки.

## 13. Шаг 11 — как работать с кодом только из браузера

| Задача | Где делать |
|---|---|
| Создать или изменить файлы Next.js | GitHub Codespaces browser VS Code. |
| Установить dependency | Codespaces cloud terminal: `pnpm add <package>`. |
| Запустить проверку | Codespaces terminal: `pnpm lint`, `pnpm test`, `pnpm build`. |
| Посмотреть приложение до deploy | Codespaces forwarded port 3000. |
| Commit/push | Codespaces Source Control pane. |
| Получить Preview URL | Vercel Dashboard или PR comment. |
| Изменить schema и RLS | Supabase SQL Editor, затем сохранить тот же SQL в `supabase/migrations/`. |
| Secrets | Только Vercel Environment Variables, Supabase, FreeKassa и Resend dashboards. |
| Проверить callback | FreeKassa merchant dashboard, Vercel Function Logs и `payment_events` в Supabase Table Editor. |

```text
Создать feature branch в GitHub
        ↓
Открыть branch в Codespaces
        ↓
Изменить код, pnpm test, pnpm build
        ↓
Commit + Push через браузер
        ↓
Открыть GitHub Pull Request
        ↓
Проверить Vercel Preview URL
        ↓
Merge в main → Production deploy
```

## 14. Шаг 12 — тестировать FreeKassa flow без локальной машины

Проверяйте payment flow в test mode/sandbox вашего merchant account до production. Конкретные тестовые методы зависят от доступных способов оплаты и статуса магазина, поэтому используйте только актуальные сценарии, показанные FreeKassa в кабинете или документации. [6]

| Сценарий | Действие | Ожидаемый результат |
|---|---|---|
| Unauthorized checkout | Откройте `/pricing` в отдельном logged-out browser profile и нажмите тариф. | API возвращает `401`; не создаётся payment event и не принимается browser user ID. |
| Первичный checkout | Войдите как тестовый пользователь, выберите Starter и пройдите доступный test flow. | Создан один pending event, browser перенаправлен на hosted payment URL. |
| Result callback | Проверьте delivery в merchant dashboard и Vercel Function Logs. | Route вернул `YES`; event стал `succeeded`; subscription стала `active`. |
| Повтор callback | Используйте разрешённую повторную доставку или callback test кабинета. | Ответ `YES`; `current_period_end` не продлён второй раз. |
| Неверная подпись | Отправьте controlled request только в Preview/test endpoint с изменённым `SIGN`. | Ответ `400`; доступ не выдан. |
| Неверная сумма | Измените `AMOUNT` в controlled Preview test request. | Ответ `400`; event не становится `succeeded`. |
| Recurring | Установите test subscription `next_payment_at` на прошлое время только в тестовой БД, затем запустите scheduler. | Создан один renewal event; duplicate pending renewal не создан. |
| Отмена | Установите cancel-at-period-end через собственную billing UI. | Доступ сохранён до конца периода; cron пропускает подписку. |

Не тестируйте live production Result URL произвольными внешними запросами. Для controlled negative tests используйте отдельный Preview/Sandbox environment, временные тестовые credentials и после проверки удаляйте test records.

## 15. Что переносить из текущего Portfolio Pro

Не переносите текущий Vite/Express runtime механически. Переносите domain logic постепенно.

1. Семь template-компонентов: **Minimal, Gallery, Cards, Blog, Creative, Agency, Showcase**.
2. Palette/font system: Blue, Dark, Purple, Green, Warm; Inter, Playfair, Georgia.
3. Portfolio editor, slug transliteration, publish state и public `app/[slug]/page.tsx` с `notFound()`.
4. Нормализованные portfolio projects, search, order, local object-URL preview и image constraints.
5. Supabase Auth и RLS.
6. **FreeKassa после стабилизации editor/project workflow:** сначала checkout и Result URL, затем idempotency, далее recurring cron и собственная billing UI.

## 16. Финальный browser-only checklist

- [ ] GitHub repo private.
- [ ] Vercel production URL works.
- [ ] Codespaces opens and `pnpm dev` opens a forwarded browser port.
- [ ] Supabase SQL schema ran successfully.
- [ ] RLS is enabled and user A cannot see user B private portfolios/projects.
- [ ] Supabase Auth signup, verification, sign-in and reset password work.
- [ ] Private Storage buckets reject unowned uploads.
- [ ] Vercel Preview appears on a pull request.
- [ ] FreeKassa Shop ID, API key and two distinct Secret Word values are present only in Vercel server environments.
- [ ] Checkout accepts only a server-validated plan code; browser does not send amount, currency, FreeKassa secret or arbitrary user ID.
- [ ] Result URL uses `POST`, accepts `form-data`, validates `MERCHANT_ID`, Secret Word 2 signature, exact amount and local pending order.
- [ ] Callback returns exactly `YES` only after a successful transaction; a duplicate callback does not extend access twice.
- [ ] One `payment_events` row corresponds to one local `merchant_order_id`; provider transaction ID is unique.
- [ ] Recurring cron endpoint rejects requests without `Bearer ${CRON_SECRET}` and skips subscriptions marked cancel-at-period-end.
- [ ] A test/sandbox payment and callback were checked in FreeKassa dashboard and Vercel logs before enabling production payments.
- [ ] Resend domain is verified before production product emails are enabled.

## 17. Частые проблемы и решения

| Симптом | Вероятная причина | Действие в браузере |
|---|---|---|
| OAuth/email link возвращает на localhost | Supabase Site URL/Redirect URLs не настроены. | Authentication → URL Configuration: добавьте Vercel production и preview patterns. |
| Vercel deploy не видит Supabase/FreeKassa vars | Integration не связана или variables добавлены не в тот environment. | Vercel → Settings → Integrations/Environment Variables: проверьте Preview и Production, затем Redeploy. |
| `permission denied for table` | Нет RLS policy либо server использует обычный client там, где нужен server-only service-role client. | Проверьте policy в SQL Editor и не выносите service-role key в browser. |
| FreeKassa callback возвращает `400 Invalid signature` | Использован Secret Word 1 вместо Secret Word 2, другой amount format или `SIGN` сравнивается некорректно. | Сверьте `MERCHANT_ID:AMOUNT:SECRET_WORD_2:MERCHANT_ORDER_ID`, точный `AMOUNT` и настройки магазина. [6] |
| FreeKassa callback возвращает `400 Unknown order` | `merchant_order_id` не сохранён до вызова provider API либо сумма/валюта не совпадают с локальной записью. | Проверьте `payment_events` в Supabase и server logs; не создавайте order только после redirect. |
| Callback приходит, но доступ не выдаётся | Database transaction failed или callback обработан до записи local payment. | Проверьте Vercel Function Logs, исправьте причину, затем используйте разрешённый повтор callback из кабинета. |
| Callback повторяется | Нормальное поведение при отсутствии `YES` или временной ошибке. | Сделайте handler идемпотентным: уже успешный transaction отвечает `YES`, но не продлевает период повторно. |
| Renewal не создаётся | Cron не зарегистрирован, `CRON_SECRET` не совпадает, `next_payment_at` ещё не наступил или `fk_recurring_id` отсутствует. | Проверьте `vercel.json`, Vercel Cron/Function Logs, subscription record и server-only environment variable. |
| Renewal создаётся дважды | Не проверяется pending renewal либо имеются параллельные job runs. | До API call создавайте один pending `payment_events` record с unique key и пропускайте существующий pending renewal. |
| Появилось желание включить IP allow-list | Platform proxy headers не подтверждены. | Оставьте `FREEKASSA_ENFORCE_IP_ALLOWLIST=false`, пока не подтвердите trusted-proxy behavior Vercel; signature, amount и idempotency обязательны всегда. |
| Нужна команда, но нет terminal на Windows | Это не проблема. | Откройте Codespaces и запускайте команду в его cloud terminal. |

## 18. Важное: как связаны Manus, GitHub и Vercel

В этой задаче существуют **два разных репозитория**. Они не синхронизируются друг с другом автоматически, потому что содержат разные runtime и разные deployment targets.

| Repository | Роль | Куда попадают изменения | Можно ли подключать к Vercel как Next.js app |
|---|---|---|---|
| `portfolio-pro` | Текущий Manus-проект на React/Vite/Express. Это источник кода, который создавался в Manus. | Сохранённые checkpoint этого проекта синхронизируются с GitHub repository `portfolio-pro`. | Нет: в нём нет Next.js runtime и зависимости `next`. |
| `portfolio-pro-next` | Отдельная внешняя Next.js 14 реализация для Supabase, FreeKassa и Vercel. | Commit/push из Codespaces попадает в GitHub repository `portfolio-pro-next`. | Да: Vercel импортирует и deploys именно этот repository. |

> **Нельзя ожидать цепочку `Manus → portfolio-pro → portfolio-pro-next → Vercel` без отдельного процесса миграции.** Обычный Git push не преобразует React/Vite/Express приложение в Next.js App Router, не переносит database schema и не заменяет Manus OAuth/S3 на Supabase Auth/Storage.

Правильный workflow выглядит так:

```text
Изменения в текущем приложении Manus
        ↓ checkpoint synchronizes source history
GitHub: portfolio-pro
        ↓ явная поэтапная миграция feature-by-feature
GitHub: portfolio-pro-next
        ↓ push в main
Vercel: Production Deployment
```

Для внешнего production проекта считайте `portfolio-pro-next` **единственным источником кода для Vercel**. Когда требуется перенести готовую функцию из Manus, переносите её явно по слоям: сначала domain types и data model, затем server-side Next.js route/server action, затем React UI, тесты и Supabase policies. После проверки commit/push делается в `portfolio-pro-next`, и Vercel deploys новую версию автоматически. [2]

Не подключайте Vercel к `portfolio-pro` и не настраивайте GitHub Action, который механически копирует все файлы из `portfolio-pro` в `portfolio-pro-next`: это перезапишет Next.js starter, перенесёт несовместимые runtime files и не создаст работающий production deploy.

Если ваша цель — продолжать разрабатывать **только в Manus**, внешний Next.js/Vercel migration не будет автоматической. В таком случае либо продолжайте использовать встроенный deployment Manus для текущего приложения, либо принимайте поэтапную миграцию в `portfolio-pro-next` как отдельную работу. Для управляемого Vercel production потока после миграции создавайте и проверяйте новые features в `portfolio-pro-next`, а не в Vite repository.

## References

[1]: https://docs.github.com/en/codespaces/getting-started/quickstart "GitHub Codespaces quickstart"
[2]: https://vercel.com/docs/git/vercel-for-github "Vercel: Deploying GitHub Projects"
[3]: https://supabase.com/partners/catalog/vercel "Supabase: Vercel integration guide"
[4]: https://supabase.com/docs/guides/auth/server-side/nextjs "Supabase: Server-side Auth for Next.js"
[5]: https://github.com/vercel/nextjs-subscription-payments "Vercel: Next.js Subscription Payments Starter"
[6]: https://docs.freekassa.net/ "FreeKassa API: SCI, API orders, callbacks and recurring payments"
[7]: https://docs.freekassa.net/#tag/Orders/operation/createOrder "FreeKassa: Create order API"
[8]: https://docs.freekassa.net/#tag/Recurring-payments "FreeKassa: Recurring payments"
