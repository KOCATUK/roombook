# RoomBook: плейбук диагностики backend (Supabase)

Основан на наших миграциях (`supabase/migrations/`), коде (`src/api/appError.ts`, `src/lib/logger.ts`, `scripts/api-smoke.mjs`) и логах из `docs/hw5/log_analysis.md`. Где наших данных нет, это сказано прямо.

## Общий порядок

1. Взять из DevTools → Network (или из вывода `scripts/api-smoke.mjs`) **метод, путь, статус, `sb-request-id`, заголовок `Proxy-Status`** и время ответа (`Date`, GMT).
2. По времени найти запись в **Logs → API Gateway**: метод, путь, статус, `auth_user`. Дашборд показывает время по МСК (UTC+3), выгрузка — в UTC.
3. Через 10–70 мс после неё найти запись в **Logs → Postgres**: код SQLSTATE и текст. Причина ошибки есть только здесь.
4. Сначала решить, **это защита или поломка**: защита отказывает в том, что запрещено миграциями; поломка отказывает в том, что разрешено.
5. Не следовать `hint` из ответа PostgREST вслепую. Для отказа anon он предлагает `GRANT INSERT ... TO anon`, то есть снять намеренную защиту.

Без входа SQL-запросы ниже выполнять в Dashboard → SQL Editor. Токены и ключи никуда не вставлять и не печатать.

## Таблица

| # | Симптом | Где смотреть | Команда или запрос | Что делать |
|---|---|---|---|---|
| 1 | **HTTP 401** | Network: статус, тело `code`. Шлюз: `auth_user`. Postgres: код | `node --env-file=.env.local scripts/api-smoke.mjs` (проверки 3–4 дают эталон 401 для гостя) | `code = 42501` и `auth_user = null`: гость делает то, что разрешено только вошедшим. Это **защита**, UI должен предложить войти. `code = PGRST301/302/303`: проблема с токеном, см. № 8. |
| 2 | **HTTP 403** | Network: `code`, `message`. Postgres: текст | Запрос из п. 1. Сверить с проверками 6, 11, 13 дымового теста | Пользователь вошёл, но прав не хватает. Текст «row-level security policy» означает RLS (№ 3б), «permission denied for table» означает GRANT (№ 3а). Если операция по миграциям запрещена, это защита. Если разрешена, ищите № 10. |
| 3 | **42501** (а: `permission denied for table X`, б: `new row violates row-level security policy`) | Postgres: текст. Шлюз: метод и `auth_user`, чтобы различить запросы с одинаковым текстом | `select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'bookings';`<br>`select grantee, column_name, privilege_type from information_schema.column_privileges where table_schema = 'public' and table_name = 'bookings';`<br>`select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public';` | а) Нет GRANT на таблицу или столбец. Сверить с `20261016191017_rls_policies.sql`: отказ в `user_id` при UPDATE и в записи в `rooms` задуман. б) Политика отклонила строку. Для INSERT проверить, что `user_id` не передаётся с клиента или равен `auth.uid()`. |
| 4 | **23P01**, `bookings_no_overlap`, HTTP 400 (не 409, см. `log_analysis.md`) | Network: `Proxy-Status: PostgREST; error=23P01`. Postgres: имя ограничения | `select id, starts_at, ends_at from public.bookings where room_id = '<комната>' and tstzrange(starts_at, ends_at, '[)') && tstzrange('<начало>', '<конец>', '[)');` | Защита: интервал пересекается с существующей бронью. Клиент показывает «Это время уже занято». Если пересечения нет, проверить часовой пояс: время уходит строкой локального времени, а `starts_at` имеет тип `timestamptz`. |
| 5 | **23514**, `bookings_ends_after_starts` (или CHECK на `title`, `display_name`), HTTP 400 | Postgres: имя ограничения | `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.bookings'::regclass and contype = 'c';` | Защита: данные не прошли CHECK. Если отправка с клиента прошла мимо валидации формы, значит валидация в клиенте и CHECK разошлись; сверить `validateBooking` с ограничением. |
| 6 | **500 при первом входе** («Database error saving new user», по комментарию в миграции схемы) | Logs → Auth и Logs → Postgres в момент входа. **В наших логах таких записей нет**, эталона нет. | `select tgname, tgenabled from pg_trigger where tgname = 'on_auth_user_created';`<br>`select u.id from auth.users u left join public.profiles p on p.id = u.id where p.id is null;` | Триггер `handle_new_user` упал на вставке в `profiles`: CHECK на `display_name`, другой `search_path`, нет функции. Текст ошибки взять из Postgres-лога и исправить функцию **новой миграцией**. |
| 7 | **Сеть**: статус 0 / `(failed)` в Network, `TypeError` из fetch, в UI «Нет связи с сервером» (`offline_error.png`) | DevTools → Network: есть ли запрос вообще. Записи шлюза **нет**: запрос не дошёл | `node --env-file=.env.local scripts/api-smoke.mjs` (если проверка 1 проходит из Node, сервер жив)<br>`Test-NetConnection <ref>.supabase.co -Port 443` | Проверить интернет, VPN и прокси, `VITE_SUPABASE_URL` в `.env.local` (сам файл в чат не вставлять) и статус проекта (не на паузе ли). CORS как причина маловероятен: preflight отдаёт `access-control-allow-origin: *` (проверка 5). |
| 8 | **Просроченный токен**: 401 с `PGRST301/302/303` у вошедшего пользователя после долгого простоя | Network: `code`. Шлюз: `auth_user` пустой у запроса, который должен быть с токеном | `node -e "const p=JSON.parse(Buffer.from(process.env.ACCESS_TOKEN.split('.')[1],'base64url'));console.log(new Date(p.exp*1000).toISOString())"` (печатает только срок, не токен). Дымовой тест сам предупреждает об истёкшем токене | Для ручных проверок взять свежий токен. В приложении проверить, что supabase-js обновляет сессию; если нет, выходить и входить заново. В UI это kind `unauthorized`. **Эталона в наших логах нет.** |
| 9 | **RLS не включён**: чужие брони меняются и удаляются, в дымовом тесте проверки 16–17 (чужая бронь) дают FAIL, возвращаются строки | Dashboard → Authentication → Policies (`policies.png`), Advisors → Security | `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';` (у `profiles`, `rooms`, `bookings` должно быть `true`) | Включить RLS новой миграцией: `alter table ... enable row level security`. Затем прогнать дымовой тест с `FOREIGN_BOOKING_ID`. В текущих логах признаков этого нет. |
| 10 | **Не выданы GRANT**: `permission denied for table X` на **разрешённую** операцию (например, гость не видит `rooms`, вошедший не может создать бронь) | Postgres: текст. Сравнить операцию с миграцией прав | Запросы `role_table_grants` и `column_privileges` из № 3 | Выдать недостающее право новой миграцией, ровно то, что описано в `rls_policies.sql`. Автовыдача прав новым таблицам в проекте отключена, поэтому новая таблица без явного GRANT недоступна. |
| 11 | **42P01** `relation "..." does not exist` | Postgres: имя relation и время | `supabase migration list` (какие миграции применены) | Если relation наша (`public.*`): миграция не применена, выполнить `supabase db push`. В наших логах 42P01 был только для служебных схем (`supabase_migrations`, `realtime`), не повторялся и на приложение не влиял. |
| 12 | **Нет записи в шлюзе**, хотя клиент получил ответ и в Postgres ошибка есть | Logs → API Gateway без фильтра Level | Фильтр Pathname = путь запроса, время из `sb-request-id` (см. `log_analysis.md`, раздел 3) | Не делать выводов по одним логам шлюза: причину пропуска мы не установили. Опираться на ответ клиента и лог Postgres. |

## Промпты для ИИ-диагностики

Во всех промптах подставьте данные вместо `<...>`. Перед отправкой удалите токены, `apikey`, `Set-Cookie`, заголовок `Authorization` и содержимое `.env*`.

### 1. HTTP 401
```text
Проект: React + Supabase (PostgREST), RLS включён, права выдаются миграциями.
Запрос: <метод> <путь без query-значений>, ответ HTTP 401.
Тело ошибки: code=<code>, message=<message>. Заголовок Proxy-Status: <значение>.
Запись API Gateway: auth_user=<null или "есть">. Запись Postgres: <код и текст>.
Миграция прав для этой таблицы: <фрагмент GRANT и политик>.
Определи: гость пытается сделать запрещённое (это защита) или проблема с токеном
(PGRST301/302/303)? Опирайся только на эти данные, при нехватке скажи, чего не хватает.
Не предлагай выдавать права anon, если миграция их явно не даёт.
```

### 2. HTTP 403
```text
Supabase/PostgREST, пользователь вошёл (auth_user в логе шлюза есть).
Запрос: <метод> <путь>, HTTP 403, code=<code>, message=<message>.
Запись Postgres: <код и текст>.
GRANT и политики RLS для таблицы: <фрагмент миграции>.
Что именно отказало: GRANT на таблицу, GRANT на столбец или политика RLS (USING/WITH CHECK)?
Задумано ли это миграцией? Если нет, какое минимальное изменение миграции нужно.
```

### 3. 42501
```text
Postgres вернул 42501: "<текст>". Роль: <anon/authenticated по auth_user в шлюзе>.
Операция: <SELECT/INSERT/UPDATE (какие столбцы)/DELETE> над <таблица>.
Результат запросов к information_schema.role_table_grants, column_privileges и pg_policies:
<вставить вывод>.
Объясни, это нехватка GRANT или срабатывание RLS, и совпадает ли поведение с миграцией.
Учти, что hint PostgREST про GRANT не означает, что право нужно выдавать.
```

### 4. 23P01
```text
INSERT/UPDATE в bookings вернул 23P01, ограничение bookings_no_overlap
(exclude using gist: room_id =, tstzrange(starts_at, ends_at, '[)') &&). HTTP <статус>.
Отправленные данные: room_id=<...>, starts_at=<...>, ends_at=<...> (строки как ушли в запрос).
Существующие брони в комнате на этот день: <вывод SELECT>.
Есть ли реальное пересечение с учётом полуоткрытого интервала и часовых поясов
(клиент хранит локальное время YYYY-MM-DDTHH:mm, колонка timestamptz)?
```

### 5. 23514
```text
Postgres вернул 23514, ограничение <имя>. Определение: <pg_get_constraintdef>.
Отправленные значения: <поля без персональных данных>.
Клиентская валидация: <фрагмент validateBooking или формы>.
Какое значение нарушило CHECK и почему клиентская валидация его пропустила?
```

### 6. 500 от триггера регистрации
```text
При первом входе через GitHub Supabase Auth вернул 500 / "Database error saving new user".
Функция триггера: <текст handle_new_user из миграции>.
Записи Logs → Auth и Logs → Postgres в момент входа: <код и текст, без email и токенов>.
Состояние: pg_trigger для on_auth_user_created = <вывод>.
Найди причину падения вставки в public.profiles и предложи исправление
в виде новой миграции. Если в логах нет нужного, скажи, что ещё собрать.
```

### 7. Сеть
```text
Браузер: запрос <метод> <путь> к <ref>.supabase.co завершился без HTTP-статуса
(Network: <failed / CORS error / ERR_...>), fetch бросил TypeError.
В Logs → API Gateway записи на это время <есть/нет>.
Из Node тот же GET /rest/v1/rooms: <результат проверки 1 дымового теста>.
Preflight OPTIONS отвечает access-control-allow-origin: <значение>.
Определи, где обрывается запрос: клиент/сеть, CORS или сервер. Что проверить следующим шагом?
```

### 8. Просроченный токен
```text
Вошедший пользователь получил 401, code=<PGRST301/302/303>, message=<...>.
Срок токена (exp) = <дата UTC>, текущее время = <дата UTC>.
Клиент: supabase-js <версия из package.json>, создание клиента: <фрагмент src/lib/supabase.ts>.
Почему токен не обновился и как клиент должен реагировать (обновление сессии, повторный вход)?
```

### 9. RLS не включён
```text
Проверка: пользователь A смог изменить/удалить бронь пользователя B
(дымовой тест, проверки 16–17: <вывод>).
pg_class.relrowsecurity для public-таблиц: <вывод>. pg_policies: <вывод>.
Миграция политик: <фрагмент>.
Подтверди или опровергни, что RLS выключен или политика слишком широкая,
и предложи миграцию-исправление.
```

### 10. Не выданы GRANT
```text
Разрешённая по задумке операция <операция над таблицей> для роли <anon/authenticated>
падает с 42501 "permission denied for table <X>".
Ожидаемые права по миграции: <фрагмент GRANT>.
Фактические права (role_table_grants, column_privileges): <вывод>.
Каких прав не хватает и какой GRANT добавить новой миграцией? Не выдавай лишнего.
```

### 11. 42P01
```text
Postgres: 42P01 relation "<имя>" does not exist, время <UTC>.
Список применённых миграций (supabase migration list): <вывод>.
Эта relation из нашей схемы public или служебная схема Supabase?
Нужно ли что-то делать, или это разовая ошибка инициализации?
```

### 12. Нет записи в API Gateway
```text
Клиент получил <метод> <путь> HTTP <статус>, sb-request-id=<...>, Date=<...>.
В Logs → Postgres есть ошибка <код, текст> в <время>. В Logs → API Gateway
(фильтр <какие фильтры стояли>) записи нет, соседние запросы есть.
Предложи гипотезы, почему записи нет, и способ проверить каждую. Не утверждай причину без данных.
```
