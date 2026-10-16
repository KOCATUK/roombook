import { afterEach, describe, expect, it } from 'vitest'
import { isSupabaseConfigured } from '../lib/supabase'
import { getDataSource } from './api'

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('getDataSource', () => {
  // Если этот тест упал, остальные тесты могут ходить в настоящий Supabase:
  // проверьте test.env в vite.config.ts
  it('в тестах Supabase не настроен, даже если есть .env.local', () => {
    expect(isSupabaseConfigured).toBe(false)
  })

  it('без настроек Supabase выбирает mock', () => {
    expect(getDataSource()).toBe('mock')
  })

  it('с ?scenario=... выбирает mock', () => {
    window.history.pushState({}, '', '/?scenario=slow')
    expect(getDataSource()).toBe('mock')
  })
})
