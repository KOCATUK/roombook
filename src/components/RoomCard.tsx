import type { Booking, Equipment, Room } from '../types'
import { formatTime } from '../utils/dateTime'
import './RoomCard.css'

interface RoomCardProps {
  room: Room
  /** Бронь, идущая прямо сейчас; если её нет, комната свободна */
  currentBooking?: Booking
  onBook?: (roomId: Room['id']) => void
}

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  projector: 'Проектор',
  whiteboard: 'Доска',
  videoConference: 'Видеосвязь',
}

const pluralRules = new Intl.PluralRules('ru-RU')

// 1 человек, 2 человека, 5 человек
function formatCapacity(count: number): string {
  const form = pluralRules.select(count) === 'few' ? 'человека' : 'человек'
  return `${count} ${form}`
}

export function RoomCard({ room, currentBooking, onBook }: RoomCardProps) {
  const { id, name, floor, capacity, equipment } = room
  const isOccupied = currentBooking !== undefined
  const statusId = `room-card-status-${id}`
  const bookingId = `room-card-booking-${id}`

  return (
    <article
      className={`room-card${isOccupied ? ' room-card--occupied' : ''}`}
      aria-labelledby={`room-card-title-${id}`}
    >
      <header className="room-card__header">
        <h3 className="room-card__title" id={`room-card-title-${id}`}>
          {name}
        </h3>
        <span
          className={`room-card__status room-card__status--${isOccupied ? 'occupied' : 'free'}`}
          id={statusId}
        >
          {currentBooking ? `Занята до ${formatTime(currentBooking.end)}` : 'Свободна'}
        </span>
      </header>

      {currentBooking && (
        // Название брони приходит из данных и может быть любой длины, поэтому оно
        // вынесено из бейджа: бейдж не переносится и вылезал бы за край карточки
        <p className="room-card__booking" id={bookingId} title={currentBooking.title}>
          {currentBooking.title}
        </p>
      )}

      <dl className="room-card__details">
        <div className="room-card__detail">
          <dt className="room-card__detail-label">Этаж</dt>
          <dd className="room-card__detail-value">{floor}</dd>
        </div>
        <div className="room-card__detail">
          <dt className="room-card__detail-label">Вместимость</dt>
          <dd className="room-card__detail-value">{formatCapacity(capacity)}</dd>
        </div>
      </dl>

      {equipment.length > 0 ? (
        <ul className="room-card__equipment" aria-label="Оборудование">
          {equipment.map((item) => (
            <li className="room-card__equipment-item" key={item}>
              {EQUIPMENT_LABELS[item]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="room-card__equipment-empty">Без оборудования</p>
      )}

      <button
        className="room-card__button"
        type="button"
        // Не блокируем: занятую сейчас комнату можно забронировать на другое время
        aria-describedby={isOccupied ? `${statusId} ${bookingId}` : undefined}
        onClick={() => onBook?.(id)}
      >
        Забронировать
      </button>
    </article>
  )
}
