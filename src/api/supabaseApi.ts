import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'
import type { Booking, BookingDraft, Room } from '../types'
import { AppError, toAppError } from './appError'
import type { ApiOperation } from './appError'
import type { GetBookingsOptions } from './apiTypes'
import { mapBookingDraftToInsert, mapBookingRow, mapRoomRow } from './mappers'

const ROOM_COLUMNS = 'id, name, floor, capacity, equipment'
const BOOKING_COLUMNS = 'id, room_id, user_id, title, starts_at, ends_at'
// Связь через bookings_user_id_fkey; гостю этот вариант недоступен:
// у anon нет SELECT на profiles, и PostgREST отклонил бы весь запрос
const BOOKING_COLUMNS_WITH_AUTHOR = `${BOOKING_COLUMNS}, profiles(display_name)`

function getClient(operation: ApiOperation): SupabaseClient<Database> {
  if (!supabase) {
    throw new AppError('unknown', 'Supabase не настроен', { operation })
  }
  return supabase
}

// Единая точка, где ошибка превращается в AppError и попадает в лог
async function run<T>(operation: ApiOperation, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error: unknown) {
    const appError = toAppError(error, operation)
    logger.error('API request failed', {
      operation,
      kind: appError.kind,
      status: appError.cause.status,
      code: appError.cause.code,
    })
    throw appError
  }
}

export function getRooms(): Promise<Room[]> {
  return run('getRooms', async () => {
    const { data, error, status } = await getClient('getRooms')
      .from('rooms')
      .select(ROOM_COLUMNS)
      .order('floor')
      .order('name')
    if (error) {
      throw toAppError(error, 'getRooms', status)
    }
    return data.map(mapRoomRow)
  })
}

export function getBookings(options: GetBookingsOptions = {}): Promise<Booking[]> {
  return run('getBookings', async () => {
    const client = getClient('getBookings')
    const { data, error, status } = options.withAuthors
      ? await client.from('bookings').select(BOOKING_COLUMNS_WITH_AUTHOR).order('starts_at')
      : await client.from('bookings').select(BOOKING_COLUMNS).order('starts_at')
    if (error) {
      throw toAppError(error, 'getBookings', status)
    }
    return data.map(mapBookingRow)
  })
}

export function createBooking(draft: BookingDraft): Promise<Booking> {
  return run('createBooking', async () => {
    const { data, error, status } = await getClient('createBooking')
      .from('bookings')
      .insert(mapBookingDraftToInsert(draft))
      .select(BOOKING_COLUMNS)
      .single()
    if (error) {
      throw toAppError(error, 'createBooking', status)
    }
    return mapBookingRow(data)
  })
}

export function cancelBooking(id: Booking['id']): Promise<void> {
  return run('cancelBooking', async () => {
    // select нужен, чтобы узнать, удалилось ли что-то: чужую или уже
    // удалённую бронь RLS молча пропускает, и ошибки при этом нет
    const { data, error, status } = await getClient('cancelBooking')
      .from('bookings')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) {
      throw toAppError(error, 'cancelBooking', status)
    }
    if (data.length === 0) {
      throw new AppError(
        'forbidden',
        'Не удалось отменить бронь. Возможно, её уже отменили или она принадлежит другому пользователю',
        { operation: 'cancelBooking', status },
      )
    }
  })
}
