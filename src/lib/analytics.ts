import { getDataSource } from '../api/api'
import { AppError } from '../api/appError'

// Measurement ID публичный: он всё равно виден в адресе скрипта gtag.js
const DEFAULT_MEASUREMENT_ID = 'G-4L0GDRVT5T'
const GTAG_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'

export type AnalyticsEventName = 'login' | 'booking_created' | 'booking_cancelled' | 'booking_failed'

/**
 * Закрытый набор параметров: название встречи, user_id, e-mail, имя и токены
 * сюда не помещаются по типу
 */
export interface AnalyticsParams {
  room_id?: string
  /** Вид ошибки (AppError.kind), без текста сообщения */
  error_type?: string
  method?: 'github'
}

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let isInitialized = false

function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID
}

// В тестах и на mock API (?scenario=, демо без Supabase) события были бы мусором
export function isAnalyticsEnabled(): boolean {
  return import.meta.env.MODE !== 'test' && getDataSource() !== 'mock'
}

/** Подключает gtag.js; повторные вызовы ничего не делают */
export function initAnalytics(): void {
  if (isInitialized || !isAnalyticsEnabled()) {
    return
  }
  isInitialized = true
  const measurementId = getMeasurementId()

  // То же, что inline-фрагмент из инструкции Google, но в модуле: CSP запрещает inline-скрипты
  window.dataLayer = window.dataLayer ?? []
  const dataLayer = window.dataLayer
  window.gtag =
    window.gtag ??
    function () {
      // gtag.js разбирает именно объект arguments: массив из rest-параметров
      // он принимает за команду другого формата и событие теряется
      // eslint-disable-next-line prefer-rest-params -- нужен объект Arguments, а не массив (см. выше)
      dataLayer.push(arguments)
    }
  window.gtag('js', new Date())
  window.gtag('config', measurementId)

  const script = document.createElement('script')
  script.async = true
  script.src = `${GTAG_SCRIPT_URL}?id=${encodeURIComponent(measurementId)}`
  document.head.append(script)
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsParams = {}): void {
  if (!isAnalyticsEnabled()) {
    return
  }
  try {
    initAnalytics()
    window.gtag?.('event', name, params)
  } catch {
    // Сбой аналитики не должен мешать бронированию
  }
}

/** Вид ошибки для booking_failed: только код, текст сообщения может содержать данные */
export function getErrorType(error: unknown): string {
  return error instanceof AppError ? error.kind : 'unknown'
}
