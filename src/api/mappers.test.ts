import { describe, expect, it } from 'vitest'
import { toLocalDateTime } from '../utils/dateTime'
import {
  fromDbTimestamp,
  mapBookingDraftToInsert,
  mapBookingRow,
  mapRoomRow,
  toDbTimestamp,
} from './mappers'

// Ожидания строим через локальный Date, а не литералами UTC:
// тесты должны проходить в любом часовом поясе машины
describe('toDbTimestamp', () => {
  it('переводит локальное время в ISO-строку UTC', () => {
    expect(toDbTimestamp('2026-10-16T10:00')).toBe(
      new Date(2026, 9, 16, 10, 0).toISOString(),
    )
  })

  it('отклоняет несуществующую дату и неверный формат', () => {
    expect(() => toDbTimestamp('2026-02-30T10:00')).toThrow()
    expect(() => toDbTimestamp('2026-10-16 10:00')).toThrow()
  })
})

describe('fromDbTimestamp', () => {
  it('переводит timestamptz в локальное время браузера', () => {
    const utcMoment = new Date(Date.UTC(2026, 9, 16, 7, 30))
    expect(fromDbTimestamp('2026-10-16T07:30:00+00:00')).toBe(toLocalDateTime(utcMoment))
  })

  it('учитывает смещение в строке', () => {
    expect(fromDbTimestamp('2026-10-16T10:30:00+03:00')).toBe(
      fromDbTimestamp('2026-10-16T07:30:00+00:00'),
    )
  })

  it('отбрасывает секунды', () => {
    expect(fromDbTimestamp('2026-10-16T07:30:45+00:00')).toBe(
      fromDbTimestamp('2026-10-16T07:30:00+00:00'),
    )
  })

  it('бросает ошибку на некорректной строке', () => {
    expect(() => fromDbTimestamp('not a date')).toThrow()
  })

  it('в паре с toDbTimestamp возвращает исходное значение', () => {
    expect(fromDbTimestamp(toDbTimestamp('2026-10-16T23:45'))).toBe('2026-10-16T23:45')
  })
})

describe('mapRoomRow', () => {
  it('переименовывает поля и отбрасывает неизвестное оборудование', () => {
    expect(
      mapRoomRow({
        id: 'baikal',
        name: 'Байкал',
        floor: 3,
        capacity: 8,
        equipment: ['projector', 'coffeeMachine', 'whiteboard'],
      }),
    ).toEqual({
      id: 'baikal',
      name: 'Байкал',
      floor: 3,
      capacity: 8,
      equipment: ['projector', 'whiteboard'],
    })
  })
})

describe('mapBookingRow', () => {
  const row = {
    id: 'b1',
    room_id: 'volga',
    user_id: 'u1',
    title: 'Ретро',
    starts_at: new Date(2026, 9, 16, 10, 0).toISOString(),
    ends_at: new Date(2026, 9, 16, 11, 0).toISOString(),
  }

  it('без profiles (гость) не добавляет имя автора', () => {
    expect(mapBookingRow(row)).toEqual({
      id: 'b1',
      roomId: 'volga',
      userId: 'u1',
      title: 'Ретро',
      start: '2026-10-16T10:00',
      end: '2026-10-16T11:00',
    })
  })

  it('с profiles добавляет имя автора', () => {
    expect(mapBookingRow({ ...row, profiles: { display_name: 'Анна' } })).toMatchObject({
      authorName: 'Анна',
    })
  })

  it('профиль null не ломает преобразование', () => {
    expect(mapBookingRow({ ...row, profiles: null })).not.toHaveProperty('authorName')
  })
})

describe('mapBookingDraftToInsert', () => {
  it('переводит черновик в строку для вставки без user_id', () => {
    const insert = mapBookingDraftToInsert({
      roomId: 'elbrus',
      title: 'Планирование',
      start: '2026-10-16T09:00',
      end: '2026-10-16T09:30',
    })
    expect(insert).toEqual({
      room_id: 'elbrus',
      title: 'Планирование',
      starts_at: new Date(2026, 9, 16, 9, 0).toISOString(),
      ends_at: new Date(2026, 9, 16, 9, 30).toISOString(),
    })
    expect(insert).not.toHaveProperty('user_id')
  })
})
