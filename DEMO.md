# Interactive client preview

The landing demo is a standalone, in-memory UI (`src/demo.js`, `src/demo.css`), not a running client. It makes no API calls and accepts no account/session uploads. All sample activity counters are zero. Connection, start and import controls explain that these operations require the installed client.

Source mapping (assembled client Soft 99.9):
- Shell navigation: app/public/index.html.
- Telegram navigation, account limits, topics, channels and AI settings: modules/telegram/static/app.js.
- X profile, schedule, session limits, comment and like controls, templates and logs: modules/x/src/ui/public/index.html.
- Own X posts remain disabled, matching the client placeholder.

This is an interactive presentation of the tools, not an exhaustive reproduction of every client dialog. Keep new features tied to source before displaying them. RU/UK/EN labels are keyed in demo.js and follow the landing language picker. User-entered sample text stays as entered; Reset clears it. Nothing is persisted or transmitted.

Validation: npm run check, npm run build; Playwright exercised all sections in all three languages, account limit checkbox/save, proxy/topic/channel forms, English UI text, 390px viewport overflow and JavaScript errors. No live accounts or posting used.
