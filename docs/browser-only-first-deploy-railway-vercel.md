# Portfolio Pro: первый deploy Railway + Vercel без локальной установки

Этот документ предназначен для первого запуска внешней версии Portfolio Pro. **Supabase уже подготовлен.** Вам нужны только браузер, GitHub-аккаунт с доступом к репозиторию `portfolio-pro`, аккаунты Railway и Vercel. Не отправляйте секреты, строки PostgreSQL или ключи в чат.

> Развёртывание выполняется в порядке: **Railway API → Vercel SPA → проверка Supabase Auth**. Текущий Manus runtime не затрагивается и остаётся fallback, пока внешний путь не пройдёт проверку.

## Что подготовить перед началом

В отдельной защищённой заметке откройте **Supabase Dashboard → Project Settings → API** и **Connect**. Нужны следующие значения только для самостоятельного ввода в панели сервисов.

| Значение | Где взять | Куда вводить | Можно ли отправлять в чат |
|---|---|---|---|
| Supabase Project URL | Project Settings → API | Railway и Vercel | Да, если потребуется диагностика URL |
| Publishable key | Project Settings → API | Railway и Vercel | Не присылайте; в Vercel он попадает в client bundle по назначению |
| Secret key | Project Settings → API | Только Railway | Нет |
| Session Pooler URI | Connect → Session pooler | Только Railway | Нет |

Supabase secret key является server-only credential: она не должна иметь префикс `VITE_` и не должна добавляться в Vercel [1].

## Шаг 1. Убедитесь, что GitHub содержит актуальный проект

1. Откройте GitHub и репозиторий **`portfolio-pro`**, связанный с этим проектом.
2. На ветке `main` должны быть файлы `railway.json`, `vercel.json`, папки `api/`, `server/external/`, `supabase/migrations/` и `docs/`.
3. Если видите их, **ничего не скачивайте и не запускайте на компьютере**. Railway и Vercel получат исходники напрямую из GitHub.

## Шаг 2. Создайте Railway API

1. Откройте [Railway](https://railway.app/) и войдите через GitHub.
2. Нажмите **New Project** → **Deploy from GitHub Repo**.
3. Если Railway просит разрешение GitHub, подтвердите доступ только к репозиторию `portfolio-pro` либо к выбранным репозиториям.
4. Выберите `portfolio-pro`. На вопрос о первом запуске выберите **Add Variables**. Так секреты будут добавлены до deployment, а не после неудачной сборки.
5. Откройте созданный service → **Variables** и добавьте все четыре значения ниже.

| Railway variable | Значение |
|---|---|
| `SUPABASE_DATABASE_URL` | Полная Session Pooler URI из Supabase, включая SSL параметры. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. |
| `SUPABASE_SECRET_KEY` | Supabase secret key. |

6. **Не создавайте** `PORT`: Railway передаёт порт приложению автоматически, а committed entrypoint его использует. Не добавляйте Manus OAuth, MySQL, `VITE_*` или Stripe variables в Railway external API.
7. Нажмите **Deploy**. Railway использует committed `railway.json`: build `pnpm run build:railway`, start `pnpm run start:railway`, healthcheck `/healthz`.
   Репозиторий фиксирует для этого runtime Node.js 22 через `package.json`; после изменения runtime-requirement Railway должен выполнить новый deployment.
8. После успешного deployment откройте service → **Settings** → **Networking** → **Generate Domain**. Скопируйте появившийся `https://…up.railway.app` URL.
9. В новой вкладке откройте `<ваш-railway-url>/healthz`. Ожидаемый JSON:

```json
{"ok":true,"runtime":"external"}
```

Railway принимает новую версию, когда healthcheck получает HTTP 200; healthcheck path уже задан в репозитории [2].

## Шаг 3. Создайте Vercel SPA

1. Откройте [Vercel](https://vercel.com/) и войдите через **Continue with GitHub**.
2. Нажмите **Add New…** → **Project** → **Import** рядом с `portfolio-pro`.
3. В настройках Import оставьте **Root Directory: `./`**. В поле Framework Preset выберите **Other**. Не выбирайте Next.js: это текущий Vite SPA runtime.
4. Не меняйте Build Command и Output Directory вручную. В committed `vercel.json` уже зафиксированы `pnpm build:vercel:spa` и `dist/public`.
5. До нажатия Deploy откройте **Environment Variables** и добавьте следующие переменные. Для каждой отметьте **Production** и **Preview**.

| Vercel variable | Значение |
|---|---|
| `VITE_EXTERNAL_RUNTIME` | `true` |
| `VITE_SUPABASE_URL` | Тот же Supabase Project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Тот же Supabase publishable key. |
| `RAILWAY_API_URL` | Railway domain из Шага 2, например `https://portfolio-pro-production-xxxx.up.railway.app`, без `/` в конце. |

6. **Не добавляйте** `SUPABASE_SECRET_KEY` или `SUPABASE_DATABASE_URL` в Vercel. **Не создавайте** `VITE_API_URL`: проект использует same-origin Vercel Function proxy `/api/trpc/*`.
7. Нажмите **Deploy** и дождитесь статуса **Ready**. Скопируйте Vercel URL вида `https://portfolio-pro-….vercel.app`.

Vercel создаёт deployment для каждого push, а переменные применяются только к новым deployments; после будущей смены значения используйте Redeploy [3] [4].

## Шаг 4. Свяжите Supabase с новым Vercel URL

1. В Supabase откройте **Authentication → URL Configuration**.
2. В **Site URL** вставьте Vercel Production URL.
3. В **Redirect URLs** добавьте ровно `https://<ваш-vercel-домен>/auth/signin`.
4. В **Authentication → Providers → Email** включите Email provider. Для production включите подтверждение email.
5. Нажмите Save.

Теперь откройте Vercel URL в приватном окне и перейдите на `/auth/signup`. Если создание учётной записи открывает форму, frontend уже использует внешний Supabase runtime.

## Шаг 5. Что прислать мне после первого deploy

Пришлите только две публичные ссылки:

```text
Railway API: https://…up.railway.app
Vercel app: https://….vercel.app
```

Не присылайте ключи, password, `SUPABASE_DATABASE_URL`, screenshots Variables или access token. Я проверю `/healthz`, Vercel `/api/trpc/system.health`, deep-link SPA routing и продолжу acceptance sequence.

## Если deployment не проходит

| Где ошибка | Что проверить сначала |
|---|---|
| Railway build failed | Откройте Deployments → View Logs; проверьте, что выбран `portfolio-pro`, а не старый `portfolio-pro-next`. |
| Railway healthcheck failed | Убедитесь, что `SUPABASE_DATABASE_URL` — именно Session Pooler URI и что секреты добавлены в Railway Variables. Не задавайте `PORT`. |
| `self-signed certificate in certificate chain` | Не меняйте Supabase SSL enforcement. Проект применяет scoped TLS compatibility только к Supabase Session Pooler; дождитесь Railway redeploy текущего commit. |
| Vercel build failed | Проверьте Framework **Other**, Root Directory `./` и наличие `vercel.json` в корне репозитория. |
| `/api/trpc` на Vercel returns 502 | Проверьте `RAILWAY_API_URL`: HTTPS, без trailing slash, Railway `/healthz` отвечает 200. Затем Redeploy Vercel. |
| Sign up fails | Проверьте `VITE_EXTERNAL_RUNTIME=true`, оба Supabase VITE variables и Supabase Site/Redirect URL. Затем Redeploy Vercel. |

## References

[1]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage Access Control"
[2]: https://docs.railway.com/deployments/healthchecks "Railway Healthchecks"
[3]: https://docs.railway.com/quick-start "Railway Quick Start"
[4]: https://vercel.com/docs/environment-variables "Vercel Environment Variables"
[5]: https://vercel.com/docs/git/vercel-for-github "Deploying GitHub Projects with Vercel"
