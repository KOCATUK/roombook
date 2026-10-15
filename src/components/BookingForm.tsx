import { useId, useState } from 'react'
import type { Ref } from 'react'
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
import './BookingForm.css'

interface BookingFormProps {
  rooms: Room[]
  bookings: Booking[]
  now: LocalDateTime
  roomId: Room['id']
  onRoomChange: (roomId: Room['id']) => void
  onSubmit: (draft: BookingDraft) => void
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

  const hasAnyError = (codes: BookingErrorCode[]) =>
    codes.some((code) => errors.includes(code))
  const isTitleInvalid = errors.includes('emptyTitle')
  const isDateInvalid = hasAnyError(DATE_ERRORS)
  const isTimeInvalid = hasAnyError(TIME_ERRORS)

  function getErrorMessage(code: BookingErrorCode): string {
    const message = BOOKING_ERROR_MESSAGES[code]
    if (code === 'overlap' && conflict) {
      return `${message}: «${conflict.title}», ${formatTime(conflict.start)}–${formatTime(conflict.end)}`
    }
    return message
  }

  function handleSubmit() {
    const draft: BookingDraft = {
      roomId,
      title: title.trim(),
      start: combineDateTime(date, startTime),
      end: combineDateTime(date, endTime),
    }
    const result = validateBooking(draft, bookings, now)

    if (!result.ok) {
      setErrors(result.errors)
      setConflict(result.conflict)
      return
    }

    onSubmit(draft)
    setErrors([])
    setConflict(undefined)
    setTitle('')
    setStartTime('')
    setEndTime('')
  }

  return (
    <form
      className="booking-form"
      aria-labelledby={headingId}
      // Встроенная проверка браузера показывает свои подсказки и не знает о пересечениях,
      // поэтому все ошибки выводим единообразно через validateBooking
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <h2 className="booking-form__title" id={headingId}>
        Новая бронь
      </h2>

      <div className="booking-form__field">
        <label className="booking-form__label" htmlFor={`${id}-room`}>
          Комната
        </label>
        <select
          className="booking-form__control"
          id={`${id}-room`}
          value={roomId}
          onChange={(event) => onRoomChange(event.target.value)}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="booking-form__field">
        <label className="booking-form__label" htmlFor={`${id}-title`}>
          Название встречи
        </label>
        <input
          className="booking-form__control"
          id={`${id}-title`}
          ref={titleInputRef}
          type="text"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          autoComplete="off"
          required
          aria-invalid={isTitleInvalid}
          aria-describedby={isTitleInvalid ? errorsId : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="booking-form__field">
        <label className="booking-form__label" htmlFor={`${id}-date`}>
          Дата
        </label>
        <input
          className="booking-form__control"
          id={`${id}-date`}
          type="date"
          value={date}
          min={today}
          required
          aria-invalid={isDateInvalid}
          aria-describedby={isDateInvalid ? errorsId : undefined}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="booking-form__row">
        <div className="booking-form__field">
          <label className="booking-form__label" htmlFor={`${id}-start`}>
            Начало
          </label>
          <input
            className="booking-form__control"
            id={`${id}-start`}
            type="time"
            value={startTime}
            required
            aria-invalid={isTimeInvalid}
            aria-describedby={isTimeInvalid ? errorsId : undefined}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>

        <div className="booking-form__field">
          <label className="booking-form__label" htmlFor={`${id}-end`}>
            Конец
          </label>
          <input
            className="booking-form__control"
            id={`${id}-end`}
            type="time"
            value={endTime}
            required
            aria-invalid={isTimeInvalid}
            aria-describedby={isTimeInvalid ? errorsId : undefined}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="booking-form__errors" id={errorsId} role="alert">
          {errors.map((code) => (
            <li className="booking-form__error" key={code}>
              {getErrorMessage(code)}
            </li>
          ))}
        </ul>
      )}

      <button className="booking-form__submit" type="submit">
        Забронировать
      </button>
    </form>
  )
}
