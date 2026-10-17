-- Закрывает находки S-02, S-03 и S-04 из security_audit.md.
-- Порядок важен: CHECK на avatar_url идёт первым. Если существующие строки
-- ему не соответствуют, миграция упадёт до остальных изменений.
-- Проверка до и после применения: docs/hw6/harden_check.sql.

-- =====================================================================
-- S-04: формат и длина profiles.avatar_url
-- =====================================================================
-- Только https: аватар выводится в <img src>, а CSP разрешает картинки
-- лишь с https-хостов. 500 символов с запасом хватает URL GitHub и Google.
alter table public.profiles
  add constraint profiles_avatar_url_https
  check (avatar_url is null or (avatar_url like 'https://%' and char_length(avatar_url) <= 500));

-- Тот же триггер, что в 20261016191012_schema.sql, но неподходящий аватар
-- заменяется на null: иначе новый CHECK уронил бы триггер, и вход вернул бы
-- «Database error saving new user».
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
        nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
        'Пользователь'
      ),
      100
    ),
    case
      when avatar like 'https://%' and char_length(avatar) <= 500 then avatar
    end
  );
  return new;
end;
$$;

-- create or replace сохраняет права, но повторяем отзыв явно, как в исходной миграции
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- S-03: профили с клиента не меняются
-- =====================================================================
-- В src/ нет ни одного обновления profiles: имя и аватар задаёт триггер
-- при первом входе. Без права UPDATE нельзя переименовать себя, например,
-- в «Администратор», а политика UPDATE становится лишней.
drop policy profiles_update_own on public.profiles;
revoke update (display_name, avatar_url) on table public.profiles from authenticated;
-- Право на уровне таблицы не выдавалось, отзываем на случай ручной выдачи
revoke update on table public.profiles from authenticated;

-- =====================================================================
-- S-02: правила времени брони на сервере
-- =====================================================================
-- Повторяет validateBooking из src/utils/bookings.ts: клиентскую проверку
-- можно обойти прямым запросом к REST. errcode 23514 (check_violation):
-- PostgREST вернёт 400, а appError.ts отнесёт ошибку к validation.
-- Тексты совпадают с BOOKING_ERROR_MESSAGES (src/utils/bookingErrors.ts).
create function public.validate_booking_time()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_duration constant interval := interval '8 hours';
  -- Клиент сравнивает время с точностью до минуты (useNow), а запрос идёт
  -- не мгновенно: без допуска бронь «на текущую минуту» могла бы не пройти
  past_tolerance constant interval := interval '1 minute';
  -- В клиенте «один день» считается по часовому поясу браузера. Сервер его
  -- не знает, поэтому берём пояс офиса
  office_time_zone constant text := 'Europe/Moscow';
begin
  -- UPDATE OF срабатывает и при записи тех же значений; тогда проверять нечего,
  -- иначе старую бронь нельзя было бы сохранить с прежним временем
  if tg_op = 'UPDATE'
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;

  if new.ends_at <= new.starts_at then
    raise exception 'Время окончания должно быть позже времени начала'
      using errcode = '23514';
  end if;

  if new.ends_at - new.starts_at > max_duration then
    raise exception 'Бронь не может быть длиннее 8 часов'
      using errcode = '23514';
  end if;

  -- Как crossesMidnight в клиенте: даты начала и конца должны совпадать,
  -- поэтому конец ровно в 00:00 следующего дня тоже запрещён
  if (new.starts_at at time zone office_time_zone)::date
    <> (new.ends_at at time zone office_time_zone)::date then
    raise exception 'Бронь должна начинаться и заканчиваться в один день (по московскому времени)'
      using errcode = '23514';
  end if;

  -- При UPDATE начало проверяем, только если оно меняется: продлить уже
  -- идущую встречу можно, а перенести бронь в прошлое нельзя
  if (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at)
    and new.starts_at < now() - past_tolerance then
    raise exception 'Нельзя забронировать время в прошлом'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Функцию вызывает только триггер. Права EXECUTE при срабатывании триггера
-- не проверяются, поэтому отзыв ему не мешает (как и handle_new_user)
revoke execute on function public.validate_booking_time() from public, anon, authenticated;

-- Существующие строки триггер не проверяет: он срабатывает только на новые
-- INSERT и на UPDATE времени
create trigger bookings_validate_time
  before insert or update of starts_at, ends_at on public.bookings
  for each row execute function public.validate_booking_time();
