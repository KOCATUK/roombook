import { createInitialBookings } from '../data/initialBookings'
import { ROOMS } from '../data/rooms'
import type { Booking, BookingDraft, BookingErrorCode, Room } from '../types'
import { validateBooking } from '../utils/bookings'
import { toLocalDateTime } from '../utils/dateTime'

const SCENARIOS = ['ok', 'slow', 'error', 'saveError', 'empty'] as const

type Scenario = (typeof SCENARIOS)[number]

export type ApiErrorCode = 'loadFailed' | 'saveFailed' | 'conflict' | 'invalid' | 'notFound'

const DEFAULT_SCENARIO: Scenario = 'ok'
const MIN_DELAY_MS = 400
const MAX_DELAY_MS = 800
// Сценарий slow нужен, чтобы успеть разглядеть скелетон и заблокированную кнопку
const SLOW_MIN_DELAY_MS = 2500
const SLOW_MAX_DELAY_MS = 3500

export class ApiError extends Error {
  code: ApiErrorCode
  validationErrors: BookingErrorCode[]

  constructor(code: ApiErrorCode, message: string, validationErrors: BookingErrorCode[] = []) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.validationErrors = validationErrors
  }
}

// Хранилище живёт в памяти модуля, как будто это сервер: сбрасывается при перезагрузке страницы
let bookingsStore: Booking[] = createInitialBookings(new Date())

function isScenario(value: string | null): value is Scenario {
  return SCENARIOS.some((scenario) => scenario === value)
}

// Читаем адрес при каждом вызове, а не один раз при загрузке модуля,
// чтобы тесты могли менять сценарий через history.replaceState
function getScenario(): Scenario {
  const value = new URLSearchParams(window.location.search).get('scenario')
  return isScenario(value) ? value : DEFAULT_SCENARIO
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function delay(scenario: Scenario): Promise<void> {
  const ms =
    scenario === 'slow'
      ? randomBetween(SLOW_MIN_DELAY_MS, SLOW_MAX_DELAY_MS)
      : randomBetween(MIN_DELAY_MS, MAX_DELAY_MS)
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function startRequest(): Promise<Scenario> {
  const scenario = getScenario()
  await delay(scenario)
  return scenario
}

// Отдаём копии, чтобы вызывающий код не мог изменить «серверные» данные в обход API
function cloneBooking(booking: Booking): Booking {
  return { ...booking }
}

export async function getRooms(): Promise<Room[]> {
  const scenario = await startRequest()

  if (scenario === 'error') {
    throw new ApiError('loadFailed', 'Не удалось загрузить комнаты')
  }
  if (scenario === 'empty') {
    return []
  }
  return ROOMS.map((room) => ({ ...room, equipment: [...room.equipment] }))
}

export async function getBookings(): Promise<Booking[]> {
  const scenario = await startRequest()

  if (scenario === 'error') {
    throw new ApiError('loadFailed', 'Не удалось загрузить расписание')
  }
  if (scenario === 'empty') {
    return []
  }
  return bookingsStore.map(cloneBooking)
}

export async function createBooking(draft: BookingDraft): Promise<Booking> {
  const scenario = await startRequest()

  if (scenario === 'saveError') {
    throw new ApiError('saveFailed', 'Не удалось сохранить бронь')
  }

  // Проверяем повторно, как сервер: пока шёл запрос, время мог занять кто-то другой
  const result = validateBooking(draft, bookingsStore, toLocalDateTime(new Date()))
  if (!result.ok) {
    if (result.errors.includes('overlap')) {
      throw new ApiError(
        'conflict',
        'Это время только что заняли. Выберите другое время',
        result.errors,
      )
    }
    throw new ApiError('invalid', 'Проверьте данные брони', result.errors)
  }

  const booking: Booking = { ...draft, id: crypto.randomUUID() }
  bookingsStore = [...bookingsStore, booking]
  return cloneBooking(booking)
}

export async function cancelBooking(id: Booking['id']): Promise<void> {
  const scenario = await startRequest()

  if (scenario === 'saveError') {
    throw new ApiError('saveFailed', 'Не удалось отменить бронь')
  }
  if (!bookingsStore.some((booking) => booking.id === id)) {
    throw new ApiError('notFound', 'Бронь не найдена: возможно, её уже отменили')
  }
  bookingsStore = bookingsStore.filter((booking) => booking.id !== id)
}
