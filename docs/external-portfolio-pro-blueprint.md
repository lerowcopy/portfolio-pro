# Portfolio Pro: внешний production blueprint

> **Рекомендация:** для нового внешнего репозитория используйте **GitHub → Vercel → Next.js App Router → Supabase Auth/Postgres/Storage → Stripe Billing → Resend**. Это более цельная схема, чем перенос текущего React/Express/tRPC приложения как есть: она даёт SSR для публичных портфолио, нативные Vercel preview deployments, RLS на уровне Postgres и один управляемый backend для Auth, данных и файлов.

## 1. Выбор стека

| Зона | Рекомендация | Почему |
|---|---|---|
| UI, SSR и API | **Next.js App Router + TypeScript** на Vercel | Один репозиторий для публичных SEO-страниц, dashboard и Route Handlers. Preview deployments формируются из pull request. |
| Аутентификация | **Supabase Auth** с `@supabase/ssr` | Cookie-based SSR, email/password, verification, reset password и OAuth без отдельного NextAuth слоя. Сервер должен проверять claims, а не доверять `getSession()` [1]. |
| База данных | **Supabase Postgres + SQL migrations + generated types** | Поддерживает RLS напрямую. Для текущего продукта это проще и безопаснее, чем Prisma для пользовательских запросов. |
| Хранилище | **Supabase Storage** | Публичные/приватные bucket policies, signed upload URLs и жизненный цикл файлов рядом с профилями. Не нужны одновременно Vercel Blob и Supabase Storage. |
| Платежи | **Stripe Checkout + Customer Portal + Webhooks** | Checkout принимает данные карты на Stripe; Customer Portal покрывает изменение плана, способа оплаты и отмену [2]. |
| Email | **Resend** | Verification, password reset и собственные product emails. Stripe receipts остаются функцией Stripe. |
| UI | Tailwind CSS, shadcn/ui, React Hook Form, Zod, Framer Motion, `@dnd-kit` | Совместимо с уже созданным дизайном editor/templates и не привязывает к серверному runtime. |

### Что не рекомендую добавлять на старте

Не переносите одновременно **NextAuth**, отдельный Express/tRPC server, Prisma и Vercel Blob. Каждый из них дублирует возможности выбранной схемы. Исключение — Drizzle можно использовать **только для migrations**, но чтение/запись пользовательских данных лучше выполнять через Supabase server client с RLS. Это уменьшает риск обхода политик доступа.

## 2. Целевая архитектура

```text
Browser
  ├─ Next.js Server/Client Components
  ├─ Supabase Auth cookie session
  └─ Supabase Storage signed upload URL

Vercel / Next.js
  ├─ Server Components: public portfolio SSR and dashboard loaders
  ├─ Route Handlers: /api/stripe/checkout, /api/stripe/portal, /api/stripe/webhook
  ├─ Server Actions: portfolio/project mutations (or Route Handlers for explicit APIs)
  └─ Vercel Cron: subscription-expiry reminders (optional)

Supabase
  ├─ auth.users → public.profiles
  ├─ Postgres + RLS: portfolios, projects, subscriptions, stripe_events
  └─ Storage: avatars, logos, project-images

Stripe
  ├─ Checkout
  ├─ Customer Portal
  └─ signed webhook → Next.js Route Handler → Supabase service-role client
```

## 3. Создание репозитория и локального приложения

На macOS с Node.js LTS, pnpm и Git выполните следующие команды. Репозиторий оставьте приватным до первой безопасной публикации.

```bash
pnpm create next-app@latest portfolio-pro \
  --ts --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm

cd portfolio-pro

pnpm add @supabase/supabase-js @supabase/ssr \
  stripe zod react-hook-form @hookform/resolvers \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  lucide-react framer-motion resend

pnpm add -D supabase

git init
git add .
git commit -m "chore: bootstrap Portfolio Pro"

gh repo create portfolio-pro --private --source=. --remote=origin --push
```

Предлагаемая структура:

```text
src/
  app/
    (marketing)/page.tsx
    (auth)/auth/...
    dashboard/
      portfolios/[id]/edit/page.tsx
      portfolios/[id]/projects/page.tsx
      billing/page.tsx
    [slug]/page.tsx
    api/stripe/checkout/route.ts
    api/stripe/portal/route.ts
    api/stripe/webhook/route.ts
  components/
    portfolio/templates/
    editor/
    projects/
    billing/
  lib/
    supabase/client.ts
    supabase/server.ts
    supabase/admin.ts
    stripe.ts
  types/
supabase/
  migrations/
  seed.sql
middleware.ts
```

## 4. Supabase: Auth, Postgres, Storage и RLS

### 4.1 Создание проекта

1. Создайте отдельные **development** и **production** проекты Supabase. Для preview-подключений используйте Supabase Branching либо заранее выделенный staging проект.
2. В **Authentication → URL Configuration** задайте production Site URL и redirect URLs. Для Vercel previews добавьте допустимый wildcard согласно документации [3].
3. Включите email/password, email confirmation и нужные OAuth providers. Для Product MVP достаточно email/password + GitHub/Google OAuth.
4. Создайте Storage buckets: `avatars`, `logos`, `project-images`. Начинайте с private buckets и выдавайте signed URLs для dashboard; public portfolios могут использовать public delivery только для однозначно опубликованных изображений.

### 4.2 Переменные `.env.local`

```dotenv
# Public: допустимы в browser bundle
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>

# Server only: никогда не добавлять NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Portfolio Pro <hello@example.com>"
CRON_SECRET=<random-32-plus-character-secret>
```

Supabase рекомендует создавать отдельные browser и server clients через `@supabase/ssr`; на сервере проверяйте identity через `getClaims()` или `getUser()`, но не используйте `getSession()` как источник авторизации [1].

### 4.3 Инициализация migrations

```bash
pnpm dlx supabase login
pnpm dlx supabase init
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase migration new init_portfolio_pro
```

В `supabase/migrations/<timestamp>_init_portfolio_pro.sql` создайте следующие минимальные сущности:

| Таблица | Ключевые поля | Назначение |
|---|---|---|
| `profiles` | `id uuid primary key references auth.users`, `display_name`, `stripe_customer_id` | Профиль и Stripe Customer ID. |
| `portfolios` | `id`, `user_id`, `slug unique`, `template`, `color_scheme`, `font_family`, `is_published` | Метаданные редактора и public route. |
| `portfolio_projects` | `portfolio_id`, `title`, `description`, `image_paths text[]`, `tags text[]`, `project_url`, `start_date`, `end_date`, `sort_order` | Нормализованные case studies. |
| `subscriptions` | `user_id`, `stripe_subscription_id unique`, `stripe_price_id`, `status`, `current_period_end` | Небольшой entitlement cache для быстрого gating. |
| `stripe_events` | `stripe_event_id unique`, `event_type`, `user_id`, `received_at`, `processed_at`, `outcome` | Идемпотентность и безопасный audit trail без raw payload. |

> **Важно:** не храните номера карт, CVC, Stripe API keys, client secrets или raw webhook payloads. Для приложения достаточно Stripe resource IDs и ограниченного entitlement/audit cache. Это устраняет дублирование платёжных данных и риск несинхронного состояния.

Примените миграции:

```bash
pnpm dlx supabase db push
pnpm dlx supabase gen types typescript --linked > src/types/database.ts
```

### 4.4 RLS: обязательная baseline policy

Включите RLS на каждой таблице, доступной из Supabase client. Профили, portfolios и projects должны проверять `auth.uid() = user_id`; public `select` применяется только к `portfolios.is_published = true` и project rows, принадлежащим опубликованному portfolio. Stripe webhook использует server-only service role client и не выполняется в browser.

## 5. Stripe: корректный MVP billing flow

### 5.1 Checkout и Customer Portal

Создавайте Checkout Session **только** в `/api/stripe/checkout` после проверки Supabase user. Передавайте `client_reference_id`, `metadata.user_id`, `customer_email`, разрешайте promotion codes и возвращайте `session.url`. Никогда не берите price ID, user ID или entitlement из frontend без server validation.

Customer Portal является предпочтительным способом реализовать change plan, cancel subscription и update payment method. Stripe создаёт short-lived portal URL, а ваше приложение должно создать сессию лишь для уже аутентифицированного customer [2]. В Customer Portal заранее включите payment method updates, cancel, invoice history и product catalog для Starter/Pro/Business.

### 5.2 Webhook

Реализуйте `POST /api/stripe/webhook` как Node.js Route Handler. Используйте `await request.text()` для raw body и `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Не применяйте JSON parsing до signature verification.

Обрабатывайте следующие snapshot events:

| Событие | Действие |
|---|---|
| `checkout.session.completed` | Связать Stripe customer с `profiles`, получить subscription ID. |
| `customer.subscription.created` / `updated` | Upsert cached subscription status, price ID и period end. |
| `invoice.paid` | Отметить entitlement active; при необходимости отправить product email через Resend. |
| `invoice.payment_failed` | Сохранить `past_due` entitlement и показать in-app warning со ссылкой в Customer Portal. |
| `customer.subscription.deleted` | Отозвать Pro/Business entitlement после окончания доступа. |

Stripe документирует webhooks как асинхронный источник жизненного цикла подписки; endpoint должен проверять подпись и отвечать `2xx` быстро [4]. Добавьте unique constraint на `stripe_event_id`; попытка вставки дубликата означает успешную обработку ранее доставленного события. Если transaction не завершилась, верните `500`, и Stripe повторит доставку.

### 5.3 Что изменить в исходном требованиях

Не ищите и не создавайте пользователя **по email внутри webhook как по identity source**. Связывайте session с уже аутентифицированным `user_id` через Checkout metadata/client reference. Email — изменяемый контактный атрибут, но не надёжный login key. Не сохраняйте полный webhook payload: храните ID, тип, timestamps, статус обработки и безопасное error summary.

## 6. Vercel и GitHub

1. В Vercel импортируйте GitHub repository. Root directory оставьте пустым, framework preset — Next.js.
2. Добавьте environment variables для **Development**, **Preview** и **Production**. Service role, Stripe secret, webhook secret, Resend key и cron secret не должны быть доступны клиенту.
3. В Supabase добавьте production URL и preview redirects. В Stripe зарегистрируйте production URL `/api/stripe/webhook`; webhook endpoint должен быть доступен по HTTPS [4].
4. Для локального development выполните:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
pnpm dlx vercel env pull .env.local
pnpm dev
```

5. Для локальной Stripe проверки в отдельном терминале:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Stripe CLI выдаст отдельный локальный `whsec_...`, который используется **только** в `.env.local` [4].

## 7. Последовательность миграции из текущей реализации

| Текущая концепция | Внешняя реализация |
|---|---|
| Manus OAuth user | `auth.users` + `profiles.id = auth.users.id` |
| MySQL `portfolios` | Supabase Postgres `portfolios` with RLS |
| `portfolio_projects` + S3 paths | Postgres projects + Supabase Storage paths |
| tRPC protected procedures | Server Actions / Route Handlers + Supabase server client |
| React public slug route | `app/[slug]/page.tsx` with SSR metadata and `notFound()` |
| Stored templates | Shared TSX renderer, but public page is Server Component with client islands only where interactive |
| Manus S3 upload | Supabase signed upload endpoint with server-side ownership assertion |

Переносите в таком порядке: сначала database and RLS, затем Auth, storage uploads, portfolio/project CRUD, templates/public SSR, а потом Stripe. Billing не должен блокировать работу editor и project management на старте.

## 8. Production checklist

- [ ] GitHub repository is private; branch protection requires CI checks before merge.
- [ ] Vercel Preview is connected to pull requests; Production env values are distinct from Development.
- [ ] Supabase RLS is enabled and tested for every user-owned table.
- [ ] Server actions and Stripe routes call `getClaims()`/`getUser()` before reading user-owned data.
- [ ] Storage uploads use a validated allow-list, file-size limit, generated storage path and ownership policy.
- [ ] Stripe Dashboard contains test products and recurring prices; Customer Portal product catalog is configured.
- [ ] Webhook endpoint uses raw body + Stripe signature verification + `stripe_event_id` uniqueness.
- [ ] Stripe test card `4242 4242 4242 4242` is tested in sandbox; no real cards are stored locally.
- [ ] Billing gating is based on webhook-synced subscription entitlement, not Checkout redirect alone.
- [ ] Production domain, Supabase redirects, Resend domain and Stripe webhook URL are all updated before launch.

## 9. Recommended next decision

Start the external repository from a clean Next.js App Router baseline rather than attempting a mechanical export of the current Vite/Express project. Then port the assets and domain logic in small vertical slices. This produces a cleaner, auditable deployment path and retains the product work already completed: templates, palette/font system, portfolio/project model, client validations, upload constraints, ordering behaviour and test cases.

## References

[1]: https://supabase.com/docs/guides/auth/server-side/nextjs "Supabase: Creating a Supabase client for SSR"
[2]: https://docs.stripe.com/customer-management/integrate-customer-portal "Stripe: Integrate the customer portal with the API"
[3]: https://github.com/vercel/nextjs-subscription-payments "Vercel: Next.js Subscription Payments Starter"
[4]: https://docs.stripe.com/webhooks "Stripe: Receive Stripe events in your webhook endpoint"
[5]: https://vercel.com/templates/next.js/stripe-supabase-saas-starter-kit "Vercel: Stripe & Supabase SaaS Starter Kit"
