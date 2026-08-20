# Supabase PostgreSQL migration

## Назначение

Файл `supabase/migrations/20260820000100_portfolio_pro_initial.sql` — это **новая внешняя schema**, а не изменение текущей managed MySQL базы Manus. Для уже созданного Supabase project используется `20260820000200_reconcile_existing_portfolio_schema.sql`: он не удаляет и не пересоздаёт существующие tables, а добавляет требуемые поля, индексы, trigger и hardened RLS policies.

> Не запускайте migration в текущей Manus database. Применяйте её только к новому Supabase project после создания backup и проверки в staging environment.

## Применение

После настройки `SUPABASE_DATABASE_URL` используйте контролируемые команды из корня repository:

```bash
pnpm supabase:migrate
pnpm supabase:verify
```

Первая команда записывает SHA-256 checksum migration в private schema и не применит повторно файл с тем же именем и другим содержимым. Вторая команда проверяет наличие ожидаемых tables, включённого RLS и каждого named policy. После этого запускайте policy baseline из `supabase/tests/0001_portfolio_rls.test.sql` в local Supabase environment с pgTAP. Database policy tests должны быть расширены вместе с каждой новой таблицей и каждым новым RLS rule.

## Гарантии схемы

| Область | Гарантия |
|---|---|
| Identity | `profiles.id` ссылается на immutable primary key `auth.users.id`; trigger создаёт profile при регистрации. |
| Ownership | `portfolios.owner_id` и связанные `portfolio_projects` используют UUID owner relationship. |
| Public access | Anon посетитель видит только `is_published = true` portfolios и связанные с ними проекты. |
| Private access | Authenticated owner может создавать, читать, менять и удалять только собственные records. |
| Privileges | `anon` не получает write grants; `authenticated` не может менять `profiles.role` из-за column-level grants. |

## Данные из текущего проекта

Автоматическая загрузка current MySQL data не включена. Перед cutover подготовьте отдельную controlled import job, который сопоставит Manus `users.openId` с новым Supabase `auth.users.id`. Нельзя переносить data простым SQL copy: прежние числовые user IDs и UUID Supabase не совместимы. В подключённом Supabase project reconciliation migration сохранила текущие tables и records: она не выполняет `drop table`, `truncate`, `delete` или column rename.

## Следующий этап

После review этой schema следует внедрить Supabase Auth в Express tRPC context и React client. До этого Railway foundation намеренно использует current Manus context и предназначен только для healthcheck/deployment smoke test.

## References

[1]: https://supabase.com/docs/guides/auth/managing-user-data "Supabase: User Management"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"
[3]: https://supabase.com/docs/guides/storage/security/access-control "Supabase: Storage Access Control"
