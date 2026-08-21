# Live endpoint verification

Проверка выполнена 20 августа 2026 года после создания checkpoint `60f86432`.

| Endpoint | Результат | Ограничение проверки |
| --- | --- | --- |
| `https://portfolio-pro-production-113c.up.railway.app/healthz` | Ответ: `{"ok":true,"runtime":"external"}` | Подтверждает доступность external Railway API, но не проверяет текущую версию приложения или секреты окружения. |
| `https://portfolio-pro-virid.vercel.app/` | Landing page загружается | Страница по-прежнему содержит прежний текст об autosave, поэтому Vercel ещё не содержит checkpoint с явной панелью сохранения. |

После redeploy checkpoint `696e9582` 21 августа 2026 года Vercel landing page начала отображать новый текст **Always in control** и описание явного сохранения. В авторизованной Supabase-сессии Dashboard загрузил три portfolio cards с корректной датой `Updated Aug 20`, а редактор portfolio `a6ba5602-1112-44ec-a911-7b1d1802b8d1` открылся с выбранными значениями `Gallery`, `Purple`, `Inter` и соответствующим live preview.

Live-проверка панели несохранённых изменений завершена с подтверждением пользователя. В поле названия portfolio было временно внесено значение `Belyakov Michail — проверка`. Live preview обновился мгновенно, без отправки формы; появилась нижняя панель **«Есть несохранённые изменения»** с действиями **«Отменить»** и **«Сохранить»**. После выбора **«Отменить»** исходное название `Belyakov Michail` и live preview были восстановлены, а панель исчезла. Изменение не было сохранено в опубликованные данные.

Для проверки cross-user authorization создан временный QA-аккаунт с согласованным пользователем email. Supabase потребовал подтвердить адрес электронной почты; до подтверждения вход и независимая проверка запрета доступа к исходным portfolio невозможны.

После подтверждения QA-аккаунт успешно вошёл в приложение. Его Dashboard оказался пустым и не содержал три portfolio исходного пользователя. Прямой переход по известному editor URL исходного portfolio `a6ba5602-1112-44ec-a911-7b1d1802b8d1` завершился нейтральным сообщением **This portfolio could not be found**, без раскрытия данных. Это подтверждает live read-level ownership isolation; parameterized write-path ownership checks дополнительно покрыты server unit tests.

## Production environment verification without secret disclosure

| Variable | Required non-secret format | Live evidence |
| --- | --- | --- |
| Railway `SUPABASE_DATABASE_URL` | `postgresql://postgres.<project-ref>:<URL-encoded-password>@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`; password percent-encodes reserved URL characters such as `@`, `:`, `/`, `?`, `#`, `%` and `&`. | Railway `/healthz` returns `{"ok":true,"runtime":"external"}` and authenticated portfolio read routes complete successfully, proving the deployed API can establish the configured PostgreSQL connection. |
| Vercel `VITE_SUPABASE_URL` | HTTPS project URL in the form `https://<project-ref>.supabase.co`; it must never be a PostgreSQL URI. | Live signup, email confirmation and two independent Supabase sign-ins completed from the published Vercel SPA. |

The live tests above provide deployment evidence without committing connection strings, passwords or client keys.

## Vercel deployment metadata

Read-only Vercel project inspection confirmed that project `portfolio-pro` is linked to GitHub repository `lerowcopy/portfolio-pro`. Its latest production deployment `dpl_CafAdY2ZDCdBc9ZB4ev8wicB1XYr` is in `READY` state, targets `production`, and was built from `main` commit `6ce7653a7c369c4baaa4ebdcee2d587e42149415`. This verifies that the published SPA contains the checked-in acceptance evidence and the latest live-tested implementation.

The project owner completed an in-dashboard verification without disclosing credentials: Railway `SUPABASE_DATABASE_URL` uses the required Session Pooler structure and password encoding, while Vercel Production `VITE_SUPABASE_URL` matches the HTTPS Supabase project URL. The current Vercel production deployment is Ready.
