export type Equipment = 'projector' | 'whiteboard' | 'videoConference'

export interface Room {
  id: string
  name: string
  floor: number
  /** Вместимость, человек */
  capacity: number
  equipment: Equipment[]
}

/** Локальное время без часового пояса: YYYY-MM-DDTHH:mm */
export type LocalDateTime = string

export interface Booking {
  id: string
  roomId: Room['id']
  /** id автора; есть только у броней из Supabase, в mock API автора нет */
  userId?: string
  /** Имя автора; приходит только вошедшему пользователю (гостю profiles недоступны) */
  authorName?: string
  /** Название встречи */
  title: string
  /** Начало, включительно */
  start: LocalDateTime
  /** Конец, не включительно: интервал [start, end) */
  end: LocalDateTime
}

export type BookingDraft = Omit<Booking, 'id'>

export type BookingErrorCode =
  | 'emptyTitle'
  | 'invalidDateTime'
  | 'endNotAfterStart'
  | 'crossesMidnight'
  | 'startInPast'
  | 'overlap'

export type BookingValidationResult =
  | { ok: true }
  | { ok: false; errors: BookingErrorCode[]; conflict?: Booking }

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
