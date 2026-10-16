import type { Booking, LocalDateTime, Room } from '../types'
import { getCurrentBooking } from './bookings'

export interface RoomSummary {
  total: number
  free: number
  occupied: number
}

export function getRoomSummary(
  rooms: Room[],
  bookings: Booking[],
  now: LocalDateTime,
): RoomSummary {
  const occupied = rooms.filter((room) =>
    getCurrentBooking(room.id, bookings, now),
  ).length
  return { total: rooms.length, free: rooms.length - occupied, occupied }
}

/** «Всего: N · Свободно: M · Занято: K» */
export function formatRoomSummary({ total, free, occupied }: RoomSummary): string {
  return `Всего: ${total} · Свободно: ${free} · Занято: ${occupied}`
}
