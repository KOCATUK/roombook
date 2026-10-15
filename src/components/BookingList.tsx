import { useId } from 'react'
import type { Booking, Room } from '../types'
import { getRoomBookings } from '../utils/bookings'
import { formatDate, formatTime } from '../utils/dateTime'
import './BookingList.css'

interface BookingListProps {
  room: Room
  bookings: Booking[]
}

export function BookingList({ room, bookings }: BookingListProps) {
  const headingId = useId()
  const roomBookings = getRoomBookings(room.id, bookings)

  return (
    <section className="booking-list" aria-labelledby={headingId}>
      <h2 className="booking-list__title" id={headingId}>
        Расписание: {room.name}
      </h2>

      {roomBookings.length > 0 ? (
        <ul className="booking-list__items">
          {roomBookings.map((booking) => (
            <li className="booking-list__item" key={booking.id}>
              <span className="booking-list__time">
                {formatDate(booking.start)},{' '}
                <time dateTime={booking.start}>{formatTime(booking.start)}</time>–
                <time dateTime={booking.end}>{formatTime(booking.end)}</time>
              </span>
              <span className="booking-list__name">{booking.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="booking-list__empty">Броней пока нет</p>
      )}
    </section>
  )
}
