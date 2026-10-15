import type { Booking } from '../types'
import { combineDateTime, getDatePart, toLocalDateTime } from '../utils/dateTime'

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

// Демо-брони строятся от текущего времени, иначе статус «Занята» был бы виден
// только в определённые часы
export function createInitialBookings(now: Date): Booking[] {
  const today = getDatePart(toLocalDateTime(now))
  const hour = now.getHours()
  // Бронь не переходит через полночь, поэтому в 23:xx заканчиваем в 23:59
  const currentHourEnd = hour < 23 ? formatHour(hour + 1) : '23:59'

  return [
    {
      id: 'demo-elbrus-current',
      roomId: 'elbrus',
      title: 'Планёрка',
      start: combineDateTime(today, formatHour(hour)),
      end: combineDateTime(today, currentHourEnd),
    },
    {
      id: 'demo-volga-evening',
      roomId: 'volga',
      title: 'Ретроспектива',
      start: combineDateTime(today, '18:00'),
      end: combineDateTime(today, '19:00'),
    },
  ]
}
