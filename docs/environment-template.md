# Portfolio Pro: шаблон переменных окружения

Этот документ содержит безопасный эквивалент `.env.example` для текущего проекта. В managed project нельзя создавать или редактировать `.env` и `.env.example` непосредственно: реальные значения должны задаваться через защищённые настройки окружения. Для внешнего repository скопируйте нужный блок ниже в локальный `.env.local`; файл с реальными значениями не должен попадать в Git.

> **Никогда не присваивайте префикс `VITE_` секретам.** Vite добавляет переменные с этим префиксом в browser bundle. В частности, это запрещено для `DATABASE_URL`, `JWT_SECRET`, FreeKassa API key и Secret Words, `SUPABASE_SERVICE_ROLE_KEY` и `RESEND_API_KEY`.

## 1. Текущий Manus/Vite/Express runtime

Эти названия соответствуют переменным, которые читает текущий исходный код. Внутри managed Manus environment значительная часть значений предоставляется платформой автоматически. При внешней адаптации значения Manus OAuth и Forge нельзя переносить на Vercel: их необходимо заменить внешними сервисами.

```dotenv
# Базовое окружение Node.js.
NODE_ENV=development
PORT=3000

# Drizzle / MySQL или TiDB. Используйте только server-side connection string.
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE

# Случайный серверный секрет длиной не менее 32 символов.
JWT_SECRET=replace_with_a_random_32_plus_character_secret

# Manus OAuth — доступно только для managed Manus runtime.
VITE_APP_ID=replace_with_manus_application_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=replace_with_owner_open_id
OWNER_NAME=replace_with_owner_name

# Manus Forge/storage — доступно только для managed Manus runtime.
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=replace_with_manus_server_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=replace_with_manus_frontend_api_key

# В текущем коде присутствует template-level Stripe compatibility.
# Оставьте пустым, если Stripe не используется.
STRIPE_SECRET_KEY=
```

| Категория | Можно использовать в Vite client code | Примечание |
|---|---:|---|
| `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | Да | Это публичные идентификаторы/URL текущего Manus OAuth flow. |
| `DATABASE_URL`, `JWT_SECRET` | Нет | Только server-side. |
| `BUILT_IN_FORGE_API_KEY` | Нет | Platform-specific server credential. |
| `VITE_FRONTEND_FORGE_API_KEY` | Только при managed Manus flow | Не переносите в Vercel: для внешнего deployment этот ключ недействителен. |

## 2. Внешняя Vercel/Supabase/FreeKassa адаптация

Следующий блок **не читается текущим Vite/Express кодом**. Добавляйте его в Vercel Settings → Environment Variables только после реализации внешнего adapter или Next.js migration. Значения приведены как placeholders и не являются рабочими ключами.

```dotenv
# Публичный origin внешнего deployment.
PUBLIC_APP_URL=https://your-domain.example

# Supabase: публичные значения допустимы в client bundle,
# service-role key — строго server-only.
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=replace_with_public_anon_or_publishable_key
# Railway Storage adapter читает сначала SUPABASE_SECRET_KEY,
# а SUPABASE_SERVICE_ROLE_KEY поддерживается для совместимости.
SUPABASE_SECRET_KEY=replace_with_server_only_supabase_secret_key
SUPABASE_SERVICE_ROLE_KEY=replace_with_server_only_service_role_key

# FreeKassa — строго server-only. Не используйте VITE_ префикс.
FREEKASSA_SHOP_ID=replace_with_shop_id
FREEKASSA_API_KEY=replace_with_api_key
FREEKASSA_SECRET_WORD_1=replace_with_payment_form_secret
FREEKASSA_SECRET_WORD_2=replace_with_result_callback_secret
FREEKASSA_PAYMENT_SYSTEM_ID=replace_with_available_payment_system_id
FREEKASSA_STARTER_AMOUNT_KOPEKS=49000
FREEKASSA_PRO_AMOUNT_KOPEKS=99000
FREEKASSA_BUSINESS_AMOUNT_KOPEKS=199000
FREEKASSA_ENFORCE_IP_ALLOWLIST=false
CRON_SECRET=replace_with_a_random_32_plus_character_secret

# Resend — строго server-only.
RESEND_API_KEY=replace_with_resend_api_key
RESEND_FROM_EMAIL=Portfolio Pro <noreply@your-domain.example>
```

| Сервис | Production placement | Нельзя раскрывать |
|---|---|---|
| Supabase | Vercel Environment Variables; `VITE_SUPABASE_*` — только публичные URL/key | `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| FreeKassa | Только server-side Vercel Environment Variables | API key, Secret Word 1, Secret Word 2, `CRON_SECRET` |
| Resend | Только server-side Vercel Environment Variables | `RESEND_API_KEY` |

## 3. Практический порядок работы

Для Manus не создавайте local `.env` без необходимости: переменные проекта уже управляются в защищённом окружении. Для внешнего Vercel deployment внесите server-side значения вручную в **Settings → Environment Variables** для нужных Production и Preview environments. После изменения server variable выполните новый deployment, чтобы функция получила обновлённое окружение.

Полный FreeKassa server-side flow и названия переменных для Next.js варианта находятся в [FreeKassa migration package](../freekassa-next14-prisma-implementation.md). Browser-only порядок настройки — в [Windows guide](../cloud-only-windows-portfolio-pro-guide.md).
