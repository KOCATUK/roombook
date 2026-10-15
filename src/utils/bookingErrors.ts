import type { BookingErrorCode } from '../types'

export const BOOKING_ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  emptyTitle: 'Укажите название встречи',
  invalidDateTime: 'Укажите корректные дату и время',
  endNotAfterStart: 'Время окончания должно быть позже времени начала',
  crossesMidnight: 'Бронь должна начинаться и заканчиваться в один день',
  startInPast: 'Нельзя забронировать время в прошлом',
  overlap: 'Комната уже занята в это время',
}
