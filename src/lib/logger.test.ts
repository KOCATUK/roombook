import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLogEntry, logger } from './logger'

describe('formatLogEntry', () => {
  it('одна JSON-строка с ts, level, msg и контекстом', () => {
    const line = formatLogEntry('error', 'API request failed', { operation: 'getRooms', status: 503 })

    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      ts: expect.any(String),
      level: 'error',
      msg: 'API request failed',
      operation: 'getRooms',
      status: 503,
    })
  })

  it('контекст не подменяет level и msg', () => {
    expect(JSON.parse(formatLogEntry('warn', 'real', { level: 'debug', msg: 'fake' }))).toMatchObject({
      level: 'warn',
      msg: 'real',
    })
  })
})

describe('logger', () => {
  const sendBeacon = vi.fn(() => true)

  beforeEach(() => {
    // В jsdom sendBeacon нет
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    sendBeacon.mockClear()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('error пишет JSON в консоль', () => {
    logger.error('API request failed', { operation: 'getRooms', kind: 'network' })

    const line = String(vi.mocked(console.error).mock.calls[0][0])
    expect(JSON.parse(line)).toMatchObject({ level: 'error', operation: 'getRooms', kind: 'network' })
  })

  it('в production error уходит на /api/log через sendBeacon', async () => {
    vi.stubEnv('PROD', true)

    logger.error('API request failed', { operation: 'createBooking', status: 400, code: '23514' })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, body] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('/api/log')
    expect(JSON.parse(await body.text())).toEqual({
      level: 'error',
      msg: 'API request failed',
      operation: 'createBooking',
      status: 400,
      code: '23514',
    })
  })

  it('warn и события вне production на сервер не отправляются', () => {
    vi.stubEnv('PROD', true)
    logger.warn('something')
    expect(sendBeacon).not.toHaveBeenCalled()

    vi.stubEnv('PROD', false)
    logger.error('API request failed')
    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
