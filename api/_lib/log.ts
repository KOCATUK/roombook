// Структурированные логи serverless-функций: одна JSON-строка на событие.
// Vercel сохраняет вывод консоли как есть, поэтому строки можно фильтровать
// по level, route и request_id. Токены, ключи и тексты ошибок сюда не пишем.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogValue = string | number | boolean | null | undefined

export type LogFields = Record<string, LogValue>

export interface RequestLogger {
  requestId: string
  log: (level: LogLevel, msg: string, fields?: LogFields) => void
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const DEFAULT_LEVEL: LogLevel = 'info'

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && value in LEVEL_ORDER
}

// Порог читаем при каждом событии: так LOG_LEVEL можно менять в тестах
function getMinLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL
  return isLogLevel(fromEnv) ? fromEnv : DEFAULT_LEVEL
}

export function formatLogLine(
  level: LogLevel,
  msg: string,
  base: { route: string; request_id: string; latencyMs: number },
  fields: LogFields = {},
): string {
  // Обязательные поля пишем последними, чтобы fields не могли их подменить
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
    route: base.route,
    request_id: base.request_id,
    latencyMs: base.latencyMs,
  })
}

/**
 * Логгер одного запроса. request_id берём из x-vercel-id, чтобы строки
 * сопоставлялись с журналом запросов Vercel; локально генерируем свой
 */
export function createRequestLogger(route: string, request: Request): RequestLogger {
  const requestId = request.headers.get('x-vercel-id') ?? crypto.randomUUID()
  const startedAt = performance.now()

  return {
    requestId,
    log(level, msg, fields) {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[getMinLevel()]) {
        return
      }
      const latencyMs = Math.round(performance.now() - startedAt)
      console[level](formatLogLine(level, msg, { route, request_id: requestId, latencyMs }, fields))
    },
  }
}
