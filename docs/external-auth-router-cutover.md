# Supabase Auth router cutover

## Почему нельзя включить client cutover сразу

Текущий `server/routers.ts` использует managed MySQL Drizzle schema с numeric `users.id`, numeric `portfolios.id` и `ctx.user.id`. Supabase Auth выдаёт UUID. Подстановка Supabase JWT в этот router до замены data layer либо даст неверный ownership query, либо приведёт к type-unsafe преобразованию UUID в number.

## Обязательный порядок

| Шаг | Действие | Инвариант безопасности |
|---|---|---|
| 1 | Создать external PostgreSQL tRPC router поверх `SUPABASE_DATABASE_URL`. | Все identifiers portfolio/project остаются UUID. |
| 2 | Использовать `authenticateSupabaseRequest()` в external context. | User берётся только из проверенного Supabase access token. |
| 3 | Повторить portfolio/project CRUD с `user_id = ctx.user.id`. | Каждый write повторно ограничен owner UUID в SQL. |
| 4 | Передать Supabase session access token в `Authorization: Bearer`. | Browser никогда не получает service secret или PostgreSQL URI. |
| 5 | Переключить Railway app на external router после unit/integration tests. | Manus router остаётся отдельным, пока cutover не подтверждён. |

## Временная граница

`createExternalFoundationContext()` намеренно возвращает `user: null`. Поэтому Railway foundation безопасен для `/healthz`, но ещё не является user-facing API. Это предотвращает частичный login, который создаёт Supabase session, но ошибочно выполняет existing MySQL tRPC operations.
