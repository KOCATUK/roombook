export type AppErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'unknown'

export type ApiOperation =
  | 'getRooms'
  | 'getBookings'
  | 'createBooking'
  | 'cancelBooking'
  | 'signIn'
  | 'signOut'

export interface AppErrorCause {
  operation: ApiOperation
  /** HTTP-статус; 0 — запрос не дошёл до сервера */
  status?: number
  /** Код PostgreSQL (23P01), PostgREST (PGRST301) или Supabase Auth */
  code?: string
}

export class AppError extends Error {
  kind: AppErrorKind
  override cause: AppErrorCause

  constructor(kind: AppErrorKind, message: string, cause: AppErrorCause) {
    super(message)
    this.name = 'AppError'
    this.kind = kind
    this.cause = cause
  }
}

const OPERATION_FAILURES: Record<ApiOperation, string> = {
  getRooms: 'Не удалось загрузить комнаты',
  getBookings: 'Не удалось загрузить расписание',
  createBooking: 'Не удалось сохранить бронь',
  cancelBooking: 'Не удалось отменить бронь',
  signIn: 'Не удалось войти',
  signOut: 'Не удалось выйти',
}

const KIND_HINTS: Record<AppErrorKind, string> = {
  network: 'Нет связи с сервером. Проверьте интернет и повторите',
  unauthorized: 'Сессия истекла или вы не вошли. Войдите через GitHub и повторите',
  forbidden: 'Недостаточно прав для этого действия',
  conflict: 'Это время уже занято. Выберите другое время',
  validation: 'Проверьте введённые данные',
  server: 'Сервер временно недоступен. Повторите позже',
  unknown: 'Повторите попытку позже',
}

const POSTGRES_EXCLUSION_VIOLATION = '23P01'
const POSTGRES_CHECK_VIOLATION = '23514'
const POSTGRES_INSUFFICIENT_PRIVILEGE = '42501'
// Класс 22: неверные данные (формат даты, переполнение, слишком длинная строка)
const POSTGRES_DATA_EXCEPTION_CLASS = '22'
// PostgREST: JWT истёк или неверен
const POSTGREST_JWT_CODES = ['PGRST301', 'PGRST302', 'PGRST303']

function readStringField(value: object, key: string): string | undefined {
  const field: unknown = Reflect.get(value, key)
  return typeof field === 'string' && field !== '' ? field : undefined
}

function readNumberField(value: object, key: string): number | undefined {
  const field: unknown = Reflect.get(value, key)
  return typeof field === 'number' ? field : undefined
}

function getKind(code: string | undefined, status: number | undefined, isFetchError: boolean): AppErrorKind {
  // Конфликт проверяем до статусов: PostgREST отдаёт его с 409
  if (code === POSTGRES_EXCLUSION_VIOLATION) {
    return 'conflict'
  }
  if (isFetchError || status === 0) {
    return 'network'
  }
  // 401 раньше 42501: гостю PostgREST отвечает 401 с этим кодом, и ему важнее войти
  if (status === 401 || (code !== undefined && POSTGREST_JWT_CODES.includes(code))) {
    return 'unauthorized'
  }
  if (status === 403 || code === POSTGRES_INSUFFICIENT_PRIVILEGE) {
    return 'forbidden'
  }
  if (
    code === POSTGRES_CHECK_VIOLATION ||
    code?.startsWith(POSTGRES_DATA_EXCEPTION_CLASS) ||
    status === 400
  ) {
    return 'validation'
  }
  if (status !== undefined && status >= 500) {
    return 'server'
  }
  return 'unknown'
}

function getMessage(kind: AppErrorKind, operation: ApiOperation): string {
  // Для конфликта причина и есть всё сообщение, приставка «не удалось» лишняя
  if (kind === 'conflict') {
    return KIND_HINTS.conflict
  }
  return `${OPERATION_FAILURES[operation]}. ${KIND_HINTS[kind]}`
}

/**
 * Сводит ошибку supabase-js (PostgrestError, AuthError), сбой fetch или что угодно
 * ещё к AppError. `status` передаётся отдельно: у PostgrestError его нет,
 * он лежит рядом в ответе запроса
 */
export function toAppError(error: unknown, operation: ApiOperation, status?: number): AppError {
  if (error instanceof AppError) {
    return error
  }

  const isObject = typeof error === 'object' && error !== null
  const code = isObject ? readStringField(error, 'code') : undefined
  const resolvedStatus = status ?? (isObject ? readNumberField(error, 'status') : undefined)
  // fetch бросает TypeError, если сервер недоступен или запрос заблокирован
  const isFetchError = error instanceof TypeError

  const kind = getKind(code, resolvedStatus, isFetchError)
  return new AppError(kind, getMessage(kind, operation), {
    operation,
    status: resolvedStatus,
    code,
  })
}
