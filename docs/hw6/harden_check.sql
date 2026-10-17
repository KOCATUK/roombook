-- Ручная проверка миграции 20261017093831_harden_bookings_profiles.sql
-- в Supabase SQL Editor. Блоки запускаются по отдельности (выделить и Run).
-- Блок 1 — до применения миграции, блоки 2 и 3 — после.

-- =====================================================================
-- Блок 1. ДО применения: строки, на которых упадёт новый CHECK
-- =====================================================================
-- Ожидается 0 строк. Если строки есть, CHECK не добавится и миграция упадёт:
-- сначала исправьте avatar_url этих профилей (например, set avatar_url = null).
select id, left(avatar_url, 40) as avatar_url_start, char_length(avatar_url) as length
from public.profiles
where avatar_url is not null
  and (avatar_url not like 'https://%' or char_length(avatar_url) > 500);

-- Для сведения: существующие брони, которые новые правила не пропустили бы.
-- Триггер старые строки не трогает, это только информация.
select id, room_id, starts_at, ends_at
from public.bookings
where ends_at - starts_at > interval '8 hours'
   or (starts_at at time zone 'Europe/Moscow')::date <> (ends_at at time zone 'Europe/Moscow')::date;

-- =====================================================================
-- Блок 2. ПОСЛЕ применения: объекты и права
-- =====================================================================
-- Ожидается: trigger bookings_validate_time есть; constraint profiles_avatar_url_https есть;
-- profiles_update_own нет; authenticated не может UPDATE ни один столбец profiles.
select 'trigger' as kind, tgname::text as name
from pg_trigger
where tgrelid = 'public.bookings'::regclass and not tgisinternal
union all
select 'constraint', conname::text
from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'c'
union all
select 'profiles policy', policyname::text
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
union all
select 'authenticated может UPDATE', column_name::text
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE';

-- =====================================================================
-- Блок 3. ПОСЛЕ применения: негативные проверки от имени пользователя
-- =====================================================================
-- Запросы идут от роли authenticated с sub первого профиля, как через REST.
-- Если проверка не сработала, блок бросает P0001 и этим откатывает своё изменение;
-- контрольная бронь удаляется. В БД ничего не остаётся.
-- Ожидаемый результат — в столбце expected.
create temp table if not exists hw6_results (n int, check_name text, expected text, got text);
truncate hw6_results;

do $$
declare
  uid uuid := (select id from public.profiles order by created_at limit 1);
  -- Завтра по Москве, полночь
  tomorrow timestamptz := (date_trunc('day', now() at time zone 'Europe/Moscow') + interval '1 day')
    at time zone 'Europe/Moscow';
  got text;
  new_id uuid;
begin
  if uid is null then
    raise exception 'В profiles нет ни одной строки: войдите в приложение хотя бы раз';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  -- 1. Контроль: корректная бронь проходит (затем удаляется)
  set local role authenticated;
  begin
    insert into public.bookings (room_id, title, starts_at, ends_at)
    values ('volga', '[hw6] контроль', tomorrow + interval '30 days 10 hours', tomorrow + interval '30 days 11 hours')
    returning id into new_id;
    delete from public.bookings where id = new_id;
    got := 'вставлено и удалено';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  insert into hw6_results values (1, 'корректная бронь', 'вставлено и удалено', got);

  -- 2. Начало в прошлом
  set local role authenticated;
  begin
    insert into public.bookings (room_id, title, starts_at, ends_at)
    values ('volga', '[hw6] прошлое', now() - interval '2 hours', now() - interval '1 hour');
    raise exception 'вставлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  insert into hw6_results values (2, 'начало в прошлом', '23514', got);

  -- 3. Длиннее 8 часов (08:00–17:00 МСК)
  set local role authenticated;
  begin
    insert into public.bookings (room_id, title, starts_at, ends_at)
    values ('volga', '[hw6] 9 часов', tomorrow + interval '30 days 8 hours', tomorrow + interval '30 days 17 hours');
    raise exception 'вставлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  insert into hw6_results values (3, 'длиннее 8 часов', '23514', got);

  -- 4. Через полночь по Москве (23:00–01:00)
  set local role authenticated;
  begin
    insert into public.bookings (room_id, title, starts_at, ends_at)
    values ('volga', '[hw6] полночь', tomorrow + interval '30 days 23 hours', tomorrow + interval '31 days 1 hour');
    raise exception 'вставлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  insert into hw6_results values (4, 'через полночь МСК', '23514', got);

  -- 5. Пользователь меняет свой профиль: права UPDATE больше нет
  set local role authenticated;
  begin
    update public.profiles set display_name = 'Администратор' where id = uid;
    raise exception 'обновлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  insert into hw6_results values (5, 'UPDATE своего профиля', '42501', got);

  -- 6–7. CHECK на avatar_url (от владельца таблицы, в обход прав)
  begin
    update public.profiles set avatar_url = 'http://example.com/a.png' where id = uid;
    raise exception 'обновлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  insert into hw6_results values (6, 'avatar_url не https', '23514', got);

  begin
    update public.profiles set avatar_url = 'https://example.com/' || repeat('a', 500) where id = uid;
    raise exception 'обновлено (ошибка!), изменение откатывается' using errcode = 'P0001';
  exception when others then got := sqlstate || ': ' || sqlerrm;
  end;
  insert into hw6_results values (7, 'avatar_url длиннее 500', '23514', got);
end;
$$;

select * from hw6_results order by n;
