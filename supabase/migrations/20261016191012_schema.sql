-- Схема RoomBook: профили, комнаты, брони.
-- Права и RLS вынесены в следующую миграцию, начальные комнаты — в третью.

-- btree_gist нужен, чтобы в одном GiST-ограничении исключения сравнивать
-- room_id через "=" и интервалы через "&&". Ставим в схему extensions,
-- как принято в Supabase, чтобы не засорять public и Data API.
create extension if not exists btree_gist with schema extensions;

-- =====================================================================
-- profiles
-- =====================================================================
-- Отдельная таблица, а не auth.users напрямую: схема auth не открыта
-- для Data API, а имя и аватар автора брони клиенту показывать нужно.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Публичный профиль пользователя, создаётся триггером при первом входе';

-- =====================================================================
-- rooms
-- =====================================================================
-- id — текстовый slug ('baikal'), чтобы совпадать с Room.id в клиенте
-- и не переписывать существующие данные и тесты.
create table public.rooms (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  floor smallint not null,
  capacity integer not null check (capacity > 0),
  -- Массив, а не справочная таблица: набор значений мал и совпадает
  -- с типом Equipment в src/types.ts. CHECK не даёт записать неизвестное.
  equipment text[] not null default '{}'
    check (equipment <@ array['projector', 'whiteboard', 'videoConference']::text[]),
  created_at timestamptz not null default now()
);

comment on table public.rooms is 'Переговорные комнаты; меняются только миграциями, не с клиента';

-- =====================================================================
-- bookings
-- =====================================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- restrict: комнату с бронями нельзя удалить случайно, история не теряется
  room_id text not null references public.rooms (id) on delete restrict,
  -- Ссылка на profiles, а не на auth.users: так PostgREST может отдать
  -- бронь вместе с именем автора одним запросом (embed profiles).
  -- default auth.uid(): клиенту не нужно передавать автора, а RLS
  -- всё равно проверяет, что он совпадает с текущим пользователем.
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint bookings_ends_after_starts check (ends_at > starts_at),

  -- Пересечение броней проверяет сама БД: проверка в клиенте не защищает
  -- от гонки двух одновременных запросов. '[)' — полуоткрытый интервал,
  -- как в validateBooking: бронь до 10:00 не мешает брони с 10:00.
  -- Класс операторов указан явно со схемой: так видно, что он из
  -- btree_gist, и миграция упадёт сразу, если расширение не в extensions.
  constraint bookings_no_overlap exclude using gist (
    room_id extensions.gist_text_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

comment on table public.bookings is 'Брони комнат; интервал [starts_at, ends_at)';

-- GiST-индекс ограничения исключения уже покрывает поиск броней комнаты
-- по интервалу. Отдельный индекс нужен для FK и для RLS-условия
-- user_id = auth.uid() (выборка «мои брони», каскадное удаление профиля).
create index bookings_user_id_idx on public.bookings (user_id);

-- =====================================================================
-- Автосоздание профиля при первом входе
-- =====================================================================
-- security definer: триггер срабатывает от имени supabase_auth_admin,
-- у которого нет прав на public.profiles. Пустой search_path защищает
-- от подмены объектов, поэтому все имена указаны со схемой.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- GitHub кладёт имя в full_name/name, а логин в user_name;
    -- имя может быть пустым, тогда берём логин или часть e-mail.
    -- left(..., 100): длинное имя иначе нарушит CHECK, триггер упадёт,
    -- и вход вернёт «Database error saving new user».
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
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Функцию вызывает только триггер; через RPC её дёргать незачем
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
