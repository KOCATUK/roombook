import type { BookingInsert, BookingRow, RoomRow } from '../lib/database.types'
import type { Booking, BookingDraft, Equipment, LocalDateTime, Room } from '../types'
import { parseLocalDateTime, toLocalDateTime } from '../utils/dateTime'

const EQUIPMENT: Equipment[] = ['projector', 'whiteboard', 'videoConference']

export type RoomRowSelected = Pick<RoomRow, 'id' | 'name' | 'floor' | 'capacity' | 'equipment'>

/** Строка брони; profiles есть, только если запросили вместе с автором */
export type BookingRowWithAuthor = Pick<
  BookingRow,
  'id' | 'room_id' | 'user_id' | 'title' | 'starts_at' | 'ends_at'
> & {
  profiles?: { display_name: string } | null
}

function isEquipment(value: string): value is Equipment {
  return EQUIPMENT.some((item) => item === value)
}

/**
 * timestamptz из БД (`2026-10-16T07:00:00+00:00`) → локальное `YYYY-MM-DDTHH:mm`.
 * В строке из БД есть смещение, поэтому разбор через Date однозначен
 */
export function fromDbTimestamp(value: string): LocalDateTime {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Некорректная дата в ответе сервера')
  }
  return toLocalDateTime(date)
}

/**
 * Локальное `YYYY-MM-DDTHH:mm` → ISO в UTC для timestamptz. Строку разбираем
 * как локальное время браузера: иначе бронь съехала бы на часовой пояс
 */
export function toDbTimestamp(value: LocalDateTime): string {
  const date = parseLocalDateTime(value)
  if (!date) {
    throw new Error('Некорректные дата и время брони')
  }
  return date.toISOString()
}

export function mapRoomRow(row: RoomRowSelected): Room {
  return {
    id: row.id,
    name: row.name,
    floor: row.floor,
    capacity: row.capacity,
    // CHECK в БД не пускает чужие значения, но тип text[] об этом не знает
    equipment: row.equipment.filter(isEquipment),
  }
}

export function mapBookingRow(row: BookingRowWithAuthor): Booking {
  const booking: Booking = {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    title: row.title,
    start: fromDbTimestamp(row.starts_at),
    end: fromDbTimestamp(row.ends_at),
  }
  const authorName = row.profiles?.display_name
  return authorName ? { ...booking, authorName } : booking
}

// user_id не передаём: его подставляет default auth.uid(), а RLS проверяет
export function mapBookingDraftToInsert(draft: BookingDraft): BookingInsert {
  return {
    room_id: draft.roomId,
    title: draft.title,
    starts_at: toDbTimestamp(draft.start),
    ends_at: toDbTimestamp(draft.end),
  }
}
