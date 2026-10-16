import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AppError } from '../api/appError'
import type { AsyncState, Booking, Room } from '../types'
import { getRoomBookings } from '../utils/bookings'
import { formatDate, formatTime } from '../utils/dateTime'
import {
  FOCUS_RING_CLASS_NAME,
  PANEL_CLASS_NAME,
  PANEL_HEADING_CLASS_NAME,
} from './classNames'
import { ErrorState } from './states/ErrorState'
import { LoadingState } from './states/LoadingState'

interface BookingListProps {
  room: Room
  bookingsState: AsyncState<Booking[]>
  onRetry: () => void
  /** Отклоняется, если бронь не удалось отменить */
  onCancel: (booking: Booking) => Promise<void>
  /** Можно ли отменить бронь; по умолчанию можно любую, как в mock API без входа */
  canCancel?: (booking: Booking) => boolean
}

interface BookingListItemProps {
  booking: Booking
  onCancel: (booking: Booking) => Promise<void>
  canCancel: boolean
}

type CancelStep = 'idle' | 'confirming' | 'cancelling' | 'error'

// Размер для пальца зависит от способа ввода, а не от ширины экрана:
// планшет широкий, но сенсорный, поэтому pointer-coarse, а не sm/md
const TOUCH_CLASS_NAME = 'pointer-coarse:min-h-11 pointer-coarse:px-4'

const SECONDARY_BUTTON_CLASS_NAME = `cursor-pointer rounded-md border border-(--accent-border) px-2.5 py-1 text-[13px] text-(--accent) enabled:hover:bg-(--accent-bg) disabled:cursor-not-allowed disabled:opacity-60 ${TOUCH_CLASS_NAME} ${FOCUS_RING_CLASS_NAME}`

const PRIMARY_BUTTON_CLASS_NAME = `cursor-pointer rounded-md bg-(--accent) px-2.5 py-1 text-[13px] font-medium text-(--on-accent) enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${TOUCH_CLASS_NAME} ${FOCUS_RING_CLASS_NAME}`

const CANCEL_ERROR_MESSAGE = 'Не удалось отменить бронь'

function canCancelAny(): boolean {
  return true
}

function BookingListItem({ booking, onCancel, canCancel }: BookingListItemProps) {
  const [step, setStep] = useState<CancelStep>('idle')
  const [errorMessage, setErrorMessage] = useState(CANCEL_ERROR_MESSAGE)
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
    } catch (error: unknown) {
      // У AppError сообщение объясняет причину: нет сети, чужая бронь, истекла сессия
      setErrorMessage(error instanceof AppError ? error.message : CANCEL_ERROR_MESSAGE)
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
      {booking.authorName && (
        <span className="text-[13px] wrap-anywhere">Автор: {booking.authorName}</span>
      )}

      {canCancel && (
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
                {isCancelling ? 'Отменяем…' : 'Да'}
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
                className="text-[13px] text-(--danger)"
              >
                {errorMessage}
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
      )}
    </li>
  )
}

export function BookingList({
  room,
  bookingsState,
  onRetry,
  onCancel,
  canCancel = canCancelAny,
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
          <BookingListItem
            key={booking.id}
            booking={booking}
            onCancel={onCancel}
            canCancel={canCancel(booking)}
          />
        ))}
      </ul>
    )
  }

  return (
    <section
      className={`flex flex-col gap-3 p-5 ${PANEL_CLASS_NAME}`}
      aria-labelledby={headingId}
      aria-busy={bookingsState.status === 'loading'}
    >
      <h2 className={PANEL_HEADING_CLASS_NAME} id={headingId}>
        Расписание: {room.name}
      </h2>

      {renderContent()}
    </section>
  )
}
