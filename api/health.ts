import { jsonResponse } from './_lib/http.js'
import { createRequestLogger } from './_lib/log.js'

const ROUTE = '/api/health'
const SUPABASE_TIMEOUT_MS = 3000
const SHORT_SHA_LENGTH = 7

type CheckStatus = 'ok' | 'error'

// Причина сбоя уходит только в лог: в ответе наружу нет ни текстов ошибок, ни адресов
type FailureReason = 'not_configured' | 'timeout' | 'network' | 'http_error'

export interface HealthBody {
  status: 'ok' | 'degraded'
  checks: { supabase: { status: CheckStatus; latencyMs: number } }
  version: string
  timestamp: string
}

interface SupabaseCheckResult {
  status: CheckStatus
  latencyMs: number
  reason?: FailureReason
  httpStatus?: number
}

async function checkSupabase(): Promise<SupabaseCheckResult> {
  // Те же переменные, что у клиента: на Vercel они доступны и функциям
  const url = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (url === '' || key === '') {
    return { status: 'error', latencyMs: 0, reason: 'not_configured' }
  }

  const startedAt = performance.now()
  const elapsed = () => Math.round(performance.now() - startedAt)
  try {
    // rooms читает и anon: проверяем весь путь шлюз → PostgREST → Postgres.
    // Только apikey без Authorization: publishable-ключ не JWT
    const response = await fetch(`${url}/rest/v1/rooms?select=id&limit=1`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    })
    // Тело не нужно; освобождаем соединение
    await response.body?.cancel()
    if (!response.ok) {
      return { status: 'error', latencyMs: elapsed(), reason: 'http_error', httpStatus: response.status }
    }
    return { status: 'ok', latencyMs: elapsed() }
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    return { status: 'error', latencyMs: elapsed(), reason: isTimeout ? 'timeout' : 'network' }
  }
}

export async function GET(request: Request): Promise<Response> {
  const logger = createRequestLogger(ROUTE, request)
  const supabase = await checkSupabase()
  const isOk = supabase.status === 'ok'

  const body: HealthBody = {
    status: isOk ? 'ok' : 'degraded',
    checks: { supabase: { status: supabase.status, latencyMs: supabase.latencyMs } },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, SHORT_SHA_LENGTH) ?? 'unknown',
    timestamp: new Date().toISOString(),
  }

  if (isOk) {
    logger.log('info', 'health check ok', { supabase_ms: supabase.latencyMs })
  } else {
    logger.log('warn', 'health check degraded', {
      supabase_ms: supabase.latencyMs,
      reason: supabase.reason,
      http_status: supabase.httpStatus,
    })
  }

  return jsonResponse(body, isOk ? 200 : 503)
}
