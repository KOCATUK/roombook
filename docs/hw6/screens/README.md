# Скриншоты ДЗ6

Все скриншоты сделаны пользователем 2026-10-17 (время МСК). На скриншотах 05 и 12b замазано имя профиля Windows
в путях, на 10a замазан адрес электронной почты. Токенов и ключей на скриншотах нет.

| Файл | Что показывает | Шаг ДЗ6 |
|---|---|---|
| 01a_actions_ci_green.png | GitHub → Actions: запуск «CI #1» для коммита `632b6af` завершён успешно (28 с) | 1. CI/CD |
| 02a_vercel_deployments.png | Vercel → Deployments: деплои `632b6af` и `d46cb26` в статусе Ready, Production, ветка main (автодеплой по пушу) | 1. CI/CD |
| 02b_vercel_deployment_detail.png | Vercel: детали деплоя `632b6af`, домен `roombook-myp1.vercel.app`, источник main | 1. CI/CD |
| 03a_vercel_login_ok.png | Приложение на Vercel после входа через GitHub (аккаунт KOCATUK) | 3. OAuth2 (GitHub) |
| 03b_vercel_booking_created_network_201.png | После входа создана бронь: запрос `POST bookings` вернул 201, preflight прошёл | 3. OAuth2, 2. Безопасность |
| 04a_console_no_csp_errors.png | Консоль браузера на проде с включённой CSP: ошибок «Refused to…» нет; предупреждение Edge про цепочку редиректов к CSP не относится | 2. Безопасность |
| 04b_login_and_booking_after_csp.png | Цепочка входа (`authorize → callback → token`) и создание брони на проде после добавления CSP | 2. Безопасность |
| 05_db_push.png | `supabase db push --dry-run` и `supabase db push`: применена миграция `20261017093831_harden_bookings_profiles` | 2. Безопасность |
| 06_harden_check_7_of_7.png | SQL Editor: результат блока 3 `harden_check.sql`, семь проверок прошли (S-02, S-03, S-04) | 2. Безопасность |
| 07a_health_ok.png, 07b_health_ok_second_call.png | `GET /api/health` на проде: `status: ok`, `supabase: ok`, `version: 0fdb06b` | 6. Мониторинг |
| 08_vercel_logs_json.png | Vercel → Logs: JSON-строки логов `/api/health` (ts, level, msg, route, request_id) | 7. Логирование |
| 09a_ga4_stream.png | Google Analytics: веб-поток `roombook-web`, адрес `https://roombook-myp1.vercel.app` | 4. Аналитика |
| 09b_ga4_realtime_events_1.png, 09c_ga4_realtime_events_2.png | GA4 → «В реальном времени»: события `login`, `booking_created`, `booking_cancelled` (и стандартные page_view, scroll, session_start и др.) | 4. Аналитика |
| 10_uptimerobot_monitor_up.png | UptimeRobot: монитор `roombook health` в статусе Up, 1 инцидент (40 мин 40 с) | 6. Мониторинг |
| 10a_uptimerobot_monitor_form.png | UptimeRobot: форма монитора (HTTP, интервал 5 минут, оповещение по e-mail; адрес замазан) | 6. Мониторинг |
| 10b_uptimerobot_incident_405.png | UptimeRobot: инцидент «405 Method Not Allowed» на `/api/health`, письмо отправлено (разбор: `docs/hw6/monitoring_incident.md`) | 6. Мониторинг |
| 12a_ai_ci_agent_summary.png | Claude Code: объяснение `ci.yml` по шагам и кто какие решения принял | Использование ИИ (CI/CD) |
| 12b_ai_security_audit_agent.png | Claude Code: итог аудита безопасности (таблица находок S-01…S-09, проверки) | Использование ИИ (аудит) |
| 12c_ai_ci_agent_checks.png | Claude Code: результаты `npm ci`, lint, tsc -b, test, build, audit для CI | Использование ИИ (CI/CD) |

## Чего в наборе нет (на момент сборки)

- Раскрытый запуск CI со схемой job `quality` и `audit` (есть только список запусков).
- Заголовки ответа с `Content-Security-Policy` на проде (в репозитории подтверждены только `vercel.json` и
  остальные заголовки при ручной проверке).
- Закрытый инцидент UptimeRobot (статус Resolved).
- Страница Supabase → URL Configuration с Redirect URLs.
