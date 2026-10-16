# Что скрыто в материалах ДЗ5

Перед публикацией в репозитории из материалов убраны данные, которые не нужны для проверки работы. Смысл записей, время, статусы, коды ошибок и тексты сообщений не менялись.

| Файл | Что скрыто | Чем заменено |
|---|---|---|
| `logs/edge_warnings.txt` | поле `auth_user` (идентификатор моего аккаунта) в 4 записях | `<user-id-1>` |
| `log_analysis.md` | начало того же идентификатора в таблице сопоставления | `<user-id-1>` |
| `screens/table_bookings.png`, `screens/table_profiles.png` | значения `user_id` и `id` | заливка с подписью `<user-id-1>` |
| `screens/cancel_ok.png`, `screens/conflict_network_400.png` | заголовок `Sb-Jwt-Sub` (тот же идентификатор), значение `Set-Cookie` с служебной cookie Cloudflare | заливка с подписью |
| `screens/rest_post_anon_401.png`, `screens/rest_get_rooms_200.png` | значение `set-cookie` (служебная cookie Cloudflare, срок жизни 30 минут) | заливка с подписью |
| `screens/db_push.png`, `screens/rest_post_anon_401.png`, `screens/rest_get_rooms_200.png` | имя профиля Windows в пути `C:\Users\...` | заливка с подписью `user` |

Не менялись и намеренно оставлены:
- адрес проекта Supabase и его идентификатор (они публичные: попадают в сборку фронтенда);
- `client_id` приложения GitHub OAuth на `github_consent.png` (публичный по устройству протокола; секрет `client_secret` нигде не показан и хранится только в Supabase);
- `sb-request-id` и идентификаторы тестовых броней;
- GitHub-логин `KOCATUK` (он же в ссылке на репозиторий).

`logs/postgres_logs.json` и `smoke_output.txt` личных данных не содержали и оставлены как есть.
Оригиналы журналов и скриншотов до санации у меня сохранены локально и в репозиторий не коммитятся.
