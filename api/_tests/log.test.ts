// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, MAX_BODY_BYTES, POST, parseClientEvent } from '../log.js'

function logRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

function loggedLines(spy: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return spy.mock.calls.map((call) => JSON.parse(String(call[0])))
}

describe('POST /api/log', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('корректное событие → 204 и одна строка лога с полями из белого списка', async () => {
    const response = await POST(
      logRequest(
        JSON.stringify({
          level: 'error',
          msg: 'API request failed',
          operation: 'createBooking',
          kind: 'validation',
          status: 400,
          code: '23514',
          email: 'user@example.com',
          token: 'secret-token',
        }),
      ),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const [line] = loggedLines(vi.mocked(console.error))
    expect(line).toMatchObject({
      level: 'error',
      msg: 'client event',
      route: '/api/log',
      client_msg: 'API request failed',
      operation: 'createBooking',
      kind: 'validation',
      http_status: 400,
      code: '23514',
    })
    expect(JSON.stringify(line)).not.toContain('user@example.com')
    expect(JSON.stringify(line)).not.toContain('secret-token')
  })

  it('тело больше 2 КБ → 413, в том числе без Content-Length', async () => {
    const big = JSON.stringify({ level: 'error', msg: 'x', pad: 'a'.repeat(MAX_BODY_BYTES) })

    expect((await POST(logRequest(big))).status).toBe(413)

    const stream = new Blob([big]).stream()
    const chunked = new Request('http://localhost/api/log', { method: 'POST', body: stream, duplex: 'half' })
    expect(chunked.headers.has('content-length')).toBe(false)
    expect((await POST(chunked)).status).toBe(413)
  })

  it('невалидный JSON → 400', async () => {
    expect((await POST(logRequest('{not json'))).status).toBe(400)
  })

  it('уровни кроме warn и error → 400', async () => {
    for (const level of ['info', 'debug', 'fatal', undefined]) {
      expect((await POST(logRequest(JSON.stringify({ level, msg: 'm' })))).status).toBe(400)
    }
    expect(console.error).not.toHaveBeenCalled()
  })

  it('GET → 405 с Allow: POST', () => {
    const response = GET()
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
  })
})

describe('parseClientEvent', () => {
  it('отклоняет сообщения с e-mail, URL и похожие на токен', () => {
    for (const msg of [
      'failed for user@example.com',
      'see https://example.com/?token=1',
      `bearer ${'a'.repeat(40)}`,
      '',
      'x'.repeat(121),
    ]) {
      expect(parseClientEvent({ level: 'error', msg })).toBeNull()
    }
  })

  it('отбрасывает необязательные поля неверного формата', () => {
    expect(
      parseClientEvent({
        level: 'warn',
        msg: 'Auth request failed',
        operation: 'sign in; drop',
        kind: 42,
        code: 'x'.repeat(41),
        status: 1000,
      }),
    ).toEqual({
      level: 'warn',
      msg: 'Auth request failed',
      fields: { operation: undefined, kind: undefined, code: undefined, http_status: undefined },
    })
  })

  it('отклоняет не объекты', () => {
    for (const payload of [null, 'error', [1], 42]) {
      expect(parseClientEvent(payload)).toBeNull()
    }
  })
})
