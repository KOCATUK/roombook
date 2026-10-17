import { describe, expect, it } from 'vitest'
import { AppError, toAppError } from './appError'

// Формы ошибок как у supabase-js: PostgrestError без статуса (статус рядом в ответе),
// ответ при сбое fetch со status 0, AuthError со своим status
function postgrestError(code: string) {
  return { message: 'db message', details: '', hint: '', code }
}

describe('toAppError', () => {
  it('сбой fetch (TypeError) → network', () => {
    const error = toAppError(new TypeError('Failed to fetch'), 'getRooms')
    expect(error.kind).toBe('network')
    expect(error.message).toBe(
      'Не удалось загрузить комнаты. Нет связи с сервером. Проверьте интернет и повторите',
    )
  })

  it('ответ supabase-js со status 0 → network', () => {
    expect(toAppError(postgrestError(''), 'getBookings', 0).kind).toBe('network')
  })

  it('23P01 → conflict с сообщением о занятом времени', () => {
    // PostgREST отдаёт 23P01 со статусом 400 (видно в логах и Network):
    // конфликт определяется по коду, иначе 400 дал бы validation
    const error = toAppError(postgrestError('23P01'), 'createBooking', 400)
    expect(error.kind).toBe('conflict')
    expect(error.message).toBe('Это время уже занято. Выберите другое время')
  })

  it('401 → unauthorized, даже с кодом 42501', () => {
    expect(toAppError(postgrestError('42501'), 'createBooking', 401).kind).toBe('unauthorized')
  })

  it('истёкший JWT (PGRST303) → unauthorized', () => {
    expect(toAppError(postgrestError('PGRST303'), 'getBookings').kind).toBe('unauthorized')
  })

  it('403 или 42501 → forbidden', () => {
    expect(toAppError(postgrestError('42501'), 'cancelBooking', 403).kind).toBe('forbidden')
    expect(toAppError(postgrestError('42501'), 'cancelBooking').kind).toBe('forbidden')
    expect(toAppError({}, 'cancelBooking', 403).kind).toBe('forbidden')
  })

  it('23514, класс 22 и 400 → validation', () => {
    expect(toAppError(postgrestError('23514'), 'createBooking', 400).kind).toBe('validation')
    expect(toAppError(postgrestError('22007'), 'createBooking', 400).kind).toBe('validation')
    expect(toAppError(postgrestError('22001'), 'createBooking').kind).toBe('validation')
    expect(toAppError({}, 'createBooking', 400).kind).toBe('validation')
  })

  it('5xx → server', () => {
    expect(toAppError(postgrestError(''), 'getRooms', 503).kind).toBe('server')
  })

  it('статус из самой ошибки (AuthError) учитывается', () => {
    expect(toAppError({ status: 500, code: 'unexpected_failure' }, 'signIn').kind).toBe('server')
  })

  it('прочее → unknown', () => {
    expect(toAppError(new Error('boom'), 'getRooms').kind).toBe('unknown')
    expect(toAppError('строка', 'getRooms').kind).toBe('unknown')
    expect(toAppError(null, 'getRooms').kind).toBe('unknown')
    expect(toAppError(postgrestError('23505'), 'createBooking', 409).kind).toBe('unknown')
  })

  it('сохраняет операцию, статус и код в cause', () => {
    const error = toAppError(postgrestError('23514'), 'createBooking', 400)
    expect(error).toBeInstanceOf(AppError)
    expect(error.cause).toEqual({ operation: 'createBooking', status: 400, code: '23514' })
  })

  it('возвращает AppError без изменений', () => {
    const original = new AppError('forbidden', 'Нет прав', { operation: 'cancelBooking' })
    expect(toAppError(original, 'getRooms')).toBe(original)
  })
})
