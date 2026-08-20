# Portfolio Pro: Vite external cutover runbook

Этот runbook описывает включение уже реализованного внешнего режима: **Vercel SPA → same-origin Vercel proxy → Railway API → Supabase Auth/Postgres/Storage**. Текущий Manus runtime не удаляется и остаётся fallback до успешного прохождения acceptance checks.

> **Граница безопасности.** Внешний браузер получает только `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`. PostgreSQL URL, Supabase secret key и `RAILWAY_API_URL` остаются server-only. Supabase указывает, что service-role/secret credentials обходят RLS, поэтому приложение использует их только на Railway после explicit ownership validation [1].

## 1. Конфигурация Supabase

В Supabase Dashboard убедитесь, что migrations `20260820000100`—`20260820000400` отражены в `private.app_schema_migrations`. Текущий migration runner уже создаёт private buckets `portfolio-avatars`, `portfolio-logos` и `portfolio-project-images`, RLS policy на `storage.objects` и защищённую таблицу audit задач `storage_cleanup_tasks`.

| Dashboard area | Required setting |
|---|---|
| Authentication → Providers | Enable Email/Password. Enable Confirm email for production. |
| Authentication → URL Configuration | Set Site URL to the future Vercel production domain. Add `/auth/signin` on that domain to Redirect URLs. |
| Project Settings → API | Copy project URL, publishable key and secret key. |
| Storage | Do not make any Portfolio Pro bucket public. |

Supabase Storage access is governed by RLS policies on `storage.objects`; private buckets therefore need signed URL delivery or authenticated access [2].

## 2. Railway API service

Create a Railway service from this repository. Use the committed configuration and set the following server-only variables in Railway Variables.

| Variable | Value |
|---|---|
| `SUPABASE_DATABASE_URL` | Supabase Session Pooler PostgreSQL URI with SSL. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used only for JWT identity verification. |
| `SUPABASE_SECRET_KEY` | Supabase secret key; never expose it to browser code. |
| `PUBLIC_APP_URL` | Future Vercel production URL. |
| `PORT` | Omit; Railway provides it. |

Railway uses `pnpm build:railway` and `pnpm start:railway` from the committed manifest. Before connecting Vercel, verify `https://<railway-domain>/healthz` returns `{"ok":true,"runtime":"external"}`.

## 3. Vercel SPA service

Import the same repository into a separate Vercel project and choose the **Other** framework preset. The committed `vercel.json` runs `pnpm build:vercel:spa`, publishes `dist/public`, routes browser history paths to `index.html`, and keeps the filesystem function `api/trpc/[...path].ts` available before the SPA fallback.

| Vercel variable | Scope | Value |
|---|---|---|
| `VITE_EXTERNAL_RUNTIME` | Production and Preview | `true` |
| `VITE_SUPABASE_URL` | Production and Preview | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production and Preview | Supabase publishable key |
| `RAILWAY_API_URL` | Production and Preview | Railway HTTPS deployment origin, without trailing slash |
| `VITE_API_URL` | Omit | Leave unset when using the committed same-origin proxy. |

Vercel rewrites preserve the browser URL, while this project’s API bridge uses a Vercel Function so the Railway origin remains server-only [3]. The proxy forwards only the required tRPC and Authorization headers, has an 8 MiB request limit, disables response caching, and does not return internal upstream details.

## 4. Acceptance sequence

Execute this sequence in a browser against a Vercel Preview deployment first. Do not switch a production domain before it passes.

1. Open `/auth/signup`, create a new email/password user, complete confirmation if enabled, then sign in.
2. Open `/dashboard`, create a portfolio, edit title and bio, save, reload and confirm the data is retained.
3. Upload an avatar and a project image. Confirm previews render but the saved database values are opaque `storage://...` paths, not a Manus path or a temporary signed URL.
4. Replace the avatar, then delete the project. Confirm the dashboard still works and inspect `storage_cleanup_tasks`; it must remain empty for successful object deletes.
5. Publish the portfolio and load `/<slug>` in a private browser window. Confirm draft portfolios remain unavailable.
6. Create a second test user. Confirm it cannot list, retrieve, edit, reorder or delete the first user’s portfolio or projects.
7. Open `/api/trpc/system.health` through Vercel and confirm the response identifies `external` runtime. Verify a non-API deep link such as `/dashboard/portfolios/<uuid>/edit` refreshes without a 404.

## 5. Rollback rule

If any acceptance step fails, set `VITE_EXTERNAL_RUNTIME=false` in the affected Vercel environment or remove the Preview deployment. Do not modify or delete Manus database/S3 data. The existing Manus runtime remains independent and can continue serving known-good workflows while the external issue is corrected.

## References

[1]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage Access Control"
[2]: https://supabase.com/docs/guides/storage/buckets/fundamentals "Supabase Storage Buckets"
[3]: https://vercel.com/docs/routing/rewrites "Vercel Rewrites"
