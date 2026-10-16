import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Booking, Room } from '../types'
import { RoomCard } from './RoomCard'

const room: Room = {
  id: 'elbrus',
  name: 'Эльбрус',
  floor: 5,
  capacity: 4,
  equipment: ['whiteboard'],
}

const booking: Booking = {
  id: 'b1',
  roomId: 'elbrus',
  title: 'Планёрка',
  start: '2026-10-16T09:00',
  end: '2026-10-16T10:00',
}

describe('RoomCard', () => {
  it('у занятой комнаты показывает короткий статус и название брони отдельной строкой', () => {
    render(<RoomCard room={room} currentBooking={booking} />)

    expect(screen.getByText('Занята до 10:00')).toBeInTheDocument()
    expect(screen.getByText('Планёрка')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Забронировать' }),
    ).toHaveAccessibleDescription('Занята до 10:00 Планёрка')
  })

  it('у свободной комнаты не выводит название брони и описание кнопки', () => {
    render(<RoomCard room={room} />)

    expect(screen.getByText('Свободна')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Забронировать' }),
    ).not.toHaveAttribute('aria-describedby')
  })
})
