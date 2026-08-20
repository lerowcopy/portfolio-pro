# Live endpoint verification

Проверка выполнена 20 августа 2026 года после создания checkpoint `60f86432`.

| Endpoint | Результат | Ограничение проверки |
| --- | --- | --- |
| `https://portfolio-pro-production-113c.up.railway.app/healthz` | Ответ: `{"ok":true,"runtime":"external"}` | Подтверждает доступность external Railway API, но не проверяет текущую версию приложения или секреты окружения. |
| `https://portfolio-pro-virid.vercel.app/` | Landing page загружается | Страница по-прежнему содержит прежний текст об autosave, поэтому Vercel ещё не содержит checkpoint с явной панелью сохранения. |

Для приёмки checkpoint `60f86432` требуется redeploy Vercel из основной ветки, а затем проверка редактора в авторизованной Supabase-сессии.
