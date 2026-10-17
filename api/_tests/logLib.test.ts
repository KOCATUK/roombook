// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequestLogger, formatLogLine } from '../_lib/log.js'

describe('formatLogLine', () => {
  it('одна строка JSON с обязательными полями', () => {
    const line = formatLogLine('warn', 'something', { route: '/api/x', request_id: 'id-1', latencyMs: 12 })

    expect(line).not.toContain('\n')
    const parsed: unknown = JSON.parse(line)
    expect(parsed).toEqual({
      ts: expect.any(String),
      level: 'warn',
      msg: 'something',
      route: '/api/x',
      request_id: 'id-1',
      latencyMs: 12,
    })
  })

  it('дополнительные поля не подменяют обязательные', () => {
    const line = formatLogLine(
      'info',
      'm',
      { route: '/api/x', request_id: 'real', latencyMs: 1 },
      { request_id: 'fake', route: '/evil', extra: 5 },
    )

    expect(JSON.parse(line)).toMatchObject({ route: '/api/x', request_id: 'real', extra: 5 })
  })
})

describe('createRequestLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('request_id из x-vercel-id, уровень → метод консоли', () => {
    const logger = createRequestLogger('/api/x', new Request('http://localhost', { headers: { 'x-vercel-id': 'v-1' } }))

    logger.log('error', 'failed')

    expect(logger.requestId).toBe('v-1')
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0][0]))).toMatchObject({
      level: 'error',
      request_id: 'v-1',
    })
  })

  it('без x-vercel-id генерирует свой request_id', () => {
    const logger = createRequestLogger('/api/x', new Request('http://localhost'))

    expect(logger.requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('debug выключен по умолчанию и включается LOG_LEVEL=debug', () => {
    const logger = createRequestLogger('/api/x', new Request('http://localhost'))

    logger.log('debug', 'hidden')
    expect(console.debug).not.toHaveBeenCalled()

    vi.stubEnv('LOG_LEVEL', 'debug')
    logger.log('debug', 'shown')
    expect(console.debug).toHaveBeenCalledTimes(1)
  })
})
