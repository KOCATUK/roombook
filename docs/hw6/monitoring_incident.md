# Инцидент: UptimeRobot получает 405 от /api/health

- Сервис: https://roombook-myp1.vercel.app/api/health
- Начало: 2026-10-17 10:33 МСК (по данным UptimeRobot, со слов пользователя)
- Статус: исправлено в коде, ждёт деплоя. Время закрытия добавит пользователь после деплоя.

## Хронология (МСК, 2026-10-17)

| Время | Событие |
|---|---|
| 10:33 | UptimeRobot фиксирует начало инцидента: ответ `405 Method Not Allowed` от `/api/health` |
| до 11:07 | Пользователь видит инцидент в UptimeRobot и выдвигает гипотезу: монитор шлёт HEAD, а `api/health.ts` обрабатывает только GET |
| 11:07 | Проверка гипотезы из CMD: GET → `200`, HEAD → `405` (вывод ниже) |
| 11:08 | Коммит `dd494d2 fix(api): support HEAD on health endpoint`: обработчик HEAD и тесты |
| — | Деплой и восстановление монитора: время добавит пользователь |

## Как обнаружен

Монитор UptimeRobot на `https://roombook-myp1.vercel.app/api/health` сообщил о статусе 405.

## Проверка гипотезы

```
> curl -s -o NUL -w "%{http_code}" https://roombook-myp1.vercel.app/api/health
200

> curl -I https://roombook-myp1.vercel.app/api/health
HTTP/1.1 405 Method Not Allowed
Cache-Control: public, max-age=0, must-revalidate
Content-Security-Policy: default-src 'self'; … (заголовки из vercel.json на месте)
Server: Vercel
X-Vercel-Cache: MISS
X-Vercel-Id: lhr1::iad1::w4hj5-1792224439848-50c42ee9051c
```

GET работает, HEAD — нет. Значит, сама функция и Supabase в порядке, сбой только в методе запроса. `Cache-Control: public, max-age=0, must-revalidate` выставил Vercel, а не функция: функция всегда отвечает `no-store`. Следовательно, ответ 405 сформировала платформа, до кода функции запрос не дошёл.

## Причина

`api/health.ts` (коммит `7032dd3`) экспортировал только `GET`. Для метода без обработчика Vercel отвечает 405. На скорость ответа и доступность сервиса для пользователей это не влияло: GET-запросы возвращали 200.

То, что UptimeRobot шлёт именно HEAD, следует из совпадения кодов: монитор получает 405, и `curl -I` (HEAD) тоже получает 405. Настройки самого монитора в этой сессии не открывались.

## Исправление

Коммит `dd494d2`, файл `api/health.ts`:

- добавлен `export async function HEAD`. Он выполняет ту же проверку Supabase, что и GET, и возвращает тот же статус (200 или 503) и те же заголовки (`Cache-Control: no-store`, `Content-Type: application/json`), но без тела;
- успешные HEAD не пишутся в лог: монитор ходит регулярно, и строки «ok» были бы шумом. Деградация (`health check degraded`, уровень `warn`) логируется как у GET;
- общая логика вынесена в `runHealthCheck`, поведение GET не изменилось;
- тесты (`api/_tests/health.test.ts`): HEAD при доступном Supabase даёт 200 с заголовками GET, без тела и без записи в лог; при недоступном — 503 и `warn` с `reason: network`.

Проверки после правки: `npm run lint` и `npx tsc -b` без ошибок, `npm test` (14 файлов, 71 тест) и `npm run build` успешно.

## Что проверить после деплоя

- `curl -I https://roombook-myp1.vercel.app/api/health` → `HTTP/1.1 200` и `Cache-Control: no-store`;
- монитор в UptimeRobot вернулся в Up, время закрытия инцидента — в таблицу выше.

## Выводы

- Health-эндпоинт должен поддерживать HEAD: многие мониторы используют его по умолчанию.
- Тесты проверяли только GET, поэтому пропуск не заметили. Теперь HEAD покрыт тестом.
