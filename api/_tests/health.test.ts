// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../health.js'
import type { HealthBody } from '../health.js'

const SUPABASE_URL = 'https://example.supabase.co'
const ANON_KEY = 'test-anon-key-must-not-leak'

function healthRequest(): Request {
  return new Request('http://localhost/api/health', { headers: { 'x-vercel-id': 'fra1::test-id' } })
}

// В типах Node json() возвращает unknown; форму ответа проверяют сами тесты
async function readBody(response: Response): Promise<HealthBody> {
  return (await response.json()) as HealthBody
}

function lastLogLine(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const calls = spy.mock.calls
  return JSON.parse(String(calls[calls.length - 1][0]))
}

describe('GET /api/health', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ANON_KEY)
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '5a67e0f1234567890abcdef')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('Supabase отвечает → 200, status ok, без кэша', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))

    const response = await GET(healthRequest())
    const body = await readBody(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(body.status).toBe('ok')
    expect(body.checks.supabase.status).toBe('ok')
    expect(typeof body.checks.supabase.latencyMs).toBe('number')
    expect(body.version).toBe('5a67e0f')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })

  it('запрашивает rooms с limit=1, ключом в apikey и таймаутом', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))

    await GET(healthRequest())

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SUPABASE_URL}/rest/v1/rooms?select=id&limit=1`)
    expect(new Headers(init?.headers).get('apikey')).toBe(ANON_KEY)
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('ответ 5xx от Supabase → 503 degraded', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"boom"}', { status: 500 }))

    const response = await GET(healthRequest())
    const body = await readBody(response)

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.supabase.status).toBe('error')
  })

  it('таймаут и сбой сети → 503, причина только в логе', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    const timeout = await GET(healthRequest())
    expect(timeout.status).toBe(503)
    expect(lastLogLine(vi.mocked(console.warn)).reason).toBe('timeout')

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const network = await GET(healthRequest())
    expect(network.status).toBe(503)
    expect(lastLogLine(vi.mocked(console.warn)).reason).toBe('network')
  })

  it('без переменных окружения → 503 и запроса нет', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')

    const response = await GET(healthRequest())

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(lastLogLine(vi.mocked(console.warn)).reason).toBe('not_configured')
  })

  it('нет VERCEL_GIT_COMMIT_SHA → version unknown', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', undefined)
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))

    const body = await readBody(await GET(healthRequest()))

    expect(body.version).toBe('unknown')
  })

  it('ни ответ, ни лог не содержат ключа, URL и текста ошибки', async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed: ${SUPABASE_URL} ${ANON_KEY}`))

    const text = await (await GET(healthRequest())).text()
    const logged = vi.mocked(console.warn).mock.calls.flat().join('\n')

    for (const output of [text, logged]) {
      expect(output).not.toContain(ANON_KEY)
      expect(output).not.toContain(SUPABASE_URL)
      expect(output).not.toContain('fetch failed')
    }
  })

  it('пишет одну JSON-строку с route, request_id и latencyMs', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))

    await GET(healthRequest())

    expect(console.info).toHaveBeenCalledTimes(1)
    const line = lastLogLine(vi.mocked(console.info))
    expect(line).toMatchObject({
      level: 'info',
      msg: 'health check ok',
      route: '/api/health',
      request_id: 'fra1::test-id',
    })
    expect(typeof line.latencyMs).toBe('number')
    expect(typeof line.ts).toBe('string')
  })
})
