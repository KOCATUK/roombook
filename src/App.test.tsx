import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Демо-брони mock API и useNow берут текущее время, поэтому фиксируем его до импортов.
// shouldAdvanceTime нужен Testing Library: после каждого действия она ждёт setTimeout(0)
// и умеет промотать только таймеры Jest, а без хода времени этот таймер не сработал бы
vi.hoisted(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 16, 9, 0), shouldAdvanceTime: true })
})

const MAX_API_DELAY_MS = 1000

// Задержку mock API проматываем явно, чтобы не ждать её в реальном времени
async function waitForApi() {
  await act(() => vi.advanceTimersByTimeAsync(MAX_API_DELAY_MS))
}

afterEach(() => {
  window.history.pushState({}, '', '/')
})

afterAll(() => {
  vi.useRealTimers()
})

describe('App', () => {
  it('создаёт бронь через форму и показывает уведомление', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await waitForApi()

    const card = screen.getByRole('article', { name: 'Байкал' })
    await user.click(within(card).getByRole('button', { name: 'Забронировать' }))

    const form = screen.getByRole('form', { name: 'Новая бронь' })
    await user.type(within(form).getByLabelText('Название встречи'), 'Ретро')
    fireEvent.change(within(form).getByLabelText('Начало'), {
      target: { value: '10:00' },
    })
    fireEvent.change(within(form).getByLabelText('Конец'), {
      target: { value: '11:00' },
    })
    await user.click(within(form).getByRole('button', { name: 'Забронировать' }))
    await waitForApi()

    expect(
      screen.getByText('Комната «Байкал» забронирована: 16.10.2026, 10:00–11:00'),
    ).toBeInTheDocument()
  })

  it('при ошибке загрузки показывает сообщение и кнопку «Повторить»', async () => {
    window.history.pushState({}, '', '/?scenario=error')
    render(<App />)
    await waitForApi()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить комнаты')
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })
})
