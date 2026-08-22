# Проверка локализации интерфейса

В dev-версии протестирован переключатель языка в шапке landing page. При выборе `RU` интерфейс без перезагрузки переключил заголовок, CTA, описание, карточки преимуществ и aria-label переключателя темы на русский язык. Состояние `RU` отмечается как выбранное в доступной группе кнопок и сохраняется в `localStorage` под ключом `portfolio-pro.locale`.

Выбор `EN` остаётся доступен в той же группе и использует английский вариант словаря. Переключатель показан на landing page, Dashboard и страницах внешней авторизации; ключевые статусы editor save bar, карточки portfolio и общие public-template primitives используют активный язык.

Дополнительно переключатель расположен в chrome `PortfolioPreview`, поэтому он доступен непосредственно из editor preview и публичной template gallery. Визуальная проверка галереи подтвердила, что control не перекрывает название выбранного шаблона и сохраняет клавиатурную доступность через две кнопки `aria-pressed`.

Полный editor использует locale-aware mapping для отображаемых ошибок валидации title, image URL, дублирующихся социальных платформ и email. Названия шрифтов `Inter`, `Playfair`, `Georgia` и названия социальных сетей остаются одинаковыми в RU/EN как продуктовые имена; они явно зафиксированы тестом `editorValidation.test.ts`. Названия шаблонов и цветовые схемы переводятся в UI.

После Vercel redeploy опубликованная landing page и Dashboard содержат переключатель RU/EN. Текущая browser session находится во временном QA-аккаунте с пустым Dashboard, поэтому для live-приёмки полного editor нужно войти в исходный аккаунт, которому принадлежит portfolio.

Live-приёмка завершена на portfolio `Belyakov Michail` после Vercel redeploy. При переключении editor с EN на RU без изменения данных локализовались шапка, Projects, Save, profile section, labels Avatar/Logo, upload helper text, public URL, template/color labels, social links, publication block и aria-label возврата. Названия шрифтов и брендов социальных сетей намеренно остаются инвариантными как продуктовые имена. Публичный preview остаётся локализованным в объёме общих template primitives; пользовательский portfolio content и часть template-specific editorial copy не изменяются переключателем редактора.
