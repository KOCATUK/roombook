import type { LocalDateTime } from '../types'

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

export function parseLocalDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value)
  if (!match) {
    return null
  }

  const [year, month, day, hours, minutes] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hours, minutes)

  // Date молча переносит переполнение (30 февраля станет 2 марта, 25:00 следующим днём),
  // поэтому сверяем компоненты обратно, чтобы отсечь несуществующие значения
  const isSameMoment =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes

  return isSameMoment ? date : null
}

// Без toISOString: он переводит время в UTC и сдвигает дату на часовой пояс
export function toLocalDateTime(date: Date): LocalDateTime {
  const datePart = `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`
  const timePart = `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`
  return `${datePart}T${timePart}`
}

/** Склеивает значения полей `type="date"` и `type="time"` */
export function combineDateTime(date: string, time: string): LocalDateTime {
  return `${date}T${time}`
}

/** YYYY-MM-DD */
export function getDatePart(value: LocalDateTime): string {
  return value.slice(0, 10)
}

/** DD.MM.YYYY */
export function formatDate(value: LocalDateTime): string {
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
}

/** HH:mm */
export function formatTime(value: LocalDateTime): string {
  return value.slice(11, 16)
}
