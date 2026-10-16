import type {
  Booking,
  BookingDraft,
  BookingErrorCode,
  BookingValidationResult,
  LocalDateTime,
  Room,
} from '../types'
import { getDatePart, parseLocalDateTime } from './dateTime'

type TimeRange = Pick<Booking, 'start' | 'end'>

// Строки YYYY-MM-DDTHH:mm фиксированной ширины сравниваются лексикографически
// так же, как хронологически, поэтому здесь не нужен Date и нет риска сдвига на часовой пояс

/** Полуоткрытые интервалы: бронь до 10:00 не пересекается с бронью с 10:00 */
function isOverlapping(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end
}

function findConflict(
  draft: BookingDraft,
  bookings: Booking[],
): Booking | undefined {
  return bookings.find(
    (booking) => booking.roomId === draft.roomId && isOverlapping(draft, booking),
  )
}

export function validateBooking(
  draft: BookingDraft,
  bookings: Booking[],
  now: LocalDateTime,
): BookingValidationResult {
  const errors: BookingErrorCode[] = []

  if (draft.title.trim() === '') {
    errors.push('emptyTitle')
  }

  // Остальные проверки сравнивают строки и на невалидных значениях дадут ложные ошибки
  if (!parseLocalDateTime(draft.start) || !parseLocalDateTime(draft.end)) {
    errors.push('invalidDateTime')
    return { ok: false, errors }
  }

  const isRangeValid = draft.start < draft.end
  if (!isRangeValid) {
    errors.push('endNotAfterStart')
  } else if (getDatePart(draft.start) !== getDatePart(draft.end)) {
    errors.push('crossesMidnight')
  }

  if (draft.start < now) {
    errors.push('startInPast')
  }

  // Пересечение с перевёрнутым интервалом бессмысленно, поэтому ищем только для корректного
  const conflict = isRangeValid ? findConflict(draft, bookings) : undefined
  if (conflict) {
    errors.push('overlap')
  }

  if (errors.length === 0) {
    return { ok: true }
  }
  return conflict ? { ok: false, errors, conflict } : { ok: false, errors }
}

export function getCurrentBooking(
  roomId: Room['id'],
  bookings: Booking[],
  now: LocalDateTime,
): Booking | undefined {
  return bookings.find(
    (booking) =>
      booking.roomId === roomId && booking.start <= now && now < booking.end,
  )
}

export function getRoomBookings(
  roomId: Room['id'],
  bookings: Booking[],
): Booking[] {
  return bookings
    .filter((booking) => booking.roomId === roomId)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}
