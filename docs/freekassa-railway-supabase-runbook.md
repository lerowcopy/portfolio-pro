# FreeKassa: `portfolio-pro.ru` на Vercel и callback на Railway

Ваша текущая схема должна оставаться разделённой: **`portfolio-pro.ru` обслуживает Vercel**, потому что там опубликован интерфейс Portfolio Pro; **Railway обслуживает API и Result URL FreeKassa**. FreeKassa не требует, чтобы Result URL и сайт оплаты были на одном домене. Поэтому Railway не нужно подключать к корневому домену `portfolio-pro.ru` — это создало бы DNS-конфликт с Vercel.

> Рекомендуемый branded-вариант: `https://portfolio-pro.ru` на Vercel и `https://api.portfolio-pro.ru` на Railway. У каждого сервиса будет собственный домен и сертификат, но оба останутся частью одного продукта.

| Назначение | Рекомендуемый URL | Где настраивается |
| --- | --- | --- |
| Пользовательский сайт, login, Dashboard, редактор | `https://portfolio-pro.ru` | Vercel |
| Success / failure page после оплаты | `https://portfolio-pro.ru/billing/success` и `/billing/cancelled` | Vercel SPA — добавить при создании pricing UI |
| Result URL / подписанный callback | `https://api.portfolio-pro.ru/api/billing/freekassa/webhook` | Railway |
| Временный callback до настройки `api` | `https://portfolio-pro-production-113c.up.railway.app/api/billing/freekassa/webhook` | Railway-provided domain |

## Важное различие: Vercel и Railway не должны владеть одним root domain

Vercel уже владеет `portfolio-pro.ru`. Оставьте там root/apex domain и, если настроен, `www`. Vercel для apex использует A record, а для subdomain — CNAME; точные значения всегда показываются в интерфейсе project domain settings [1]. Railway также поддерживает custom domains и автоматически выпускает TLS, но для каждого custom domain просит **оба** DNS record: routing CNAME и verification TXT [2].

Поэтому не добавляйте `portfolio-pro.ru` в Railway. Добавьте только `api.portfolio-pro.ru`.

## Вариант A — рекомендованный: `api.portfolio-pro.ru` для Railway

### 1. Сохраните домен сайта на Vercel

В Vercel откройте **Portfolio Pro → Settings → Domains**. Убедитесь, что `portfolio-pro.ru` имеет статус **Valid Configuration** и назначен Production environment. Ничего не меняйте в существующей записи root domain ради Railway.

### 2. Добавьте subdomain в Railway

В Railway откройте API service Portfolio Pro → **Settings → Networking → Public Networking → + Custom Domain**. Введите:

```text
api.portfolio-pro.ru
```

Выберите порт приложения Railway. В текущем приложении это переменная `PORT`, которую Railway уже определяет автоматически; обычно service listener работает на `8080` в deployment container. Railway покажет **два уникальных значения** — не копируйте примеры из документации и не используйте старые targets:

| DNS record | Что взять из Railway | Где создать |
| --- | --- | --- |
| CNAME | routing target, обычно похожий на `…up.railway.app` | DNS provider, name `api` |
| TXT | verification token / hostlabel из Railway | DNS provider, строго как показано |

Railway подтверждает домен только когда настроены CNAME **и** TXT; без TXT запросы могут возвращать `404`, даже если CNAME уже резолвится [2] [3]. Дождитесь в Railway зелёного статуса verification и выпущенного certificate.

### 3. Если DNS управляется Vercel

В Vercel откройте **Domains → portfolio-pro.ru → DNS Records** и создайте именно записи, которые показал Railway:

```text
Type: CNAME
Name: api
Value: <Railway routing target>

Type: TXT
Name: <Railway verification hostlabel>
Value: <Railway verification token>
```

Если DNS у регистратора или Cloudflare, создавайте их там. Не заменяйте текущий A/CNAME root domain, направляющий сайт в Vercel. При Cloudflare оставьте `api` в DNS-only до успешной Railway verification; затем используйте настройки Railway для Cloudflare только при необходимости proxy.

### 4. Проверьте HTTPS до FreeKassa

После статуса **Verified / Issued** в Railway откройте:

```text
https://api.portfolio-pro.ru/healthz
```

Ожидаемый ответ:

```json
{"ok":true,"runtime":"external"}
```

Не переходите к FreeKassa до ответа `200` и валидного HTTPS certificate.

### 5. Внесите URLs в кабинет FreeKassa

В настройках магазина FreeKassa укажите следующие значения:

| Поле FreeKassa | Значение |
| --- | --- |
| URL сайта | `https://portfolio-pro.ru` |
| URL оповещения / Result URL | `https://api.portfolio-pro.ru/api/billing/freekassa/webhook` |
| Метод оповещения | `POST` |
| URL успеха | `https://portfolio-pro.ru/billing/success` |
| URL неудачи | `https://portfolio-pro.ru/billing/cancelled` |
| Подтверждение заявки | Включить |

FreeKassa отправляет в Result URL form-data успешного платежа; обработчик должен проверить `SIGN` по `merchant:amount:secret word 2:merchant order id` и вернуть строку `YES` после успешной обработки [4]. Эта логика уже подготовлена в `server/external/freekassaWebhook.ts`.

## Вариант B — быстрее: оставить Railway domain для Result URL

Если `api.portfolio-pro.ru` пока не нужен, callback можно безопасно оставить на:

```text
https://portfolio-pro-production-113c.up.railway.app/api/billing/freekassa/webhook
```

При этом в FreeKassa **URL сайта**, success и failure URLs всё равно будут `https://portfolio-pro.ru/...`. Это не компромисс безопасности: callback защищён подписью FreeKassa, а `up.railway.app` имеет HTTPS. Вариант подходит для тестового режима и не требует изменений DNS.

## Server-only переменные Railway

В Railway → **Variables** добавьте реальные значения. Не передавайте их в Vercel client environment и никогда не используйте префикс `VITE_`.

```dotenv
PUBLIC_APP_URL=https://portfolio-pro.ru
FREEKASSA_SHOP_ID=ваш_id_магазина
FREEKASSA_SECRET_WORD_1=секрет_для_платёжной_формы
FREEKASSA_SECRET_WORD_2=секрет_для_result_url
FREEKASSA_API_KEY=ваш_api_ключ_для_будущих_рекуррентных_списаний
FREEKASSA_STARTER_AMOUNT_KOPEKS=49000
FREEKASSA_PRO_AMOUNT_KOPEKS=99000
FREEKASSA_BUSINESS_AMOUNT_KOPEKS=199000
FREEKASSA_ENFORCE_IP_ALLOWLIST=false
```

После добавления Railway variables выполните redeploy Railway. `FREEKASSA_ENFORCE_IP_ALLOWLIST` оставьте `false` для первого теста: Railway reverse proxy может менять observed source IP. Включайте allowlist только после успешного test callback и проверки заголовков/маршрута.

## Что делать после настройки domain

Reconciliation migration `supabase/migrations/20260822000600_reconcile_freekassa_billing.sql` применена и проверена: `billing_orders`, `billing_webhook_events`, `subscriptions.source_order_id`, foreign keys, unique `freekassa_intid` и RLS находятся на месте. Следующий шаг — добавить Railway variables, redeploy API, включить test mode FreeKassa и провести test payment. Успешный signed Result URL должен вернуть `YES`, пометить order как `paid` и создать/обновить row `subscriptions`. Return URL браузера сам по себе доступ не выдаёт.

### Последняя проверка Railway

После redeploy Railway `GET https://portfolio-pro-production-113c.up.railway.app/healthz` вернул `{"ok":true,"runtime":"external"}`. Открытие callback URL через **GET** вернуло ожидаемый `404`, потому что callback намеренно зарегистрирован только как `POST /api/billing/freekassa/webhook`; это не означает ошибку маршрута. Следующая проверка — signed test callback через FreeKassa test mode.

Проверка отрицательного сценария проведена: POST с заведомо недействительными merchant, amount, order ID и signature вернул `400 INVALID`. Поэтому endpoint доступен и не принимает неподписанные уведомления; запись order или subscription при этом не создавалась.

Read-only aggregate audit после этой проверки подтвердил: `billing_orders = 0`, `billing_webhook_events = 0`, `subscriptions = 0`. Тест не оставил платёжных или пользовательских данных.

## References

[1]: https://vercel.com/docs/domains/working-with-domains/add-a-domain "Vercel: Adding and Configuring a Custom Domain"
[2]: https://docs.railway.com/networking/domains/working-with-domains "Railway: Working with Domains"
[3]: https://docs.railway.com/integrations/api/manage-domains "Railway: Manage Domains with the Public API"
[4]: https://docs.freekassa.net/ "Официальная документация FreeKassa API и SCI"
