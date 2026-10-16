import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { Booking, Room } from '../types'
import { BookingList } from './BookingList'

const ROOM: Room = {
  id: 'baikal',
  name: 'Байкал',
  floor: 3,
  capacity: 8,
  equipment: [],
}

const BOOKING: Booking = {
  id: 'planning',
  roomId: 'baikal',
  title: 'Планёрка',
  start: '2026-10-16T10:00',
  end: '2026-10-16T11:00',
}

// Сам BookingList не хранит брони: после отмены их перезагружает родитель
function BookingListWithState() {
  const [bookings, setBookings] = useState([BOOKING])

  return (
    <BookingList
      room={ROOM}
      bookingsState={{ status: 'success', data: bookings }}
      onRetry={() => {}}
      onCancel={async (booking) => {
        setBookings((prev) => prev.filter((item) => item.id !== booking.id))
      }}
    />
  )
}

describe('BookingList', () => {
  it('убирает бронь после «Отменить» и подтверждения «Да»', async () => {
    const user = userEvent.setup()
    render(<BookingListWithState />)

    await user.click(
      screen.getByRole('button', { name: 'Отменить бронь «Планёрка»' }),
    )
    expect(screen.getByText('Отменить бронь?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Да' }))

    expect(await screen.findByText('Броней пока нет')).toBeInTheDocument()
    expect(screen.queryByText('Планёрка')).not.toBeInTheDocument()
  })
})
