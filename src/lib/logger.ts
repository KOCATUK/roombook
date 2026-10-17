// В контекст кладём только технические поля (операция, вид ошибки, статус, код).
// Тексты ошибок БД не логируем: в details Postgres попадают значения строк
type LogValue = string | number | boolean | null | undefined

export type LogContext = Record<string, LogValue>

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Принимает api/log.ts; тот же origin, поэтому CSP connect-src 'self' это разрешает
const LOG_ENDPOINT = '/api/log'

/** Одна JSON-строка, как в serverless-функциях: ts, level, msg и поля контекста */
export function formatLogEntry(level: LogLevel, msg: string, context: LogContext = {}): string {
  // Обязательные поля пишем последними, чтобы контекст не мог их подменить
  return JSON.stringify({ ...context, ts: new Date().toISOString(), level, msg })
}

// sendBeacon не ждёт ответа и доходит даже при закрытии вкладки.
// В dev функций Vercel нет, а в тестах сеть не нужна, поэтому только в production
function sendToServer(level: LogLevel, msg: string, context: LogContext) {
  if (!import.meta.env.PROD || typeof navigator.sendBeacon !== 'function') {
    return
  }
  try {
    const body = new Blob([JSON.stringify({ ...context, level, msg })], { type: 'application/json' })
    navigator.sendBeacon(LOG_ENDPOINT, body)
  } catch {
    // Сбой отправки лога не должен ломать приложение
  }
}

function write(level: LogLevel, msg: string, context?: LogContext) {
  console[level](formatLogEntry(level, msg, context))
}

export const logger = {
  // debug и info нужны только при разработке
  debug(msg: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      write('debug', msg, context)
    }
  },
  info(msg: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      write('info', msg, context)
    }
  },
  warn(msg: string, context?: LogContext) {
    write('warn', msg, context)
  },
  error(msg: string, context?: LogContext) {
    write('error', msg, context)
    sendToServer('error', msg, context ?? {})
  },
}
