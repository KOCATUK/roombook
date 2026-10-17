# Аудит безопасности RoomBook (ДЗ6, шаг 2)

Дата: 2026-10-17. Состояние кода: коммит `632b6af` плюс правки из раздела «Что исправлено»; S-02–S-04 закрыты миграцией позже в тот же день.

## Метод и инструменты

Ревью кода по OWASP Top 10 (2021) выполнил ИИ-агент (Claude Code). Он читал исходники и запускал команды; выводы ниже опираются только на код репозитория и на результаты этих команд. Что не проверялось, перечислено в конце раздела.

Объём ревью: `src/`, `supabase/migrations/`, `supabase/config.toml`, `scripts/api-smoke.mjs`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `.github/workflows/ci.yml`, собранный бандл `dist/`.

| Что | Как |
|---|---|
| Уязвимости зависимостей | `npm audit` (все уровни), вывод в [docs/hw6/npm_audit.txt](docs/hw6/npm_audit.txt) |
| XSS | поиск по исходникам: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval(`, `new Function`, `document.write`, `javascript:`, `href={`, `src={`, `style=`; разбор мест, где выводятся название брони, имя и аватар |
| Хранение сессии, CSRF, OAuth | `src/lib/supabase.ts`, `src/hooks/useAuth.ts`; код `@supabase/auth-js` и `@supabase/supabase-js` 2.118.0 в `node_modules` |
| SQL-инъекции | поиск `.rpc(`, `.or(`, `.filter(`, `textSearch`, `ilike`, сырого SQL в клиенте; функции и `EXECUTE` в миграциях |
| Контроль доступа | сверка GRANT и политик RLS с вызовами в `src/api/supabaseApi.ts` |
| Секреты | `git grep` по отслеживаемым файлам и `git log --all -G` по истории (43 коммита) на маркеры JWT (`eyJ…`), `sb_secret_`, `sb_publishable_`, `service_role`, `ghp_`, `github_pat_`, приватные ключи, присвоения `password=`, `secret=`, `api_key=`. В отчёт попадают только факт и место, значения не выводились |
| Заголовки и CSP | `dist/` отдавался локальным Node-сервером с заголовками из `vercel.json` и открывался в headless Microsoft Edge (`--dump-dom`, журнал консоли) |

Не проверялось:

- настройки проекта Supabase в Dashboard (Redirect URLs, Site URL, лимиты Auth, включённые провайдеры, срок жизни JWT); `supabase/config.toml` описывает только локальный стек CLI;
- реальное состояние БД (применены ли миграции без ручных изменений): права и политики сверены по файлам миграций, а не по живой базе. Косвенное подтверждение — дымовой тест ДЗ5 (`docs/hw5/smoke_output.txt`: PASS 13, FAIL 0, WARN 1);
- заголовки на настоящем Vercel: деплоя с `vercel.json` ещё не было;
- в браузере не проверялись вход через GitHub и показ аватара при действующей CSP;
- содержимое скриншотов в `docs/` (PNG не просматривались поиском) и файл `package-lock.json` в истории (в нём хэши `integrity`, дающие ложные срабатывания);
- динамическое тестирование (сканеры, фаззинг, перебор), ограничения частоты запросов.

## Найденное

Серьёзность оценена для учебного проекта с публичным расписанием.

| ID | OWASP 2021 | Где | Серьёзность | Статус |
|---|---|---|---|---|
| S-01 | A05 Security Misconfiguration | нет файла конфигурации хостинга; `index.html` | Средняя | Исправлено: `vercel.json` |
| S-02 | A04 Insecure Design | `supabase/migrations/20261016191012_schema.sql:55-59` | Средняя | Исправлено в миграции, применение и проверка на реальной БД — за пользователем |
| S-03 | A01 Broken Access Control (лишние права) | `supabase/migrations/20261016191017_rls_policies.sql:38`, `:50` | Низкая | Исправлено в миграции, применение и проверка на реальной БД — за пользователем (только `profiles`; `UPDATE` на `bookings` оставлен) |
| S-04 | A04 Insecure Design (валидация) | `supabase/migrations/20261016191012_schema.sql:16-17` | Низкая | Исправлено в миграции, применение и проверка на реальной БД — за пользователем |
| S-05 | A08 Software and Data Integrity Failures | `.github/workflows/ci.yml:26`, `:29`, `:55`, `:57` | Низкая | Открыто, рекомендация |
| S-06 | A07 Identification and Authentication Failures | `src/lib/supabase.ts:13-18` | Низкая (остаточный риск) | Принято; смягчено CSP из S-01 |
| S-07 | A01 (раскрытие данных) | `supabase/migrations/20261016191017_rls_policies.sql:29`, `:69-73`; `src/api/supabaseApi.ts:12` | Инфо | Принято по замыслу |
| S-08 | A04 Insecure Design | `src/api/api.ts:12-13` | Инфо | Принято (демо-сценарии ДЗ4) |
| S-09 | Валидация ввода | `src/components/BookingForm.tsx:35` против `schema.sql:54` | Инфо | Не уязвимость |

### S-01. Нет заголовков безопасности

Ни в репозитории, ни в сборке нет `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` и `Permissions-Policy`. Без CSP любая будущая XSS сможет загрузить сторонний скрипт и отправить токен из `localStorage` на чужой сервер (см. S-06). Без запрета фреймов страницу можно встроить в чужой сайт (clickjacking: кнопки «Забронировать» и «Отменить»).

### S-02. Ограничения на время брони есть только в клиенте

`validateBooking` (`src/utils/bookings.ts:30-60`) запрещает начало в прошлом и бронь через полночь. В БД из правил времени есть только `ends_at > starts_at` и запрет пересечений. Вошедший пользователь может напрямую через REST создать бронь на месяцы вперёд или задним числом и тем самым занять комнату для всех. Права при этом не нарушаются: бронь его собственная, но клиентские правила обходятся.

**Исправление** (`supabase/migrations/20261017093831_harden_bookings_profiles.sql`, к БД не применялась). Триггер `bookings_validate_time` (`BEFORE INSERT OR UPDATE OF starts_at, ends_at`) с функцией `validate_booking_time()` повторяет правила `validateBooking` и добавляет ограничение длительности:

- конец позже начала;
- длительность не больше 8 часов. Этого правила в клиенте нет: форма пропустит такую бронь, а сервер отклонит её с общим сообщением «Проверьте введённые данные»;
- начало и конец в одну дату по `Europe/Moscow`, поэтому конец ровно в 00:00 следующего дня тоже запрещён, как `crossesMidnight` в клиенте. Есть расхождение: клиент считает дату в часовом поясе браузера, сервер — по Москве. У пользователя вне МСК правила разойдутся;
- начало не раньше `now() - 1 minute`. При `UPDATE` начало проверяется, только если оно меняется, а если время не меняется вовсе, триггер ничего не проверяет. Продлить идущую встречу можно, перенести бронь в прошлое нельзя.

Ошибки бросаются с `errcode '23514'` и текстами из `BOOKING_ERROR_MESSAGES`. PostgREST отвечает на них 400, `appError.ts` относит их к `validation` (тест «23514, класс 22 и 400 → validation» уже есть). Существующие строки триггер не проверяет.

Не проверено: миграция не выполнялась ни локально (Docker нет), ни в облаке. SQL проверен только чтением.

### S-03. GRANT UPDATE, которым клиент не пользуется

`authenticated` выдан `UPDATE (room_id, title, starts_at, ends_at)` на `bookings` и `UPDATE (display_name, avatar_url)` на `profiles`. Вызовов `.update(` в клиенте нет. RLS ограничивает изменения своими строками, поэтому чужие данные не затрагиваются. Но лишние права расширяют поверхность атаки. Например, пользователь может переименовать себя в «Администратор»: это имя увидят другие вошедшие пользователи в расписании. Рекомендация: отозвать эти права миграцией, если редактирование не планируется.

**Исправление для `profiles`** (`supabase/migrations/20261017093831_harden_bookings_profiles.sql`). По коду клиент `profiles` не обновляет: в `src/` нет ни `.update(`, ни `updateUser`. Поэтому `UPDATE (display_name, avatar_url)` отозван у `authenticated`, а политика `profiles_update_own` удалена. Имя и аватар задаёт только триггер `handle_new_user` при первом входе. `UPDATE` на `bookings` оставлен: задача касалась только `profiles`. Изменения времени через него теперь проверяет триггер из S-02.

### S-04. Нет проверки формата `avatar_url` и не ограничена длина в `profiles`

У `display_name` есть CHECK на длину 1–100, у `avatar_url` нет ни длины, ни схемы URL. Сейчас `profiles.avatar_url` клиент не запрашивает: аватар в шапке берётся из `user_metadata` собственной сессии (`src/hooks/useAuth.ts:42`, `src/components/AuthBar.tsx:40`). Поэтому подставить картинку другому пользователю нельзя. Риск появится, если аватары авторов начнут выводиться в расписании. Рекомендация: `check (avatar_url is null or avatar_url ~ '^https://')` и ограничение длины.

**Исправление** (`supabase/migrations/20261017093831_harden_bookings_profiles.sql`). Добавлен CHECK `profiles_avatar_url_https`: `avatar_url` либо `null`, либо начинается с `https://` и не длиннее 500 символов. Если в БД уже есть неподходящие строки, `ALTER TABLE` упадёт. Поэтому CHECK стоит в миграции первым, а запрос для проверки до применения лежит в `docs/hw6/harden_check.sql` (блок 1). `handle_new_user` пересоздан: неподходящий аватар он записывает как `null`, а не роняет вход. GitHub отдаёт аватары с `https://avatars.githubusercontent.com`, эти URL правилу удовлетворяют. Существующие строки не проверялись: доступа к БД у ИИ-агента нет.

### S-05. Actions подключены по мажорному тегу, а не по SHA

`actions/checkout@v7` и `actions/setup-node@v7`: тег можно перевесить на другой коммит. Это официальные actions GitHub, а у токена в workflow только `contents: read`, поэтому риск низкий. Рекомендация: закрепить версии по полному SHA и обновлять их через Dependabot.

### S-06. Сессия хранится в `localStorage`

В клиенте storage не задан. В `@supabase/auth-js` 2.118.0 (`GoTrueClient.js:246-253`) при `persistSession: true` по умолчанию используется `globalThis.localStorage`. Там же лежит и PKCE `code_verifier`. Токен доступен любому скрипту на странице, поэтому любая XSS означает кражу сессии. Источников XSS в коде не найдено (см. «Что не проблема»), а CSP из S-01 разрешает скрипты только со своего origin и запросы только к `*.supabase.co`. Переход на cookie потребовал бы серверной части, которой в проекте нет.

### S-07. Гость видит `user_id` и названия броней

Политика `bookings_select_all` (`using (true)`) и GRANT SELECT для `anon` открывают все брони. Клиент запрашивает `user_id` (`BOOKING_COLUMNS`). Публичное расписание — решение ДЗ5 (`backend_documentation.md`). UUID автора без доступа к `profiles` (у `anon` его нет) имя не раскрывает, но позволяет сопоставлять брони одного человека. Если это нежелательно, отдавайте гостю представление без `user_id`.

### S-08. Параметр `?scenario=` включает mock API

Любой адрес с `?scenario=…` показывает демо-данные вместо настоящих, даже на рабочем сайте. В БД ничего не пишется: mock живёт в памяти вкладки. Риск сводится к подмене содержимого по подготовленной ссылке («комната занята»). Принято для демо ДЗ4. Для боевого сайта mock стоит выключать при `import.meta.env.PROD`.

### S-09. Разная максимальная длина названия

В форме `maxLength={100}`, в БД CHECK до 200 символов после `btrim`. Это несогласованность, а не уязвимость: БД проверяет длину независимо от клиента. `validateBooking` длину не проверяет и полагается на атрибут `maxLength`, который обходится прямым запросом. Предел при этом всё равно ограничен БД.

## Что исправлено и как проверено

### `vercel.json` (S-01)

На все пути (`/(.*)`) добавлены заголовки:

| Заголовок | Значение и зачем |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self'` и `style-src 'self'`: inline-скриптов и стилей в сборке нет (проверено по `dist/index.html` и бандлу); `img-src 'self' https://avatars.githubusercontent.com https://lh3.googleusercontent.com` для аватаров GitHub и Google (вход через Google планируется); `connect-src 'self' https://*.supabase.co` для REST и Auth; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` для старых браузеров, которые не знают `frame-ancestors` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

`data:` в `img-src` не добавлен: единственный `data:image/svg+xml` в бандле — QR-код MFA из supabase-js, а MFA в проекте не используется. `wss://*.supabase.co` тоже не добавлен, потому что Realtime клиент не использует. HSTS в `vercel.json` нет: на доменах Vercel его выставляет платформа (на настоящем деплое не проверялось).

**Куда добавлять новые источники.** В JSON нет комментариев, а Vercel не принимает в `vercel.json` посторонние ключи, поэтому подсказка записана здесь:

- **Яндекс.Метрика:** `https://mc.yandex.ru` в `script-src`, `img-src` и `connect-src`. Для Вебвизора также `frame-src https://mc.yandex.ru` и `https://mc.yandex.com`. Точный список нужно сверить с документацией Метрики на момент подключения.
- **Вход через Google:** если вход идёт через Supabase Auth (переадресация, как у GitHub), CSP менять не нужно. Переход на страницу входа CSP не ограничивает. Хост аватаров Google `https://lh3.googleusercontent.com` уже есть в `img-src`. Если будет использоваться Google Identity Services (кнопка или One Tap), добавьте `https://accounts.google.com` в `script-src`, `frame-src` и `connect-src`.
- **Supabase Realtime:** `wss://*.supabase.co` в `connect-src`.

**Проверка:**

1. `npm run build`, затем `dist/` отдавался локальным Node-сервером с заголовками, прочитанными из `vercel.json`. `curl -I` показал все пять заголовков.
2. Headless Edge, сборка с настоящим Supabase. Страница отрисовалась, комнаты «Байкал», «Волга» и «Эльбрус» загрузились из Supabase, есть кнопка «Войти через GitHub». Нарушений CSP в журнале консоли нет. Тот же результат с `?scenario=ok` (mock).
3. Отрицательный контроль: убрал `https://*.supabase.co` из `connect-src` в копии конфига. Браузер заблокировал запросы к `/rest/v1/rooms` и `/rest/v1/bookings` с сообщением о нарушении `connect-src`, и страница показала «Не удалось загрузить комнаты». Значит, политика действительно применялась.
4. `npm run lint`, `npx tsc -b`, `npm test` (9 файлов, 38 тестов), `npm run build`, `npm audit` — без ошибок.

Не проверено: вход через GitHub и показ аватара при действующей CSP, заголовки на настоящем Vercel. После деплоя: `curl -I https://<домен>`, затем войти и посмотреть консоль браузера.

## Что не проблема и почему

- **anon-ключ в бандле.** Публичен по замыслу Supabase: он определяет роль `anon`, а доступ к данным ограничивают GRANT и RLS (`rls_policies.sql`). Ключа `service_role` в коде, конфигах и истории нет; `.env.example` прямо запрещает его туда класть.
- **CSRF.** Неприменим к API: supabase-js отправляет токен заголовком `Authorization: Bearer` (`@supabase/supabase-js/dist/index.mjs:302-303`, `fetchWithAuth`), а не cookie. Браузер сам такой заголовок к межсайтовому запросу не добавит. Своих cookie приложение не ставит (`document.cookie` в коде нет).
- **OAuth.** Включён PKCE (`flowType: 'pkce'`, `src/lib/supabase.ts:16`): в адрес возврата приходит только одноразовый `code`, а обменять его можно только с `code_verifier` из `localStorage` этой же вкладки (`code_challenge` в `GoTrueClient.js:750`). Параметр `state` между GitHub и Supabase Auth формирует и проверяет сервер Supabase. Клиент этого не видит, поэтому здесь это не проверялось. `redirectTo: window.location.origin` сверяется с Redirect URLs проекта на стороне Supabase (настройки Dashboard не проверялись).
- **XSS.** Опасных вызовов (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`) в `src/` и в собранном бандле нет. Название брони, имя автора и имя из GitHub выводятся как текст JSX и в атрибуты `title`/`aria-label`, которые React экранирует. Единственный пользовательский URL — аватар в `<img src>` (`AuthBar.tsx:40`), он из метаданных собственной сессии. `img` не исполняет `javascript:`, а CSP ограничивает источник картинок.
- **SQL-инъекции.** В клиенте нет сырого SQL, RPC и строковых фильтров (`.or`, `.filter`, `textSearch`). Используются только `.select` с постоянными списками колонок, `.order`, `.insert` объекта и `.eq('id', id)`. postgrest-js передаёт значения параметрами URL или телом JSON, PostgREST подставляет их как параметры запроса. В миграциях одна функция `handle_new_user`: в ней нет `EXECUTE`, вставка идёт через `values (...)`, `search_path = ''`, `EXECUTE` на неё отозван у `public`, `anon` и `authenticated`.
- **Контроль доступа к записи.** Политики и вызовы клиента согласованы. `insert` с `with check (user_id = auth.uid())` и `default auth.uid()`: клиент `user_id` не передаёт (`mappers.ts:69-76`). `delete` разрешён только для своих строк, и клиент проверяет, что что-то удалилось (`supabaseApi.ts:83-99`). `rooms` нельзя менять ни GRANT, ни политиками. `profiles` гостю закрыт.
- **Утечки в ошибках и логах.** `logger` пишет только операцию, вид ошибки, HTTP-статус и код (`supabaseApi.ts:30-35`, `useAuth.ts:48-53`). `message` и `details` от БД в лог и в интерфейс не попадают, пользователь видит фиксированные тексты из `appError.ts`. `logger.info` работает только в dev. Source maps в сборке не создаются (`dist/` содержит только `index.html`, один JS и один CSS). Дымовой тест печатает URL проекта, статусы и `sb-request-id`, но не ключ и не токен.
- **Секреты.** Совпадения в рабочем дереве — ложные: слово `service_role` в комментариях и документации, `apikey: %KEY%` в примерах curl, имена переменных (`ACCESS_TOKEN = process.env…`, `SUPABASE_ANON_KEY = import.meta.env…`), ссылки `env(...)` в `supabase/config.toml`, хэши `integrity` в `package-lock.json`. В истории нет JWT, ключей `sb_secret_`/`sb_publishable_`, токенов GitHub и приватных ключей. Из файлов `.env*` в истории был только `.env.example`, с пустыми значениями. `.env` и `.env.local` игнорируются (`.gitignore:26` и `:13`). URL проекта Supabase есть в `docs/hw5/logs/edge_warnings.txt` и `docs/hw5/smoke_output.txt` (коммит `b3a612b`). Он публичен по замыслу и попадает в бандл.
- **Зависимости.** `npm audit`: 0 уязвимостей на всех уровнях (301 пакет). CI падает на high и critical.

## Остаточные риски и рекомендации

1. Применить миграцию `20261017093831_harden_bookings_profiles.sql` (S-02–S-04) и проверить её: `docs/hw6/harden_check.sql` в SQL Editor и проверки 19–22 дымового теста с `ACCESS_TOKEN`.
2. Добавить в `validateBooking` предел 8 часов, а «один день» считать по `Europe/Moscow`, как на сервере. Иначе пользователь увидит общее сообщение вместо точной причины. Решить, нужен ли `UPDATE` на `bookings` (S-03).
3. После деплоя на Vercel проверить заголовки (`curl -I`) и вход через GitHub с CSP. При подключении Метрики и Google расширить CSP по списку выше.
4. Закрепить actions по SHA и включить Dependabot для npm и GitHub Actions (S-05).
5. Проверить в Dashboard Supabase то, что здесь не проверялось: точный список Redirect URLs без лишних шаблонов, лимиты Auth, срок жизни JWT.
6. Ограничения частоты создания броней на стороне БД нет: вошедший пользователь может создать много броней подряд. Не проверялось, какие лимиты на это даёт сам Supabase.
7. Сессия в `localStorage` (S-06) остаётся риском при любой будущей XSS: не добавлять `dangerouslySetInnerHTML` и не ослаблять `script-src`.
8. У `/api/log` (`api/log.ts`) нет ограничения частоты запросов. Эндпоинт открыт без входа, поэтому кто угодно может засорять журналы функций и расходовать их вызовы. Размер тела (2 КБ) и набор полей ограничены, но число запросов — нет. Рекомендация: rate limit, например правилом Vercel WAF на `/api/log` или счётчиком по IP в хранилище (Redis/KV). В рамках ДЗ6 принято как остаточный риск.
