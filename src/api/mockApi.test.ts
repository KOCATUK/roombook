import { afterAll, describe, expect, it, vi } from 'vitest'
import { ApiError, createBooking } from './mockApi'

// Демо-брони mock API строятся от текущего времени при импорте модуля,
// поэтому время фиксируем до импортов (vi.hoisted поднимается выше них)
vi.hoisted(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 16, 9, 0) })
})

const MAX_API_DELAY_MS = 1000

afterAll(() => {
  vi.useRealTimers()
})

describe('createBooking', () => {
  it('отклоняет бронь с кодом conflict, если время уже занято', async () => {
    window.history.pushState({}, '', '/?scenario=ok')

    // Демо-бронь «Планёрка» в «Эльбрусе» занимает 09:00–10:00 текущего дня
    const request = createBooking({
      roomId: 'elbrus',
      title: 'Созвон',
      start: '2026-10-16T09:30',
      end: '2026-10-16T10:30',
    })
    // Обработчик вешаем до промотки таймеров, иначе отказ будет считаться необработанным
    const assertion = expect(request).rejects.toSatisfy(
      (error) => error instanceof ApiError && error.code === 'conflict',
    )
    await vi.advanceTimersByTimeAsync(MAX_API_DELAY_MS)

    await assertion
  })
})
