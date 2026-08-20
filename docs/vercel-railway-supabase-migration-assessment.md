# Portfolio Pro: оценка миграции на Vercel + Railway + Supabase

## Вывод

Предложенная схема **Vercel для React SPA, Railway для Express/tRPC и Supabase для Auth, PostgreSQL и Storage** реализуема. Однако приложенный план нельзя применять копированием блоков кода: он смешивает несовместимые модели аутентификации, database dialect и deployment runtime. Без корректной миграции это приведёт к потере доступа пользователей, несовместимости таблиц или раскрытию server secrets.

> **Решение до начала кода:** выбрать одну целевую database platform. При выборе Supabase источником истины должна быть **Supabase PostgreSQL**, а не одновременно Railway MySQL. Следовательно, текущая Drizzle MySQL schema требует отдельной PostgreSQL migration.

## Что уже подходит, а что требует переработки

| Область | Состояние текущего проекта | Почему приложенный plan недостаточен | Безопасное решение |
|---|---|---|---|
| Frontend | React/Vite, production output `dist/public` | Prompt ожидает `client/dist`; это не фактический output. | Собирать существующей командой `pnpm build`; Vercel должен отдавать Vite output и выполнять SPA rewrite. |
| API | Express + tRPC на `/api/trpc` | В prompt упомянут `/trpc`; меняет фактический public contract. | Сохранить `/api/trpc`; Vercel должен proxy/rewrite этот путь на Railway API. |
| Server process | `server/_core/index.ts` читает `PORT` и запускает Express | Это совместимо с Railway, но содержит Manus OAuth, storage proxy и managed services. | Оставить `PORT`, затем отделить framework-neutral Express app от Manus runtime и заменить integrations. |
| Database | Drizzle **MySQL** с auto-increment integer IDs | Supabase database — PostgreSQL; нельзя использовать MySQL schema и migrations без изменения dialect и типов. | Создать отдельную PostgreSQL Drizzle schema/migration, map `auth.users.id` UUID и перенести данные контролируемо. |
| Auth | Manus OAuth и cookie/session fallback | Вставка Supabase `user.id` UUID с type cast не совместима с текущим `users.id: int`. | Заменить полный auth flow, создать `profiles.id uuid references auth.users(id)` и изменить ownership relations на UUID. |
| Storage | Manus S3 proxy и server storage helpers | Startup-код из prompt создаёт **public** bucket с elevated key и маскирует ошибки. | Provision bucket через Supabase migration/dashboard, применить RLS, server-only secret key и signed URLs/явную public-assets policy. |
| CORS | Current API same-origin | `*` вместе с credentials не работает в браузерах и небезопасен. | Предпочесть Vercel rewrite `/api/*` → Railway, чтобы browser видел same-origin. Для direct Railway calls — точный allowlist, `Vary: Origin`, preflight. [3] |

## Критические несоответствия в приложенном тексте

Текущий `main.tsx` уже создаёт tRPC client, но его `headers()` направляет Manus preview token и `startLogin()` запускает Manus OAuth. Простая подстановка `VITE_API_URL` не заменяет аутентификацию: сначала нужно удалить Manus token fallback, затем добавить Supabase browser session и безопасное получение access token для tRPC. При Bearer-token модели `credentials: "include"` не является заменой auth; а при cookie модели cross-site cookies потребуют отдельных SameSite, Secure, CSRF и exact-CORS решений.

`supabase.auth.getUser(token)` может использоваться для подтверждения Supabase-issued access token, но код не должен приводить результат к текущему MySQL `User` type. Текущая схема использует числовой `users.id`, тогда как Supabase Auth использует UUID. Необходимо сначала принять модель user ID, затем переписать foreign keys, database helpers, ownership tests и client auth UI. Supabase рекомендует проверять issued JWT библиотечным API или через корректную JWT verification strategy; не следует реализовывать подпись вручную. [2]

Ключ `SUPABASE_KEY` в приложенном prompt неоднозначен. Используйте два явных имени: `SUPABASE_PUBLISHABLE_KEY` для browser/public operations и `SUPABASE_SECRET_KEY` только для Railway server operations, которым действительно нужен bypass RLS. Secret/service keys дают elevated access и не могут попадать в Vite bundle, Git, логи или пользовательский браузер. [1]

## Целевая схема

```text
Browser
  │  HTTPS: same-origin /api/trpc
  ▼
Vercel: Vite static SPA + rewrite /api/*
  │
  ▼
Railway: Express + tRPC
  ├── Supabase Auth: verify user access token
  ├── Supabase PostgreSQL: Drizzle PostgreSQL dialect
  ├── Supabase Storage: controlled assets
  └── FreeKassa / Resend: server-only integrations
```

Vercel documents that a rewrite proxy makes the browser-facing request same-origin and removes most browser CORS/preflight concerns. [3] Direct browser-to-Railway calls should be used only when necessary and must use exact allowed origins rather than a wildcard with credentials.

## Обязательная последовательность миграции

| Этап | Содержание | Критерий готовности |
|---|---|---|
| 0. Freeze and backup | Сохранить Manus checkpoint, экспортировать schema/data plan, зафиксировать current test baseline. | Есть rollback point, secrets не экспортируются. |
| 1. Deployment-neutral server | Вынести `createApp()` без `listen`, добавить Railway entrypoint и health endpoint; сохранить `/api/trpc`. | `pnpm check`, `pnpm test`, Railway smoke test. |
| 2. PostgreSQL migration | Перевести Drizzle MySQL schema на PostgreSQL, UUID ownership и Supabase SQL migrations. | New database schema, RLS policies, migration test. |
| 3. Supabase Auth | Добавить sign-up/sign-in/reset UI, token verification in tRPC context, profiles provisioning and authorization tests. | User A cannot access User B data. |
| 4. Supabase Storage | Replace Manus storage proxy, define bucket visibility/RLS and upload limits. | Unauthorized upload/read tests pass. |
| 5. Frontend transport | Remove Manus token/OAuth hooks; use Supabase session access token; configure Vercel rewrite and dev proxy. | Login, refresh, logout, API calls work in preview and production. |
| 6. Billing and email | Add FreeKassa callback, idempotency and recurring cron; add Resend. | Signed callback, duplicate delivery and renewal tests pass. |
| 7. Cutover | Import data where required, configure domains, run manual QA, switch DNS only after acceptance. | Production checklist complete. |

## Допустимые environment variables

Имена должны быть explicit. Все server-only values задаются в Railway Variables; публичные Vite values задаются на Vercel только если их действительно читает client code.

| Environment | Variable | Visibility | Назначение |
|---|---|---|---|
| Railway | `DATABASE_URL` | Server only | Supabase PostgreSQL connection string. |
| Railway | `SUPABASE_URL` | Server only | Supabase project URL. |
| Railway | `SUPABASE_PUBLISHABLE_KEY` | Server only or public duplicate | Auth token verification / project identification. |
| Railway | `SUPABASE_SECRET_KEY` | Server only | Только privileged admin/storage operations; не применять в обычных user queries. |
| Railway | `ALLOWED_ORIGINS` | Server only | Comma-separated exact origins, если direct CORS остаётся. |
| Railway | `FREEKASSA_*`, `CRON_SECRET`, `RESEND_API_KEY` | Server only | Billing/email integrations после их реализации. |
| Vercel | `VITE_API_URL` | Public build-time value | Нужна только при direct cross-origin API requests; не требуется при rewrite proxy. |
| Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public build-time values | Только для Supabase browser auth client. |

## Что не следует делать

Не добавляйте `Access-Control-Allow-Origin: *` для авторизованного API с cookies/credentials. Не создавайте bucket автоматически на каждом server startup. Не оставляйте Manus OAuth/sessionStorage fallback после cutover. Не используйте `any` и type cast для «совместимости» UUID Supabase user с текущим MySQL user. Не подключайте одновременно Railway MySQL и Supabase PostgreSQL без продуманной репликации; это создаёт два источника истины.

## Решение, требующее подтверждения

До изменения кода необходимо подтвердить три выбора: **(1)** Supabase PostgreSQL является единственной production database; **(2)** Supabase Auth заменяет Manus OAuth целиком; **(3)** frontend будет обращаться к Railway через Vercel rewrite (предпочтительно) либо через direct CORS API URL. После подтверждения можно начинать этап 1 — deployment-neutral server — без удаления текущего Manus flow до готовности replacement.

## References

[1]: https://supabase.com/docs/guides/getting-started/api-keys "Supabase: Understanding API keys"
[2]: https://supabase.com/docs/guides/auth/jwts "Supabase: JSON Web Tokens"
[3]: https://vercel.com/kb/guide/how-to-enable-cors "Vercel: How to enable CORS"
[4]: https://docs.railway.com/guides/express "Railway: Deploy an Express App"
