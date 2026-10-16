import { isSupabaseConfigured } from '../lib/supabase'
import type { Booking, BookingDraft, Room } from '../types'
import type { DataSource, GetBookingsOptions } from './apiTypes'
import * as mockApi from './mockApi'
import * as supabaseApi from './supabaseApi'

/**
 * mock, если в адресе есть ?scenario=... (демо-сценарии ДЗ4) или Supabase не настроен
 * (в том числе в тестах). Адрес читаем при каждом вызове, как и mock API
 */
export function getDataSource(): DataSource {
  const hasScenario = new URLSearchParams(window.location.search).has('scenario')
  return hasScenario || !isSupabaseConfigured ? 'mock' : 'supabase'
}

export function getRooms(): Promise<Room[]> {
  return getDataSource() === 'mock' ? mockApi.getRooms() : supabaseApi.getRooms()
}

export function getBookings(options?: GetBookingsOptions): Promise<Booking[]> {
  return getDataSource() === 'mock' ? mockApi.getBookings() : supabaseApi.getBookings(options)
}

export function createBooking(draft: BookingDraft): Promise<Booking> {
  return getDataSource() === 'mock'
    ? mockApi.createBooking(draft)
    : supabaseApi.createBooking(draft)
}

export function cancelBooking(id: Booking['id']): Promise<void> {
  return getDataSource() === 'mock' ? mockApi.cancelBooking(id) : supabaseApi.cancelBooking(id)
}
