import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { AsyncState, Booking, Room } from '../types'
import { getRoomBookings } from '../utils/bookings'
import { formatDate, formatTime } from '../utils/dateTime'
import { ErrorState } from './states/ErrorState'
import { LoadingState } from './states/LoadingState'

interface BookingListProps {
  room: Room
  bookingsState: AsyncState<Booking[]>
  onRetry: () => void
  /** Отклоняется, если бронь не удалось отменить */
  onCancel: (booking: Booking) => Promise<void>
}

interface BookingListItemProps {
  booking: Booking
  onCancel: (booking: Booking) => Promise<void>
}

type CancelStep = 'idle' | 'confirming' | 'cancelling' | 'error'

const FOCUS_CLASS_NAME =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)'

// Размер для пальца зависит от способа ввода, а не от ширины экрана:
// планшет широкий, но сенсорный, поэтому pointer-coarse, а не sm/md
const TOUCH_CLASS_NAME = 'pointer-coarse:min-h-11 pointer-coarse:px-4'

const SECONDARY_BUTTON_CLASS_NAME = `cursor-pointer rounded-md border border-(--accent-border) px-2.5 py-1 text-[13px] text-(--accent) enabled:hover:bg-(--accent-bg) disabled:cursor-not-allowed disabled:opacity-60 ${TOUCH_CLASS_NAME} ${FOCUS_CLASS_NAME}`

const PRIMARY_BUTTON_CLASS_NAME = `cursor-pointer rounded-md bg-(--accent) px-2.5 py-1 text-[13px] font-medium text-white enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#16171d] ${TOUCH_CLASS_NAME} ${FOCUS_CLASS_NAME}`

function BookingListItem({ booking, onCancel }: BookingListItemProps) {
  const [step, setStep] = useState<CancelStep>('idle')
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const noButtonRef = useRef<HTMLButtonElement>(null)
  const isCancelling = step === 'cancelling'

  // Кнопки подменяют друг друга, и без переноса фокуса пользователь клавиатуры
  // оказался бы в начале страницы. Рендерим синхронно, чтобы кнопка уже была в DOM
  function handleAskConfirm() {
    flushSync(() => setStep('confirming'))
    noButtonRef.current?.focus()
  }

  function handleDecline() {
    flushSync(() => setStep('idle'))
    cancelButtonRef.current?.focus()
  }

  async function handleConfirm() {
    setStep('cancelling')
    try {
      // При успехе строка исчезнет после перезагрузки расписания
      await onCancel(booking)
    } catch {
      setStep('error')
    }
  }

  return (
    <li className="flex flex-col gap-0.5 rounded-md border-l-3 border-(--accent-border) bg-(--accent-bg) px-3 py-2">
      <span className="text-[13px]">
        {formatDate(booking.start)},{' '}
        <time dateTime={booking.start}>{formatTime(booking.start)}</time>–
        <time dateTime={booking.end}>{formatTime(booking.end)}</time>
      </span>
      <span className="font-medium wrap-anywhere text-(--text-h)">
        {booking.title}
      </span>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 pointer-coarse:gap-3">
        {step === 'idle' && (
          <button
            ref={cancelButtonRef}
            type="button"
            className={SECONDARY_BUTTON_CLASS_NAME}
            aria-label={`Отменить бронь «${booking.title}»`}
            onClick={handleAskConfirm}
          >
            Отменить
          </button>
        )}

        {(step === 'confirming' || isCancelling) && (
          <>
            <span className="text-[13px] text-(--text-h)">Отменить бронь?</span>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS_NAME}
              disabled={isCancelling}
              onClick={() => void handleConfirm()}
            >
              {isCancelling ? 'Отмена…' : 'Да'}
            </button>
            <button
              ref={noButtonRef}
              type="button"
              className={SECONDARY_BUTTON_CLASS_NAME}
              disabled={isCancelling}
              onClick={handleDecline}
            >
              Нет
            </button>
          </>
        )}

        {step === 'error' && (
          <>
            <span
              role="alert"
              className="text-[13px] text-[#b91c1c] dark:text-[#f87171]"
            >
              Не удалось отменить бронь
            </span>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS_NAME}
              onClick={() => void handleConfirm()}
            >
              Повторить
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function BookingList({
  room,
  bookingsState,
  onRetry,
  onCancel,
}: BookingListProps) {
  const headingId = useId()

  function renderContent() {
    if (bookingsState.status === 'error') {
      return <ErrorState message={bookingsState.message} onRetry={onRetry} />
    }

    if (bookingsState.status !== 'success') {
      return (
        <LoadingState label="Загрузка расписания…" count={2} variant="compact" />
      )
    }

    const roomBookings = getRoomBookings(room.id, bookingsState.data)
    if (roomBookings.length === 0) {
      return <p className="text-[14px] italic">Броней пока нет</p>
    }

    return (
      <ul className="flex flex-col gap-2">
        {roomBookings.map((booking) => (
          <BookingListItem key={booking.id} booking={booking} onCancel={onCancel} />
        ))}
      </ul>
    )
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-(--border) bg-(--bg) p-5 text-(--text) shadow-(--shadow)"
      aria-labelledby={headingId}
      aria-busy={bookingsState.status === 'loading'}
    >
      <h2 className="m-0 text-[20px] leading-[1.2]" id={headingId}>
        Расписание: {room.name}
      </h2>

      {renderContent()}
    </section>
  )
}
