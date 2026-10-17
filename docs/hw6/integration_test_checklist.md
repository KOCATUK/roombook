# Чек-лист проверки интеграций (ДЗ6, шаг 8)

Дата: 2026-10-17. Продакшен: https://roombook-myp1.vercel.app.

Исполнитель:
- **агент** — ИИ-агент (Claude Code) выполнил команду в сессии и видел результат;
- **пользователь** — проверку выполнил пользователь вручную, результат взят с его слов или из его файлов;
- **не проверялось** — в сессии нет данных о проверке.

Скриншоты пользователя (`03_vercel_login_ok`, `08_vercel_logs`, `09_ga4_realtime`) указаны по имени файла; в репозиторий они не добавлены.

## CI/CD и развёртывание

| # | Что проверяли | Как | Результат | Кто | Файл |
|---|---|---|---|---|---|
| 1 | Workflow CI запускается на push в `main` и проходит | Публичный GitHub REST API `/repos/KOCATUK/roombook/actions/runs` | 8 прогонов (#1–#8, коммиты `632b6af`…`2ede83c`), все `completed/success`. Промежуточные коммиты одного пуша отдельно не запускались, это ожидаемо: concurrency и один прогон на пуш | агент | `.github/workflows/ci.yml` |
| 2 | Автодеплой на Vercel после push | Статусы коммитов через GitHub API (`/commits/<sha>/status`) | Для `2ede83c` и `3753601` статусы `Vercel – roombook` и `Vercel – roombook-myp1` = `success`. К репозиторию подключены два проекта Vercel; какой из них основной, не проверялось | агент | — |
| 3 | Продакшен работает на последнем коммите | `curl https://roombook-myp1.vercel.app/api/health`, поле `version` | `version: "2ede83c"` совпадает с `HEAD` на момент проверки | агент | — |
| 4 | Заголовки безопасности из `vercel.json` на проде | `curl -I https://roombook-myp1.vercel.app/` | Есть CSP (с хостами GA4), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; HSTS (`max-age=63072000; includeSubDomains; preload`) выставляет Vercel | агент | [../../security_audit.md](../../security_audit.md) |
| 5 | Сборка не нарушает CSP | Локальный сервер с заголовками из `vercel.json`, headless Edge, `?scenario=ok` | Страница отрисовалась (комнаты загружены), нарушений CSP в консоли 0. Прод в браузере агентом не открывался | агент | [optimization.md](optimization.md) |

## Вход и аналитика

| # | Что проверяли | Как | Результат | Кто | Файл |
|---|---|---|---|---|---|
| 6 | Вход через GitHub на Vercel | Вход на `https://roombook-myp1.vercel.app` через GitHub | Вход выполнен, пользователь в шапке | проверил пользователь вручную | скриншот `03_vercel_login_ok` |
| 7 | Логика отправки событий GA4 | Модульные тесты `src/lib/analytics.test.ts` (мок `gtag`) | Событие уходит через `gtag('event', …)` с `room_id` и `error_type`; `gtag.js` подключается один раз, без inline-скрипта; в тестах и в mock-режиме ничего не отправляется | агент | — |
| 8 | События `login`, `booking_created`, `booking_cancelled` в GA4 | Отчёт GA4 «В реальном времени» после входа, создания и отмены брони на проде | События `login`, `booking_created`, `booking_cancelled` пришли в GA4 | проверил пользователь вручную | скриншот `09_ga4_realtime` |

## API, мониторинг и логи

| # | Что проверяли | Как | Результат | Кто | Файл |
|---|---|---|---|---|---|
| 9 | `GET /api/health` | `curl -i https://roombook-myp1.vercel.app/api/health` | `200`, `Content-Type: application/json`, `Cache-Control: no-store`, `status: ok`, `supabase.status: ok`, `latencyMs: 514` | агент | — |
| 10 | `HEAD /api/health` | `curl -I …/api/health` | До исправления `405`. После исправления (`dd494d2`, выкачено деплоем `3753601`: у `dd494d2` своего статуса Vercel нет) — `200`, `Cache-Control: no-store` | агент | [monitoring_incident.md](monitoring_incident.md) |
| 11 | Инцидент UptimeRobot 405 | Монитор UptimeRobot, воспроизведение через `curl`, исправление, наблюдение за монитором | Причина — нет обработчика HEAD. Инцидент 10:33:15–≈11:13 МСК, 40 мин 40 с, закрыт | пользователь (монитор и закрытие), агент (воспроизведение и исправление) | [monitoring_incident.md](monitoring_incident.md) |
| 12 | `/api/log` на проде | `curl -X POST` с корректным событием, с `level: info`, затем `GET` | `204`, `400`, `405`. В журналы прода попало одно тестовое событие `warn` с текстом «integration check from agent» | агент | — |
| 13 | Формат JSON-логов функций | Функции из `api/` собраны в ESM и вызваны в Node; модульные тесты `api/_tests/*.test.ts` | Одна JSON-строка на событие: `ts`, `level`, `msg`, `route`, `request_id`, `latencyMs`; ключей, URL и текстов ошибок в строках нет | агент | — |
| 14 | JSON-логи `/api/health` в Vercel → Logs | Панель Vercel → Logs | JSON-строки логов `/api/health` видны в панели | проверил пользователь вручную | скриншот `08_vercel_logs` |
| 15 | Клиент отправляет `error` через `sendBeacon` на проде | Модульные тесты `src/lib/logger.test.ts` | В тестах: только `error` и только в production. В браузере на проде не проверялось | агент (тесты) | — |
| 21 | Анализ логов Supabase | Экспорт логов Supabase, обезличенная выгрузка, разбор скриптом `analyze_logs.mjs` | Находки L-01–L-04; по L-01 выход переведён на `scope: 'local'` (`bcf0929`) | проверил пользователь вручную | [log_analysis/log_analysis.md](log_analysis/log_analysis.md) |

## База данных

| # | Что проверяли | Как | Результат | Кто | Файл |
|---|---|---|---|---|---|
| 16 | RLS и права (ДЗ5) | Дымовой тест `scripts/api-smoke.mjs` с `ACCESS_TOKEN` | PASS 13 / FAIL 0 / WARN 1 | пользователь (ДЗ5) | `docs/hw5/smoke_output.txt` |
| 17 | Миграция S-02..S-04 на реальной БД | Блок 3 `harden_check.sql` в Supabase SQL Editor | 7 из 7 совпали с ожиданием (23514 для времени и `avatar_url`, 42501 для UPDATE профиля) | пользователь | [harden_check_result.md](harden_check_result.md), [harden_check.sql](harden_check.sql) |
| 18 | Проверки 19–22 дымового теста (REST) | — | Не проверялось: с `ACCESS_TOKEN` после миграции скрипт не запускался | не проверялось | — |
| 19 | Блоки 1–2 `harden_check.sql` | — | Не проверялось (не передавались). Косвенно: миграция применилась, значит, CHECK по существующим строкам прошёл | не проверялось | [harden_check.sql](harden_check.sql) |

## Зависимости

| # | Что проверяли | Как | Результат | Кто | Файл |
|---|---|---|---|---|---|
| 20 | Уязвимости зависимостей | `npm audit` | 0 уязвимостей | агент | [npm_audit.txt](npm_audit.txt) |
