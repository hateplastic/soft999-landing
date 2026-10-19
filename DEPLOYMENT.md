# Soft 99.9 — состояние подключения

Сайт: https://soft999.app/. Бот: @soft999acess_bot. Supabase: xlqakmypiusfrqymsqog.

## Подтверждено 19 октября 2026

Миграция supabase/202610190001_billing.sql применена. Таблицы закрыты RLS; пользователь не меняет тариф. Сайт не меняет привязку устройства. Обработчик soft-billing развёрнут; legacy JWT отключён только для него. Telegram проверяется секретным заголовком, Tribute — HMAC-SHA256 исходного тела.

Bot token и webhook secret сохранены в Supabase, webhook Telegram зарегистрирован. Ключ Tribute сохранён только в Supabase и проверен через API каталога (HTTP 200). Тариф Soft 999 Pro: subscriptionId 275353, periodId 520462, monthly, 4 EUR. Каталог возвращает цену 4, webhook — 400 в минимальных единицах. TRIBUTE_SUBSCRIPTION_ID=275353 сохранён.

Установщик Windows beta 0.2.0 с Python, Node, Chromium и FFmpeg: https://github.com/hateplastic/soft999-landing/releases/tag/v0.2.0-beta.1. Сертификата подписи издателя нет.

## Оставшиеся действия

1. В Tribute → Settings → API Keys сохранить Webhook URL: https://xlqakmypiusfrqymsqog.supabase.co/functions/v1/soft-billing/tribute. Не заменять адрес другого проекта без проверки назначения.
2. После подтверждения настройки установить серверный секрет BILLING_CHECKOUT_ENABLED=true. До этого checkout закрыт; привязка Telegram доступна отдельно. Приём подписанных webhook не зависит от этого флага.
3. Войти на сайт, подтвердить Telegram через код бота, оплатить из того же Telegram-аккаунта. Реальный платёж выполняет владелец. Проверить processed, paid_until, Pro в кабинете и Windows-клиенте. Реальный платёж пока не проверен.
4. Настроить SMTP для регистрации и восстановления внешних email. Подтверждение email не отключать.
5. Проверить установку на отдельной чистой Windows, Free, отказ второго устройства и возврат к Free после истечения подписки.

## Исходники и проверки

supabase/handler.mjs — канонический обработчик; supabase/soft-billing-dashboard.ts — тот же код с Deno.serve для Dashboard. npm test: 9 проверок каталога, HMAC, операторской авторизации, checkout и событий. npm run check и npm run build проверяют сайт. SQL regression-тест supabase/billing-database.sql выполняется с ROLLBACK; облачный прогон завершился PASS.

Защищённый POST /setup (или корень функции в Dashboard Test) принимает {"action":"subscriptions"} либо {"action":"telegram"}. Авторизация — service_role Bearer либо default secret key из SUPABASE_SECRET_KEYS в apikey. Публичные ключи не принимаются. Секреты не помещать в GitHub или клиент.

Продление не уменьшает оплаченный срок, отмена сохраняет оплаченные дни. Повторы идемпотентны. Другие тарифы, подарки, trial и события без Telegram ID уходят в review без выдачи Pro. Возвраты требуют операторской проверки; автоматический refund-процесс не реализован. Наличие ключей и health не заменяют проверку доставки и реального платежа.
