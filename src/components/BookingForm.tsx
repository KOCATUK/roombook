import { useId, useState } from 'react'
import type { Ref } from 'react'
import { ApiError } from '../api/mockApi'
import type {
  Booking,
  BookingDraft,
  BookingErrorCode,
  LocalDateTime,
  Room,
} from '../types'
import { BOOKING_ERROR_MESSAGES } from '../utils/bookingErrors'
import { validateBooking } from '../utils/bookings'
import { combineDateTime, formatTime, getDatePart } from '../utils/dateTime'
import { ErrorState } from './states/ErrorState'

interface BookingFormProps {
  rooms: Room[]
  bookings: Booking[]
  now: LocalDateTime
  roomId: Room['id']
  onRoomChange: (roomId: Room['id']) => void
  /** Отклоняется с ApiError, если бронь не сохранилась */
  onSubmit: (draft: BookingDraft) => Promise<void>
  /** Позволяет родителю перевести фокус в форму после выбора комнаты */
  titleInputRef?: Ref<HTMLInputElement>
}

const TITLE_MAX_LENGTH = 100

const TIME_ERRORS: BookingErrorCode[] = [
  'invalidDateTime',
  'endNotAfterStart',
  'crossesMidnight',
  'startInPast',
  'overlap',
]

const DATE_ERRORS: BookingErrorCode[] = ['invalidDateTime', 'startInPast']

const SAVE_ERROR_MESSAGE = 'Не удалось сохранить бронь'

const CONTROL_CLASS_NAME =
  'w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-2 text-(--text-h) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-(--booking-form-error)'

const FIELD_CLASS_NAME = 'flex min-w-0 flex-col gap-1'

const LABEL_CLASS_NAME = 'text-[13px]'

export function BookingForm({
  rooms,
  bookings,
  now,
  roomId,
  onRoomChange,
  onSubmit,
  titleInputRef,
}: BookingFormProps) {
  const id = useId()
  const headingId = `${id}-heading`
  const errorsId = `${id}-errors`
  const today = getDatePart(now)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [errors, setErrors] = useState<BookingErrorCode[]>([])
  const [conflict, setConflict] = useState<Booking>()
  // Конфликт, найденный сервером: локальный список броней мог устареть
  const [serverConflictMessage, setServerConflictMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSaveError, setHasSaveError] = useState(false)

  const hasAnyError = (codes: BookingErrorCode[]) =>
    codes.some((code) => errors.includes(code))
  const hasErrors = errors.length > 0 || serverConflictMessage !== ''
  const isTitleInvalid = errors.includes('emptyTitle')
  const isDateInvalid = hasAnyError(DATE_ERRORS)
  const isTimeInvalid = hasAnyError(TIME_ERRORS) || serverConflictMessage !== ''

  function getErrorMessage(code: BookingErrorCode): string {
    const message = BOOKING_ERROR_MESSAGES[code]
    if (code === 'overlap' && conflict) {
      return `${message}: «${conflict.title}», ${formatTime(conflict.start)}–${formatTime(conflict.end)}`
    }
    return message
  }

  async function handleSubmit() {
    const draft: BookingDraft = {
      roomId,
      title: title.trim(),
      start: combineDateTime(date, startTime),
      end: combineDateTime(date, endTime),
    }
    const result = validateBooking(draft, bookings, now)

    setServerConflictMessage('')
    setHasSaveError(false)

    if (!result.ok) {
      setErrors(result.errors)
      setConflict(result.conflict)
      return
    }

    setErrors([])
    setConflict(undefined)
    setIsSubmitting(true)

    try {
      await onSubmit(draft)
      setTitle('')
      setStartTime('')
      setEndTime('')
    } catch (error: unknown) {
      // Поля не очищаем ни при какой ошибке, чтобы пользователь не вводил всё заново (FR-40)
      if (error instanceof ApiError && error.code === 'conflict') {
        setServerConflictMessage(error.message)
      } else if (error instanceof ApiError && error.code === 'invalid') {
        setErrors(error.validationErrors)
      } else {
        setHasSaveError(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {hasSaveError && (
        <ErrorState message={SAVE_ERROR_MESSAGE} onRetry={handleSubmit} />
      )}

      <form
        // В общей палитре нет цвета ошибки, поэтому он объявлен на уровне компонента
        className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--bg) p-5 text-(--text) shadow-(--shadow) [--booking-form-error:#b91c1c] dark:[--booking-form-error:#f87171]"
        aria-labelledby={headingId}
        aria-busy={isSubmitting}
        // Встроенная проверка браузера показывает свои подсказки и не знает о пересечениях,
        // поэтому все ошибки выводим единообразно через validateBooking
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <h2 className="m-0 text-[20px] leading-[1.2]" id={headingId}>
          Новая бронь
        </h2>

        <div className={FIELD_CLASS_NAME}>
          <label className={LABEL_CLASS_NAME} htmlFor={`${id}-room`}>
            Комната
          </label>
          <select
            className={CONTROL_CLASS_NAME}
            id={`${id}-room`}
            value={roomId}
            disabled={isSubmitting}
            onChange={(event) => onRoomChange(event.target.value)}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <div className={FIELD_CLASS_NAME}>
          <label className={LABEL_CLASS_NAME} htmlFor={`${id}-title`}>
            Название встречи
          </label>
          <input
            className={CONTROL_CLASS_NAME}
            id={`${id}-title`}
            ref={titleInputRef}
            type="text"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            autoComplete="off"
            required
            disabled={isSubmitting}
            aria-invalid={isTitleInvalid}
            aria-describedby={isTitleInvalid ? errorsId : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className={FIELD_CLASS_NAME}>
          <label className={LABEL_CLASS_NAME} htmlFor={`${id}-date`}>
            Дата
          </label>
          <input
            className={CONTROL_CLASS_NAME}
            id={`${id}-date`}
            type="date"
            value={date}
            min={today}
            required
            disabled={isSubmitting}
            aria-invalid={isDateInvalid}
            aria-describedby={isDateInvalid ? errorsId : undefined}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={FIELD_CLASS_NAME}>
            <label className={LABEL_CLASS_NAME} htmlFor={`${id}-start`}>
              Начало
            </label>
            <input
              className={CONTROL_CLASS_NAME}
              id={`${id}-start`}
              type="time"
              value={startTime}
              required
              disabled={isSubmitting}
              aria-invalid={isTimeInvalid}
              aria-describedby={isTimeInvalid ? errorsId : undefined}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>

          <div className={FIELD_CLASS_NAME}>
            <label className={LABEL_CLASS_NAME} htmlFor={`${id}-end`}>
              Конец
            </label>
            <input
              className={CONTROL_CLASS_NAME}
              id={`${id}-end`}
              type="time"
              value={endTime}
              required
              disabled={isSubmitting}
              aria-invalid={isTimeInvalid}
              aria-describedby={isTimeInvalid ? errorsId : undefined}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>

        {hasErrors && (
          <ul
            className="flex list-disc flex-col gap-1 rounded-lg bg-[rgba(239,68,68,0.12)] py-2.5 pr-3 pl-7 text-[14px] text-(--booking-form-error)"
            id={errorsId}
            role="alert"
          >
            {errors.map((code) => (
              <li key={code}>{getErrorMessage(code)}</li>
            ))}
            {serverConflictMessage !== '' && <li>{serverConflictMessage}</li>}
          </ul>
        )}

        <button
          className="cursor-pointer rounded-lg bg-(--accent) px-4 py-2.5 font-medium text-white transition-[filter] duration-150 ease-[ease] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-(--border) disabled:text-(--text) dark:enabled:text-[#16171d]"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохранение…' : 'Забронировать'}
        </button>
      </form>
    </div>
  )
}
