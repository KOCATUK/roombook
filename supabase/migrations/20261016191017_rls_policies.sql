-- Права ролей Data API и политики RLS.
-- GRANT решает, может ли роль вообще обратиться к таблице,
-- RLS — к каким строкам. Нужны оба слоя: без GRANT запрос падает
-- с permission denied, без RLS роль с GRANT видит и меняет всё.

-- =====================================================================
-- Включаем RLS на всех таблицах
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;

-- =====================================================================
-- GRANT
-- =====================================================================
-- Автоматическая выдача прав новым таблицам в проекте отключена.
-- Сначала снимаем всё, что могло достаться по умолчанию, чтобы итоговый
-- набор прав определялся только этим файлом.
revoke all on table public.profiles, public.rooms, public.bookings from anon, authenticated;

-- Доступ к схеме public: без USAGE роли не увидят ни одной таблицы в ней
grant usage on schema public to anon, authenticated;

-- rooms: список комнат показываем всем, в том числе без входа.
-- Прав на запись нет ни у одной роли API: комнаты меняются только миграциями.
grant select on table public.rooms to anon, authenticated;

-- bookings: расписание видно всем, в том числе без входа
grant select on table public.bookings to anon, authenticated;

-- bookings: создавать брони может только вошедший пользователь;
-- что автор — именно он, проверяет политика bookings_insert_own
grant insert on table public.bookings to authenticated;

-- bookings: менять разрешено только содержательные поля. user_id, id
-- и created_at не входят в список, поэтому бронь нельзя «передать»
-- другому пользователю или подделать дату создания даже своей брони.
grant update (room_id, title, starts_at, ends_at) on table public.bookings to authenticated;

-- bookings: удалять свои брони; чьи именно — ограничивает RLS
grant delete on table public.bookings to authenticated;

-- profiles: вошедшим нужно видеть имя и аватар авторов броней.
-- anon прав не получает: профили людей не показываем без входа.
grant select on table public.profiles to authenticated;

-- profiles: пользователь правит своё имя и аватар; id менять нельзя,
-- поэтому UPDATE выдан только на эти два столбца.
-- INSERT не выдаём: профиль создаёт триггер handle_new_user.
grant update (display_name, avatar_url) on table public.profiles to authenticated;

-- =====================================================================
-- Политики RLS
-- =====================================================================
-- auth.uid() обёрнут в (select ...), чтобы Postgres вычислил его один раз
-- на запрос, а не для каждой строки (рекомендация Supabase).

-- ---------- rooms ----------
-- Чтение всем. Политик на INSERT/UPDATE/DELETE нет: при включённом RLS
-- это означает запрет, вдобавок к отсутствию GRANT.
create policy rooms_select_all
  on public.rooms
  for select
  to anon, authenticated
  using (true);

-- ---------- bookings ----------
-- Чтение всем: расписание комнат публичное
create policy bookings_select_all
  on public.bookings
  for select
  to anon, authenticated
  using (true);

-- Создание: только от своего имени
create policy bookings_insert_own
  on public.bookings
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Изменение: только свои брони (using), и после изменения бронь
-- остаётся своей (with check)
create policy bookings_update_own
  on public.bookings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Удаление: только свои брони
create policy bookings_delete_own
  on public.bookings
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- profiles ----------
-- Чтение вошедшим: нужно для отображения автора брони
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

-- Изменение: только свой профиль
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Политик INSERT и DELETE на profiles нет: профиль создаёт триггер
-- (security definer обходит RLS), удаляется он каскадом вместе с auth.users.
