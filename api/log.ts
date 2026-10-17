import { emptyResponse } from './_lib/http.js'
import { createRequestLogger } from './_lib/log.js'
import type { LogFields } from './_lib/log.js'

// Приём ошибок из браузера (navigator.sendBeacon в src/lib/logger.ts).
// Эндпоинт открыт всем, поэтому всё входящее считаем недоверенным:
// размер ограничен, поля берутся только из белого списка и проверяются по формату.

const ROUTE = '/api/log'
export const MAX_BODY_BYTES = 2048

const CLIENT_LEVELS = ['warn', 'error'] as const
type ClientLevel = (typeof CLIENT_LEVELS)[number]

// Короткое техническое сообщение: буквы, цифры, пробелы и простая пунктуация.
// Без @ и / не пройдут e-mail и URL с параметрами
const MESSAGE_PATTERN = /^[\p{L}\p{N} .,:()'-]{1,120}$/u
// Длинная сплошная строка похожа на токен или ключ, такое не логируем
const TOKEN_LIKE_PATTERN = /[A-Za-z0-9_-]{32,}/
// operation и kind — идентификаторы из appError.ts (getRooms, network)
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/
// Коды Postgres (23P01), PostgREST (PGRST301) и Supabase Auth (unexpected_failure)
const CODE_PATTERN = /^[A-Za-z0-9_]{1,40}$/

interface ClientLogEvent {
  level: ClientLevel
  msg: string
  fields: LogFields
}

function isClientLevel(value: unknown): value is ClientLevel {
  return CLIENT_LEVELS.some((level) => level === value)
}

function readMatching(source: Record<string, unknown>, key: string, pattern: RegExp): string | undefined {
  const value = source[key]
  return typeof value === 'string' && pattern.test(value) ? value : undefined
}

function readHttpStatus(source: Record<string, unknown>): number | undefined {
  const value = source.status
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 599
    ? value
    : undefined
}

/** Возвращает событие из белого списка полей или null, если обязательные поля неверны */
export function parseClientEvent(payload: unknown): ClientLogEvent | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null
  }
  const source: Record<string, unknown> = { ...payload }
  const msg = source.msg
  if (
    !isClientLevel(source.level) ||
    typeof msg !== 'string' ||
    !MESSAGE_PATTERN.test(msg) ||
    TOKEN_LIKE_PATTERN.test(msg)
  ) {
    return null
  }
  // Необязательные поля с неверным форматом просто отбрасываем
  return {
    level: source.level,
    msg,
    fields: {
      operation: readMatching(source, 'operation', IDENTIFIER_PATTERN),
      kind: readMatching(source, 'kind', IDENTIFIER_PATTERN),
      code: readMatching(source, 'code', CODE_PATTERN),
      http_status: readHttpStatus(source),
    },
  }
}

// Читаем поток сами: Content-Length может отсутствовать или врать,
// а request.text() прочитал бы тело любого размера целиком
async function readBodyLimited(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > limit) {
    return null
  }
  if (!request.body) {
    return ''
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export async function POST(request: Request): Promise<Response> {
  const logger = createRequestLogger(ROUTE, request)

  const text = await readBodyLimited(request, MAX_BODY_BYTES)
  if (text === null) {
    logger.log('warn', 'client log rejected', { reason: 'too_large' })
    return emptyResponse(413)
  }

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    logger.log('warn', 'client log rejected', { reason: 'invalid_json' })
    return emptyResponse(400)
  }

  const event = parseClientEvent(payload)
  if (!event) {
    logger.log('warn', 'client log rejected', { reason: 'invalid_fields' })
    return emptyResponse(400)
  }

  logger.log(event.level, 'client event', { ...event.fields, client_msg: event.msg })
  return emptyResponse(204)
}

// Остальные методы явно отклоняем, не полагаясь на поведение платформы
function methodNotAllowed(): Response {
  return emptyResponse(405, { Allow: 'POST' })
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
