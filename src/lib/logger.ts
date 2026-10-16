// В контекст кладём только технические поля (операция, вид ошибки, статус, код).
// Тексты ошибок БД не логируем: в details Postgres попадают значения строк
type LogValue = string | number | boolean | null | undefined

export type LogContext = Record<string, LogValue>

const PREFIX = '[RoomBook]'

function write(
  method: 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
) {
  if (context) {
    console[method](PREFIX, message, context)
  } else {
    console[method](PREFIX, message)
  }
}

export const logger = {
  // Информационные сообщения нужны только при разработке
  info(message: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      write('info', message, context)
    }
  },
  warn(message: string, context?: LogContext) {
    write('warn', message, context)
  },
  error(message: string, context?: LogContext) {
    write('error', message, context)
  },
}
