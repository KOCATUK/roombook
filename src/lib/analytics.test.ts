import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// В тестах аналитика выключена по MODE и по mock API (Supabase не настроен).
// Чтобы проверить отправку, подменяем оба условия
vi.mock('../api/api', () => ({ getDataSource: vi.fn(() => 'supabase') }))

// Модуль помнит, что gtag.js уже подключён, поэтому каждый тест берёт свежую копию
async function loadAnalytics() {
  vi.resetModules()
  return import('./analytics')
}

describe('trackEvent', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    window.gtag = gtag
    document.head.replaceChildren()
  })

  afterEach(() => {
    gtag.mockReset()
    delete window.gtag
    vi.unstubAllEnvs()
  })

  it('в тестовом режиме ничего не отправляет', async () => {
    const { isAnalyticsEnabled, trackEvent } = await loadAnalytics()
    trackEvent('booking_created', { room_id: 'volga' })

    expect(isAnalyticsEnabled()).toBe(false)
    expect(gtag).not.toHaveBeenCalled()
  })

  it('отправляет событие через gtag с room_id и типом ошибки', async () => {
    vi.stubEnv('MODE', 'production')
    const { trackEvent } = await loadAnalytics()

    trackEvent('booking_failed', { room_id: 'volga', error_type: 'conflict' })

    expect(gtag).toHaveBeenCalledWith('event', 'booking_failed', {
      room_id: 'volga',
      error_type: 'conflict',
    })
  })

  it('подключает gtag.js один раз и без inline-скрипта', async () => {
    vi.stubEnv('MODE', 'production')
    const { trackEvent } = await loadAnalytics()

    trackEvent('login', { method: 'github' })
    trackEvent('booking_cancelled', { room_id: 'baikal' })

    const scripts = document.head.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('src')).toBe('https://www.googletagmanager.com/gtag/js?id=G-4L0GDRVT5T')
    expect(scripts[0].textContent).toBe('')
    expect(gtag).toHaveBeenCalledWith('config', 'G-4L0GDRVT5T')
  })

  it('сбой gtag не выбрасывается наружу', async () => {
    vi.stubEnv('MODE', 'production')
    const { trackEvent } = await loadAnalytics()
    gtag.mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => trackEvent('booking_created', { room_id: 'volga' })).not.toThrow()
  })
})

describe('getErrorType', () => {
  it('берёт kind из AppError и не использует текст', async () => {
    const { getErrorType } = await loadAnalytics()
    const { AppError } = await import('../api/appError')
    const error = new AppError('conflict', 'Это время уже занято', { operation: 'createBooking' })
    expect(getErrorType(error)).toBe('conflict')
    expect(getErrorType(new Error('секретный текст'))).toBe('unknown')
  })
})
