# Интеграции RoomBook (ДЗ6)

Приложение: https://roombook-myp1.vercel.app. Дата: 2026-10-17.

Источник каждого утверждения указан так:
- **агент** — ИИ-агент (Claude Code) проверил командой в сессии;
- **проверил пользователь** — пользователь проверил вручную, данные с его слов или с его скриншотов;
- **не проверялось** — данных о проверке нет.

Подробная таблица проверок: [docs/hw6/integration_test_checklist.md](docs/hw6/integration_test_checklist.md).

## 1. CI/CD (GitHub Actions)

Файл: [.github/workflows/ci.yml](.github/workflows/ci.yml), коммит `632b6af`.

**Триггеры:**
- `push` в `main`;
- `pull_request` в `main`;
- ручной запуск `workflow_dispatch`.

**Настройки:**
- `permissions: contents: read`: токену GitHub выдано только чтение;
- `concurrency` с `cancel-in-progress`: новый пуш в ту же ветку отменяет идущий прогон.

**Job `quality`** (ubuntu-latest, Node 24, кэш npm, таймаут 15 мин):

| Шаг | Команда |
|---|---|
| Установка | `npm ci` |
| Линтер | `npm run lint` |
| Типы | `npx --no-install tsc -b` |
| Тесты | `npm test` |
| Сборка | `npm run build` |

`VITE_SUPABASE_*` в CI не задаются: тесты и сборка идут на mock API, секреты пайплайну не нужны.

**Job `audit`** (таймаут 10 мин) запускает `npm audit --audit-level=high`. Job падает на уязвимостях уровня high и critical, `continue-on-error` нет.

**Что CI не проверяет:**
- **Форматирование.** Prettier в проекте нет. На шаге 1 агент проверил `npx prettier --check` с временным конфигом (без точек с запятой, одинарные кавычки) на 43 файлах `src` и `scripts`. Отличались 25 файлов при `printWidth` 80 и 15 при `printWidth` 100. Решение о добавлении Prettier оставлено пользователю, и пока Prettier не добавлен.
- **Дымовой тест** `scripts/api-smoke.mjs`: ему нужен настоящий Supabase.
- **Миграции БД** не применяются и не проверяются в CI.
- **Деплой.** CI не деплоит, этим занимается Vercel (раздел 2).

**Результат:** на момент написания 12 прогонов (#1–#12, по последний коммит `3701d4f`), все `completed/success` (агент, публичный GitHub API).

## 2. Деплой на Vercel

- Проект: `roombook-myp1`, адрес https://roombook-myp1.vercel.app.
- **Автодеплой по пушу в `main`:** у коммитов есть статусы `Vercel – roombook-myp1` = `success` (агент, GitHub API). Поле `version` в `/api/health` совпадает с последним запушенным коммитом: на момент написания `3701d4f` (агент).
- К репозиторию подключён ещё один проект Vercel, `roombook`: у коммитов есть и его статус. Для чего он нужен, не проверялось.
- Настройки сборки в `vercel.json` не задаются, их определяет Vercel. Функции из `api/` (`health.ts`, `log.ts`) Vercel разворачивает как serverless-функции; папки с префиксом `_` (`api/_lib`, `api/_tests`) маршрутами не становятся.

### Переменные окружения

Значения в репозитории и в этом документе не приводятся.

| Переменная | Где используется | Обязательна | Задана на Vercel |
|---|---|---|---|
| `VITE_SUPABASE_URL` | клиент (`src/lib/supabase.ts`), `api/health.ts` | да | да: `/api/health` на проде отвечает `supabase.status: ok` (агент) |
| `VITE_SUPABASE_ANON_KEY` | то же | да | то же |
| `VITE_GA_MEASUREMENT_ID` | `src/lib/analytics.ts` | нет: по умолчанию `G-4L0GDRVT5T` (публичный ID) | не проверялось |
| `LOG_LEVEL` | `api/_lib/log.ts`, порог логов функций | нет: по умолчанию `info` | не проверялось |
| `VERCEL_GIT_COMMIT_SHA` | `api/health.ts`, поле `version` | ставит Vercel | да: `version` на проде заполнен (агент) |

Ключ `service_role` не используется ни клиентом, ни функциями.

### Заголовки и CSP (`vercel.json`)

Для всех путей `/(.*)`:

| Заголовок | Значение (кратко) |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`. `script-src 'self' https://www.googletagmanager.com`. `style-src 'self'`. `img-src`: свой origin, аватары GitHub и Google, пиксели GA4. `connect-src`: `'self'`, `https://*.supabase.co`, домены GA4. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

- Для `/assets/(.*)` дополнительно задан `Cache-Control: public, max-age=31536000, immutable`: у этих файлов хэш в имени (см. [optimization.md](docs/hw6/optimization.md)).
- HSTS выставляет сам Vercel.
- Заголовки на проде проверены `curl -I` (агент).
- Куда добавлять хосты при новых интеграциях, описано в [security_audit.md](security_audit.md#verceljson-s-01), в абзаце «Куда добавлять новые источники».

## 3. Интеграции

### Вход через GitHub OAuth (Supabase Auth)

**Клиент**, `src/hooks/useAuth.ts`:
- вход вызывает `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })`;
- поток PKCE (`flowType: 'pkce'` в `src/lib/supabase.ts`);
- сессию отслеживает `onAuthStateChange`;
- выход вызывает `signOut({ scope: 'local' })`: завершает только текущую сессию (коммит `bcf0929`, по находке L-01 из анализа логов). Ответы «сессии уже нет» (401, 403, 404, `session_not_found`) ошибкой не считаются.

**GitHub:** OAuth App с Authorization callback URL `https://<project-ref>.supabase.co/auth/v1/callback`. Порядок настройки описан в [backend_documentation.md](backend_documentation.md#3-github-oauth-app).

**Supabase:** Authentication → Providers → GitHub (Client ID и Client Secret). Client Secret хранится только в Supabase.

**Redirect URLs** (Supabase → Authentication → URL Configuration):
- В репозитории (`backend_documentation.md`) записано `http://127.0.0.1:5173/**` для разработки.
- Для прода (источник: пользователь) в Redirect URLs добавлены `https://roombook-myp1.vercel.app/**` и `http://127.0.0.1:5173/**`. Site URL остался `http://127.0.0.1:5173`.
- Клиент передаёт `redirectTo` равным origin страницы, поэтому на проде Supabase возвращает пользователя на `https://roombook-myp1.vercel.app`: адрес подходит под шаблон из списка.
- Вход через GitHub на проде работает: проверил пользователь (скриншот `03_vercel_login_ok`).

**Профиль** создаёт триггер `handle_new_user` при первом входе. С ДЗ6 `avatar_url` проверяется CHECK-ограничением (`https://`, не длиннее 500 символов; находка S-04).

### Google Analytics 4

**Модуль:** `src/lib/analytics.ts`, Measurement ID `G-4L0GDRVT5T`.
- `gtag.js` подключается динамически из модуля, без inline-скрипта, потому что CSP запрещает inline.
- `initAnalytics()` вызывается из `src/main.tsx`.

**События:**

| Событие | Когда | Параметры |
|---|---|---|
| `login` | после возврата с GitHub в той же вкладке (флаг в `sessionStorage`, чтобы `SIGNED_IN` при возврате на вкладку не считался входом) | `method: 'github'` |
| `booking_created` | бронь создана | `room_id` |
| `booking_cancelled` | бронь отменена | `room_id` |
| `booking_failed` | ошибка создания брони | `room_id`, `error_type` (вид `AppError`: `conflict`, `validation`, `network` и т. п.) |

**Что не отправляется:**
- название встречи, `user_id`, e-mail, имя и токены. Тип `AnalyticsParams` закрыт: других полей в нём нет;
- текст ошибки: отправляется только её вид;
- события в тестах (`MODE === 'test'`) и в mock-режиме (`?scenario=…` или без настроенного Supabase).

**Проверка:**
- логика проверена модульными тестами `src/lib/analytics.test.ts` (агент);
- события `login`, `booking_created`, `booking_cancelled` в отчёте GA4 «В реальном времени» проверил пользователь (скриншот `09_ga4_realtime`);
- `booking_failed` в GA4 не проверялось.

### OAuth2 и вход через Google

- **Требование про OAuth2** закрыто входом через GitHub, настроенным в ДЗ5 (Supabase Auth, PKCE; см. выше).
- **Вход через Google** не делали: так решили пользователь и ИИ-ассистент в чате из-за нехватки времени (источник: пользователь).
- **Подготовка CSP** всё же сделана: в `img-src` добавлен `https://lh3.googleusercontent.com` для аватаров Google, а в [security_audit.md](security_audit.md#verceljson-s-01) (абзац «Куда добавлять новые источники») описано, что менять в CSP при входе через Supabase Auth или через Google Identity Services.

### Платежи

Пропущены: в приложении нет платежей и платёжных интеграций. В `Permissions-Policy` Payment Request API запрещён (`payment=()`).

## 4. Мониторинг

### `/api/health`

Файл `api/health.ts`.

**Что проверяет:** запрос к Supabase REST `rooms?select=id&limit=1` с publishable-ключом и таймаутом 3 с. Так проверяется весь путь: шлюз Supabase → PostgREST → Postgres.

**Методы:**
- **GET** возвращает JSON;
- **HEAD** выполняет ту же проверку и отвечает тем же статусом и заголовками, без тела (добавлен в `dd494d2` после инцидента).

**Ответ:** `200`, если Supabase доступен, иначе `503`. Заголовки `Content-Type: application/json`, `Cache-Control: no-store`. Тело:

```json
{
  "status": "ok",
  "checks": { "supabase": { "status": "ok", "latencyMs": 426 } },
  "version": "3701d4f",
  "timestamp": "2026-10-17T10:30:45.449Z"
}
```

- При сбое `status` равен `degraded`, `checks.supabase.status` равен `error`.
- Причина сбоя (`not_configured`, `timeout`, `network`, `http_error`) пишется только в лог, а не в ответ. Ключей и текстов ошибок в ответе нет.
- Пример выше — реальный ответ прода во время написания документа (агент).

### UptimeRobot

Источник: пользователь. Настройки он внёс вручную; агент монитор не открывал.

| Параметр | Значение |
|---|---|
| Тип | HTTP(s) |
| Название | `roombook health` |
| URL | `https://roombook-myp1.vercel.app/api/health` |
| Интервал | 5 минут |
| Оповещение | e-mail |

Скриншоты пользователя (в репозиторий не добавлены): `10_uptimerobot_monitors`, `10a_uptimerobot_alerts`, `10b_uptimerobot_incident`, `10c_uptimerobot_resolved`.

**Инцидент 2026-10-17:**
- монитор получал `405 Method Not Allowed`: он шлёт HEAD, а функция обрабатывала только GET;
- агент воспроизвёл ошибку через `curl` (GET → 200, HEAD → 405) и добавил обработчик HEAD (`dd494d2`);
- инцидент длился 40 мин 40 с, с 10:33:15 до ≈11:13 МСК, сейчас закрыт (данные UptimeRobot со слов пользователя);
- разбор: [docs/hw6/monitoring_incident.md](docs/hw6/monitoring_incident.md).

## 5. Логирование

### Формат

**Функции Vercel** (`api/_lib/log.ts`) пишут одну JSON-строку на событие:

```json
{"ts":"…","level":"info","msg":"health check ok","supabase_ms":426,"route":"/api/health","request_id":"<x-vercel-id>","latencyMs":430}
```

- Значения в примере иллюстративные, поля — как в коде.
- Обязательные поля `ts`, `level`, `msg`, `route`, `request_id`, `latencyMs` пишутся последними, поэтому дополнительные поля не могут их подменить.
- `request_id` берётся из заголовка `x-vercel-id`.
- Уровни: `debug`, `info`, `warn`, `error`. Порог задаёт `LOG_LEVEL`, по умолчанию `info`.
- Токены, ключи и тексты ошибок в логи не пишутся.

**Клиент** (`src/lib/logger.ts`):
- в консоль пишет JSON с `ts`, `level`, `msg` и техническими полями (операция, вид ошибки, HTTP-статус, код);
- `debug` и `info` пишутся только в dev;
- `error` в production дополнительно уходит через `navigator.sendBeacon` на `/api/log`.

### `/api/log`

Файл `api/log.ts`.

| Условие | Ответ |
|---|---|
| Событие принято | `204` |
| Метод не `POST` | `405`, `Allow: POST` |
| Тело больше 2 КБ (считается по потоку, а не по `Content-Length`) | `413` |
| Невалидный JSON | `400` |
| Неверные поля | `400` |

Принимаются только уровни `warn` и `error` и поля из белого списка, каждое с проверкой формата:

| Поле | Формат |
|---|---|
| `msg` | до 120 символов, без `@` и `/`; строки, похожие на токен, отклоняются |
| `operation`, `kind` | идентификатор |
| `code` | код ошибки |
| `status` | целое от 0 до 599 |

**Риски:**
- **Нет ограничения частоты запросов.** Эндпоинт открыт без входа, поэтому кто угодно может засорять журналы функций и тратить их вызовы. Это принято как остаточный риск; рекомендация — rate limit через Vercel WAF или счётчик в хранилище ([security_audit.md](security_audit.md), остаточный риск 8).
- **Произвольное содержимое.** Белый список не даёт записать персональные данные и токены, но не мешает отправить выдуманное событие допустимого формата.
- **Тестовое событие в журнале прода.** При проверке агент записал в журнал прода одно событие `warn` «integration check from agent».

### Где смотреть логи

- **Vercel → Logs:** функции `/api/health` и `/api/log`. JSON-строки `/api/health` в панели видны: проверил пользователь (скриншот `08_vercel_logs`). Агент доступа к панели не имел.
- **Supabase → Logs:** шлюз API (REST, Auth) и Postgres.

### Анализ логов с ИИ

Документ: [docs/hw6/log_analysis/log_analysis.md](docs/hw6/log_analysis/log_analysis.md).

**Данные:**
- пользователь выгрузил логи Supabase (98 записей за 28 минут) и передал их ИИ-ассистенту в чате;
- ассистент обезличил выгрузку (`auth_user` заменён на `<user-id-1>`) и посчитал статистику скриптом `analyze_logs.mjs`;
- перед коммитом агент проверил файлы поиском: ключей, токенов, e-mail, IP-адресов и имени профиля Windows нет.

**Находки:**

| # | Находка | Что сделано |
|---|---|---|
| L-01 | `POST /auth/v1/logout?scope=global` вернул 403 после выхода на другом «устройстве». Гипотеза: глобальный выход отозвал все сессии | Агент подтвердил по коду, что `signOut()` вызывался без аргументов, а значит глобально (auth-js 2.118). Исправлено: `scope: 'local'` и обработка 403 (`bcf0929`). Сама причина 403 остаётся гипотезой: тела ответа в логах нет |
| L-02 | 36 чтений `bookings` и 23 чтения `rooms` на одно создание и одну отмену брони: кэша на клиенте нет | Не исправлялось. Рекомендация без срочности: кэшировать список комнат |
| L-03 | 17 из 92 запросов — CORS preflight | Не исправлялось: это плата за кросс-доменные запросы, снижается только сокращением числа запросов |
| L-04 | Postgres без ошибок, в логах только контрольные точки | — |

## 6. Аудит безопасности

Полный отчёт: [security_audit.md](security_audit.md).

**Как проводился:** `npm audit` (0 уязвимостей), ревью по OWASP Top 10 (2021), поиск секретов в рабочем дереве и истории git (в отчёте только места, без значений).

**Находки:**

| # | Суть | Статус |
|---|---|---|
| S-01 | Не было заголовков безопасности | Исправлено: `vercel.json`, проверено на проде |
| S-02 | Правила времени брони проверялись только на клиенте | Исправлено триггером в миграции `20261017093831`, проверил пользователь в SQL Editor ([harden_check_result.md](docs/hw6/harden_check_result.md), 7 из 7) |
| S-03 | Лишний `UPDATE` на `profiles` | Исправлено той же миграцией, проверено там же |
| S-04 | Нет проверки `avatar_url` | Исправлено той же миграцией, проверено там же |
| S-05 | Actions подключены по тегу, а не по SHA | Открыто |
| S-06 | Сессия хранится в `localStorage` | Принято, смягчено CSP |
| S-07 | Гость видит `user_id` броней | Принято по замыслу |
| S-08 | `?scenario=` включает mock | Принято, демо ДЗ4 |
| S-09 | Разная длина названия на клиенте и в БД | Не уязвимость |

## 7. Тестирование и оптимизация

- [docs/hw6/integration_test_checklist.md](docs/hw6/integration_test_checklist.md): 21 проверка интеграций с исполнителем и результатом.
- [docs/hw6/optimization.md](docs/hw6/optimization.md): разбор бандла и две применённые оптимизации:
  - vendor-чанки `react` и `supabase`;
  - долгий кэш для `/assets`.

  Замеры до и после сделаны локально и на проде. После деплоя, меняющего только `src/`, браузер скачивает заново около 10 КБ вместо примерно 134 КБ.
- **Автотесты:** 15 файлов, 75 тестов (Vitest). Это компоненты, API-слой, ошибки, `api/health`, `api/log`, формат логов, аналитика и выход.
- **Дымовой тест** `scripts/api-smoke.mjs` проверяет REST и RLS на настоящем Supabase. Проверки 19–22 (правила миграции через REST) не запускались.

## 8. Использование ИИ

### Кто что делал

**Агент (Claude Code)**, в репозитории:
- писал код, тесты, миграцию, `vercel.json`, `ci.yml` и документы ДЗ6;
- запускал lint, `tsc -b`, тесты, сборку, `npm audit` и `curl` к проду;
- проверял CSP в headless-браузере;
- делал коммиты и пуши по просьбе пользователя.

Агент не имел доступа к панелям Vercel, Supabase, GA4 и UptimeRobot и не применял миграции к базе.

**Пользователь:**
- ставил задачи и принимал решения: оставил за собой решение о Prettier (пока не добавлен), вместе с ИИ-ассистентом решил не делать вход через Google, платежи пропустил;
- вручную настроил Vercel, переменные окружения, GitHub OAuth, Redirect URLs, GA4 и UptimeRobot;
- применил миграцию и выполнил проверку в SQL Editor;
- проверил вход на проде, события GA4 и Vercel Logs;
- выгрузил логи Supabase;
- зафиксировал закрытие инцидента в UptimeRobot.

**ИИ-ассистент в чате (Claude)**, источник: пользователь:
- планировал шаги ДЗ6;
- готовил промпты для агента: CI/CD, аудит, GA4, health check и логи, оптимизация, документация;
- готовил инструкции для ручных настроек Vercel, Supabase, GA4 и UptimeRobot;
- анализировал логи Supabase: обезличивание, скрипт `analyze_logs.mjs`, находки L-01–L-04 (см. «Кто что делал» в [log_analysis.md](docs/hw6/log_analysis/log_analysis.md)).

Код и файлы в репозитории писал агент; он же прогонял проверки и коммитил.

### Промпты по темам

Ниже краткое содержание запросов к агенту в этой работе, по истории сессий агента. Промпты готовил ИИ-ассистент в чате, агенту их передавал пользователь. Длинные запросы сокращены, но не перефразированы по смыслу.

**CI/CD**
- «ДЗ6, шаг 1 (CI)…»:
  - создать `.github/workflows/ci.yml` (триггеры push и pull_request в `main`, `workflow_dispatch`, `contents: read`, `concurrency`);
  - job `quality`: `npm ci`, lint, `tsc -b`, test, build на Node той же мажорной версии;
  - отдельный job `audit` с `npm audit --audit-level=high`, без `continue-on-error`;
  - сборка без секретов;
  - проверить `prettier --check` с временным конфигом, ничего не устанавливая;
  - прогнать те же шаги локально.
- «Закоммить только `.github/workflows/ci.yml` … "ci: add GitHub Actions workflow"… запушь».

**Аудит безопасности**
- «Шаг 2 ДЗ6: аудит безопасности проекта»:
  - `npm audit`;
  - ревью по OWASP Top 10 (XSS, CSRF и хранение сессии, SQL-инъекции, RLS и GRANT, валидация ввода, утечки в логах, секреты через `git grep` и `git log -S` без печати значений, заголовки);
  - исправления;
  - `vercel.json` с CSP;
  - `security_audit.md` «только факты из кода».
- Проверка файлов на имя профиля и ключи, `lh3.googleusercontent.com` в `img-src`, два коммита.
- «Закрой находки S-02, S-03, S-04 … новой миграцией»: триггер правил времени с `23514`, REVOKE UPDATE на `profiles`, CHECK на `avatar_url`, негативные проверки в дымовом тесте, `harden_check.sql`; «ничего не применяй к базе».
- Остаточный риск rate limit для `/api/log` и запись ручной проверки миграции (`harden_check_result.md`).

**GA4**
- «Шаг 4 ДЗ6: подключи Google Analytics 4»:
  - `src/lib/analytics.ts` без inline-скриптов, отключение в тестах и mock-режиме;
  - события `login`, `booking_created`, `booking_cancelled`, `booking_failed` без персональных данных, «только room_id и тип»;
  - расширение CSP;
  - тест на `trackEvent`.

**Health check, логи, мониторинг**
- «Шаги 6 и 7 ДЗ6»:
  - `api/health.ts` (проверка Supabase REST, таймаут 3 с, 200 или 503, `no-store`, без ключей и текстов ошибок в ответе);
  - JSON-логи функций;
  - `api/log.ts` (POST, до 2 КБ, белый список, `warn` и `error`, 204) и отправка ошибок через `sendBeacon`;
  - тесты.
- «UptimeRobot получил 405 …»:
  - проверить гипотезу про HEAD двумя командами `curl`;
  - добавить обработчик HEAD с тестом;
  - разбор в `monitoring_incident.md` «только факты из сессии; не придумывай время закрытия».
- Закрытие инцидента по данным UptimeRobot от пользователя.

**Анализ логов**
- Анализ сделан ИИ-ассистентом в чате. Текста запроса к файлу не было, ассистент сам предложил формат разбора. Шаблон промпта для повторного анализа приведён в [log_analysis.md](docs/hw6/log_analysis/log_analysis.md#промпт-для-повторного-анализа-шаблон).
- Агенту: «Положи папку `docs/hw6/log_analysis/` в репозиторий … Проверь поиском, что в файлах нет ключей, токенов, e-mail, IP и имени Windows-профиля». Затем «по находке L-01 открой `src/hooks/useAuth.ts` … если выход глобальный, предложи правку: `signOut({ scope: 'local' })` …».

**Тестирование и оптимизация**
- «Шаг 8 ДЗ6»: чек-лист интеграций «заполняй только то, что реально проверено»; анализ бандла, 2–3 оптимизации, применить 1–2 безопасные, замеры до и после. Промпт целиком приведён в [optimization.md](docs/hw6/optimization.md#промпт).

**Общие ограничения**, которые пользователь повторял в запросах:
- не читать и не коммитить `.env*` и секреты, не печатать токены и ключи;
- коммитить и пушить только по просьбе;
- не применять ничего к базе;
- не придумывать факты.

## 9. Ограничения и что не проверялось

**Не проверялось:**
- **Дымовой тест:** проверки 19–22 (правила миграции через REST с `ACCESS_TOKEN`) после миграции не запускались. Правила проверены только в SQL Editor (блок 3 `harden_check.sql`). Блоки 1–2 `harden_check.sql` (предпроверка и права) не передавались.
- **GA4:** событие `booking_failed` в отчётах не проверялось.
- **Supabase:** лимиты Auth и срок жизни JWT не проверялись. Redirect URLs и Site URL записаны со слов пользователя, агент их в панели не видел.
- **UptimeRobot:** настройки монитора записаны со слов пользователя и по его скриншотам, агент их не видел.
- **Отправка ошибок с клиента:** `error` через `sendBeacon` на проде из браузера не проверялась, есть только модульные тесты.
- **Кэш браузера:** эффект кэширования в реальном браузере не измерялся, выведен из заголовков и размеров чанков.
- **Второй проект Vercel:** назначение `roombook` не выяснялось.
- **L-01:** причина 403 остаётся гипотезой. Повторный выход после выхода на другом устройстве на проде не проверялся.

**Ограничения:**
- **`/api/log`:** нет rate limit (остаточный риск).
- **Actions:** не закреплены по SHA (S-05).
- **Чтения без кэша (L-02):** клиент перечитывает брони и комнаты при каждом действии.
- **Prettier:** форматирование не проверяется ни локально, ни в CI.
- **Скриншоты:** `03_vercel_login_ok`, `08_vercel_logs`, `09_ga4_realtime`, `10_uptimerobot_monitors`, `10a_uptimerobot_alerts`, `10b_uptimerobot_incident` и `10c_uptimerobot_resolved` в репозиторий не добавлены.
