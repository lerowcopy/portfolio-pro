# FreeKassa: подключение к Portfolio Pro

Этот runbook относится к текущей внешней архитектуре проекта: Vercel публикует SPA, Railway выполняет Express API, а Supabase PostgreSQL хранит статусы заказов и подписок. В этой схеме **Result URL FreeKassa указывает прямо на Railway**, а не на Vercel SPA:

```text
https://portfolio-pro-production-113c.up.railway.app/api/billing/freekassa/webhook
```

FreeKassa SCI передаёт в Result URL успешного платежа form-data с `MERCHANT_ID`, `AMOUNT`, `intid`, `MERCHANT_ORDER_ID` и `SIGN`. Подпись callback формируется как MD5 от `MERCHANT_ID:AMOUNT:SecretWord2:MERCHANT_ORDER_ID`; для подтверждённой доставки сервис ожидает текст `YES` [1]. В подготовленном обработчике эти правила проверяются до изменения доступа пользователя.

## Что уже подготовлено в проекте

| Компонент | Файл | Назначение |
| --- | --- | --- |
| Проверка подписи и суммы | `server/external/freekassa.ts` | Строгая parse/verify логика, constant-time comparison, перевод суммы в копейки без float-ошибок. |
| Result URL handler | `server/external/freekassaWebhook.ts` | Transactional callback, проверка merchant/amount, idempotency по `intid`, ответ `YES`. |
| Railway route | `server/app.ts` | `POST /api/billing/freekassa/webhook` только для external runtime. |
| Billing migration | `supabase/migrations/20260822000500_add_freekassa_billing.sql` | `billing_orders`, `billing_webhook_events`, `subscriptions`, RLS и индексы. |
| Security tests | `server/external/freekassa.test.ts` | Проверяют валидную подпись, tampering и точность денежных сумм. |

> Webhook не выдаёт доступ по return URL пользователя. Только подтверждённый Result URL с корректной подписью переводит заказ в `paid` и активирует subscription.

## Шаг 1. Настройте магазин FreeKassa

В кабинете FreeKassa откройте настройки магазина и укажите URL сайта, **Secret Word 1**, **Secret Word 2**, Result URL и метод Result URL `POST`. В Result URL установите Railway endpoint выше. Включите подтверждение заявки, чтобы FreeKassa повторяла уведомление, пока не получит `YES` [1]. Для первичной проверки используйте тестовый режим магазина.

| Поле в кабинете | Значение |
| --- | --- |
| URL оповещения / Result URL | `https://portfolio-pro-production-113c.up.railway.app/api/billing/freekassa/webhook` |
| Метод оповещения | `POST` |
| URL успеха | `https://portfolio-pro-virid.vercel.app/billing/success` — страницу нужно добавить вместе с checkout UI |
| URL неудачи | `https://portfolio-pro-virid.vercel.app/billing/cancelled` — страницу нужно добавить вместе с checkout UI |
| Подтверждение заявки | Включить; обработчик возвращает `YES` после commit |

FreeKassa рекомендует также сверять IP отправителя. Код поддерживает allowlist их опубликованных IP; включайте её только после проверки сетевой цепочки Railway, потому что reverse-proxy может изменять видимый source IP [1].

## Шаг 2. Добавьте server-only переменные Railway

В Railway → **Variables** добавьте значения ниже. Не добавляйте имена с `VITE_`: такие переменные попадают в браузерный bundle.

```dotenv
FREEKASSA_SHOP_ID=ваш_id_магазина
FREEKASSA_API_KEY=ваш_api_key
FREEKASSA_SECRET_WORD_1=секрет_для_создания_платёжной_формы
FREEKASSA_SECRET_WORD_2=секрет_для_result_url
FREEKASSA_PAYMENT_SYSTEM_ID=42
FREEKASSA_STARTER_AMOUNT_KOPEKS=49000
FREEKASSA_PRO_AMOUNT_KOPEKS=99000
FREEKASSA_BUSINESS_AMOUNT_KOPEKS=199000
FREEKASSA_ENFORCE_IP_ALLOWLIST=false
PUBLIC_APP_URL=https://portfolio-pro-virid.vercel.app
```

`FREEKASSA_PAYMENT_SYSTEM_ID` должен соответствовать методу, разрешённому вашему магазину; не фиксируйте значение из примера без проверки в FreeKassa. API создания заказа использует серверный HMAC-SHA256 с API key, а SCI payment form — Secret Word 1 [1].

## Шаг 3. Примените миграцию Supabase

Откройте Supabase → **SQL Editor**, вставьте содержимое migration `20260822000500_add_freekassa_billing.sql` и выполните его один раз. Миграция создаёт три таблицы:

| Таблица | Хранит | Защита |
| --- | --- | --- |
| `billing_orders` | ожидаемые платежи и связанного пользователя | Пользователь видит только свои записи; создавать/обновлять может server route. |
| `billing_webhook_events` | минимальный audit trail callback без PII payload | Нет client grants; `freekassa_intid` уникален. |
| `subscriptions` | текущий plan и дату окончания доступа | Пользователь видит только собственный entitlement. |

Не сохраняйте целиком `P_EMAIL`, `P_PHONE` и `payer_account` callback в базе: они не требуются для выдачи доступа.

## Шаг 4. Создайте checkout procedure

Перед redirect на FreeKassa сервер должен:

1. Получить authenticated Supabase UUID из external tRPC context.
2. Принять только допустимый `plan` (`starter`, `pro`, `business`), определив цену **на сервере** из `FREEKASSA_*_AMOUNT_KOPEKS`.
3. Создать `billing_orders` со статусом `pending`, UUID order ID, суммой в копейках и периодом подписки.
4. Вызвать `POST https://api.fk.life/v1/orders/create` с server-side API key и вернуть только `location` — URL оплаты.
5. Перенаправить браузер на этот URL. Нельзя принимать `amount`, `userId` или `plan price` как доверенный клиентский факт.

API FreeKassa ожидает HMAC-SHA256: отсортируйте значения параметров по ключу, соедините через `|` и подпишите API key. Для рекуррентной первой оплаты передайте `recurrent: "Y"`, `recurrent_period: "month"` и описание; последующие списания используют `recurrent_order_id` из ответа первой операции [1].

## Шаг 5. Проверьте callback безопасно

Сначала используйте тестовый режим FreeKassa. Для теста callback создайте pending order через будущую checkout procedure, затем завершите тестовую оплату. Ожидаемый результат:

| Проверка | Ожидаемый результат |
| --- | --- |
| Корректный `SIGN` и сумма | HTTP `200`, body `YES`, order `paid`, subscription `active`. |
| Повторная доставка с тем же `intid` | HTTP `200`, body `YES`, без второго продления. |
| Неверный `SIGN` / merchant / сумма | HTTP `400`, body `INVALID`, subscription не меняется. |
| Успех Return URL без Result URL | Доступ не выдаётся. |

## Шаг 6. Добавьте billing UI и entitlement enforcement

После webhook foundation нужны отдельные product changes: pricing page, `billing.checkout` tRPC procedure, success/cancel routes, процедура `billing.me` и guards для Pro/Business функций. Только после этого включайте FreeKassa в production mode.

## Безопасность и operational правила

| Правило | Реализация |
| --- | --- |
| Секреты не в browser | `FREEKASSA_*` хранятся только на Railway; без `VITE_`. |
| Signature verification | MD5 callback вычисляется до database transaction; сравнение constant-time. |
| Idempotency | Уникальный `freekassa_intid` в `billing_webhook_events`. |
| Сумма authoritative | Сверяется с `expected_amount_kopeks` server-created заказа. |
| Не доверять redirect | Доступ выдаёт только signed Result URL. |
| Никакого PII audit payload | Сохраняются только IDs, сумма, method/commission metadata. |
| Быстрый ответ | Успех — `YES`; при ошибке не показываются секреты или SQL details. |

## References

[1]: https://docs.freekassa.net/ "Официальная документация FreeKassa API и SCI"
