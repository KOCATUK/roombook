-- Начальный список комнат, совпадает с src/data/rooms.ts.
-- Комнаты — справочные данные, нужные в каждом окружении, поэтому они
-- в миграции, а не в seed.sql (тот применяется только локально).
-- on conflict do nothing: повторный прогон не ломает и не затирает
-- комнаты, которые позже поменяли другой миграцией.
insert into public.rooms (id, name, floor, capacity, equipment)
values
  ('baikal', 'Байкал', 3, 8, array['projector', 'whiteboard', 'videoConference']),
  ('elbrus', 'Эльбрус', 5, 4, array['whiteboard']),
  ('volga', 'Волга', 2, 12, array['projector', 'videoConference'])
on conflict (id) do nothing;
