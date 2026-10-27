# Landing update — 27 October 2026

The landing now explains Telegram/X features, first-run requirements, Free/Pro differences and Windows-only installation. Support is https://t.me/mixininparadise. Client binaries and functionality were not changed.

Contact configuration: `src/config.js` contains `supportUrl` and `socialLinks`. Add social destinations as `{ "label": "Channel name", "url": "https://..." }`. Only valid HTTPS links render; an empty list leaves no placeholder block. The support handle shown in `src/index.html` should also be updated when changing the contact.

New page layout: `src/redesign.css`. All new public copy is translated in `src/i18n.js`. Locale switching retains original text per node, avoiding ambiguous reverse translation. Public Pro copy does not depend on an anonymous account's billing state; actual checkout checks in the account remain in place.

Validation: check/build passed; 9 billing tests passed; browser checks covered RU/UK/EN, 320/390/768/1024/1440px layouts, mobile menu, clipboard link, module preview tabs, account dialog and a mocked download. Repeated language switching preserves Pro and the checkout gate. No live registration, payment or messaging was performed. Demo events remain labelled as examples.

---

# Soft 99.9 — сайт и кабинет

Сайт: https://soft999.app/. GitHub main автоматически развёртывается в Vercel. Веб-сборка содержит только src/: модули Telegram/X, Python и пользовательские данные не попадают на хостинг.

Windows-клиент опубликован отдельно: [0.2.0 beta](https://github.com/hateplastic/soft999-landing/releases/tag/v0.2.0-beta.1). Установщик включает Python, Node.js, Chromium и библиотеки. Это предварительный релиз: SMTP, реальная оплата и проверка на отдельной чистой Windows ещё требуют завершения. Проверены установка, запуск обоих модулей без реальных аккаунтов и удаление с сохранением данных. Цифровой подписи издателя пока нет.

## Разработка

Node.js 20+, сторонние npm-зависимости сайту не нужны.

```
npm run dev
npm run check
npm test
npm run build
```

Предпросмотр: http://127.0.0.1:4173/. Vercel публикует dist/, build command — node scripts/build.mjs. src/config.js содержит публичный ключ Supabase и URL установщика. Серверные ключи, аккаунты и бинарники в Git не добавлять.

## Кабинет и подписка

Supabase Auth: email/пароль, регистрация, подтверждение и восстановление. Токены хранятся только в памяти вкладки. Вход на сайте не занимает слот устройства; его привязывает Windows-клиент. Free — один Telegram и один X, Pro — 4 EUR/месяц плюс комиссия Tribute.

Сначала пользователь подтверждает Telegram через @soft999acess_bot: одноразовая ссылка из кабинета → код бота → ввод кода на сайте. Затем оплачивает Tribute из того же Telegram-аккаунта. Оплаченный срок меняет только сервер после проверки HMAC-подписи события. Повторы не продлевают срок повторно, отмена продления сохраняет оплаченные дни, истечение возвращает Free. Кнопка оплаты скрыта до явного включения BILLING_CHECKOUT_ENABLED после настройки webhook. Привязка Telegram доступна отдельно.

Серверные исходники и инструкции: [DEPLOYMENT.md](DEPLOYMENT.md). Миграция supabase/202610190001_billing.sql применена, функция soft-billing развёрнута. Самодостаточный исходник для Dashboard — supabase/soft-billing-dashboard.ts. Серверный код не входит в статическую сборку сайта.

Токен бота, API-ключ Tribute и subscription ID 275353 уже настроены; API Tribute проверен. Для завершения запуска остаются подтверждение webhook Tribute, включение checkout, SMTP и реальный тест оплаты. Секреты вводятся непосредственно в Supabase. Реальный платёж выполняет владелец; до его проверки нельзя считать оплату готовой. Подтверждение email не отключать в обход SMTP.

## Проверки

- npm run check: синтаксис, Auth API, отсутствие привязки браузера и постоянного хранения токенов.
- npm test: подпись Tribute, фильтр подписки/валюты/суммы, повторы, отмена, защита служебного и Telegram-маршрутов.
- supabase/billing-database.sql: проверка БД внутри транзакции с ROLLBACK, без сохранения тестовых пользователей и без отправки писем.

Изображённые на лендинге события помечены как демонстрация. Личные скриншоты, email, идентификаторы устройства, cookies и сессии не публикуются.

