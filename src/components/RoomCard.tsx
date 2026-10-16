import type { Booking, Equipment, Room } from '../types'
import { formatTime } from '../utils/dateTime'
import {
  PANEL_CLASS_NAME,
  PANEL_HEADING_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
} from './classNames'

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

const STATUS_CLASS_NAME =
  'shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap'

const FREE_STATUS_CLASS_NAME =
  'bg-(--success-bg) text-(--success)'

const OCCUPIED_STATUS_CLASS_NAME =
  'bg-(--danger-bg) text-(--danger)'

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
      className={`flex flex-col gap-4 p-4 text-left sm:p-5 ${PANEL_CLASS_NAME}${isOccupied ? ' opacity-85' : ''}`}
      aria-labelledby={`room-card-title-${id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className={PANEL_HEADING_CLASS_NAME} id={`room-card-title-${id}`}>
          {name}
        </h3>
        <span
          className={`${STATUS_CLASS_NAME} ${isOccupied ? OCCUPIED_STATUS_CLASS_NAME : FREE_STATUS_CLASS_NAME}`}
          id={statusId}
        >
          {currentBooking ? `Занята до ${formatTime(currentBooking.end)}` : 'Свободна'}
        </span>
      </header>

      {currentBooking && (
        // Название брони приходит из данных и может быть любой длины, поэтому оно
        // вынесено из бейджа: бейдж не переносится и вылезал бы за край карточки.
        // Полный текст остаётся в DOM для скринридеров и в title для мыши
        <p
          className="line-clamp-2 text-[14px] wrap-anywhere text-(--text-h)"
          id={bookingId}
          title={currentBooking.title}
        >
          {currentBooking.title}
        </p>
      )}

      <dl className="flex gap-6">
        <div>
          <dt className="text-[13px]">Этаж</dt>
          <dd className="font-medium text-(--text-h)">{floor}</dd>
        </div>
        <div>
          <dt className="text-[13px]">Вместимость</dt>
          <dd className="font-medium text-(--text-h)">{formatCapacity(capacity)}</dd>
        </div>
      </dl>

      {equipment.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Оборудование">
          {equipment.map((item) => (
            <li
              className="rounded-md border border-(--accent-border) bg-(--accent-bg) px-2.5 py-1 text-[14px] text-(--accent)"
              key={item}
            >
              {EQUIPMENT_LABELS[item]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] italic">Без оборудования</p>
      )}

      <button
        // mt-auto прижимает кнопку к низу: карточки в ряду сетки растянуты до одной высоты,
        // и без этого кнопки стояли бы на разной высоте
        className={`mt-auto min-h-11 ${PRIMARY_BUTTON_CLASS_NAME}`}
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
