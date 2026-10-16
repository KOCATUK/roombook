import { describe, expect, it } from 'vitest'
import type { Booking } from '../types'
import { validateBooking } from './bookings'

const NOW = '2026-10-16T09:00'

const EXISTING: Booking = {
  id: 'existing',
  roomId: 'baikal',
  title: 'Планёрка',
  start: '2026-10-16T10:00',
  end: '2026-10-16T11:00',
}

describe('validateBooking', () => {
  it('допускает бронь сразу после окончания другой: интервал [начало, конец)', () => {
    const result = validateBooking(
      {
        roomId: 'baikal',
        title: 'Ретро',
        start: '2026-10-16T11:00',
        end: '2026-10-16T12:00',
      },
      [EXISTING],
      NOW,
    )

    expect(result).toEqual({ ok: true })
  })
})
