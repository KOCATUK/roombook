import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Booking, BookingDraft, Room } from '../types'
import { BookingForm } from './BookingForm'

const NOW = '2026-10-16T09:00'

const ROOMS: Room[] = [
  { id: 'baikal', name: 'Байкал', floor: 3, capacity: 8, equipment: [] },
]

const EXISTING: Booking = {
  id: 'existing',
  roomId: 'baikal',
  title: 'Планёрка',
  start: '2026-10-16T10:00',
  end: '2026-10-16T11:00',
}

function renderForm(bookings: Booking[] = []) {
  const onSubmit = vi.fn<(draft: BookingDraft) => Promise<void>>()
  onSubmit.mockResolvedValue(undefined)
  render(
    <BookingForm
      rooms={ROOMS}
      bookings={bookings}
      now={NOW}
      roomId="baikal"
      onRoomChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  return { onSubmit, user: userEvent.setup() }
}

// Поля type="time" jsdom не умеет заполнять посимвольно, поэтому задаём значение целиком
function fillTime(start: string, end: string) {
  fireEvent.change(screen.getByLabelText('Начало'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('Конец'), { target: { value: end } })
}

describe('BookingForm', () => {
  it('отправляет корректную бронь и очищает поля', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(screen.getByLabelText('Название встречи'), 'Ретро')
    fillTime('11:00', '12:00')
    await user.click(screen.getByRole('button', { name: 'Забронировать' }))

    expect(onSubmit).toHaveBeenCalledWith({
      roomId: 'baikal',
      title: 'Ретро',
      start: '2026-10-16T11:00',
      end: '2026-10-16T12:00',
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Название встречи')).toHaveValue('')
    })
  })

  it('показывает ошибку при пересечении с существующей бронью', async () => {
    const { onSubmit, user } = renderForm([EXISTING])

    await user.type(screen.getByLabelText('Название встречи'), 'Созвон')
    fillTime('10:30', '11:30')
    await user.click(screen.getByRole('button', { name: 'Забронировать' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Комната уже занята в это время',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('не отправляет бронь без названия', async () => {
    const { onSubmit, user } = renderForm()

    fillTime('11:00', '12:00')
    await user.click(screen.getByRole('button', { name: 'Забронировать' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Укажите название встречи')
    expect(screen.getByLabelText('Название встречи')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
