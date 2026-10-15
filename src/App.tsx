import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BookingForm } from './components/BookingForm'
import { BookingList } from './components/BookingList'
import { RoomCard } from './components/RoomCard'
import { createInitialBookings } from './data/initialBookings'
import { useNow } from './hooks/useNow'
import type { Booking, BookingDraft, Room } from './types'
import { getCurrentBooking } from './utils/bookings'
import { formatDate, formatTime } from './utils/dateTime'
import './App.css'

const ROOMS: Room[] = [
  {
    id: 'baikal',
    name: 'Байкал',
    floor: 3,
    capacity: 8,
    equipment: ['projector', 'whiteboard', 'videoConference'],
  },
  {
    id: 'elbrus',
    name: 'Эльбрус',
    floor: 5,
    capacity: 4,
    equipment: ['whiteboard'],
  },
  {
    id: 'volga',
    name: 'Волга',
    floor: 2,
    capacity: 12,
    equipment: ['projector', 'videoConference'],
  },
]

function App() {
  const now = useNow()
  const [bookings, setBookings] = useState<Booking[]>(() =>
    createInitialBookings(new Date()),
  )
  const [selectedRoomId, setSelectedRoomId] = useState<Room['id'] | null>(null)
  const [notice, setNotice] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const selectedRoom = ROOMS.find((room) => room.id === selectedRoomId)

  function handleBook(roomId: Room['id']) {
    setNotice('')
    // Форма может ещё не быть в DOM: рендерим её синхронно, чтобы сразу перевести в неё фокус
    flushSync(() => setSelectedRoomId(roomId))
    titleInputRef.current?.focus()
  }

  function handleSubmit(draft: BookingDraft) {
    setBookings((prev) => [...prev, { ...draft, id: crypto.randomUUID() }])
    const roomName = ROOMS.find((room) => room.id === draft.roomId)?.name ?? ''
    setNotice(
      `Комната «${roomName}» забронирована: ${formatDate(draft.start)}, ${formatTime(draft.start)}–${formatTime(draft.end)}`,
    )
  }

  return (
    <main className="app">
      <h1 className="app__title">Переговорные</h1>

      <p className="app__notice" role="status">
        {notice}
      </p>

      {selectedRoom && (
        <div className="app__booking">
          <BookingForm
            rooms={ROOMS}
            bookings={bookings}
            now={now}
            roomId={selectedRoom.id}
            onRoomChange={setSelectedRoomId}
            onSubmit={handleSubmit}
            titleInputRef={titleInputRef}
          />
          <BookingList room={selectedRoom} bookings={bookings} />
        </div>
      )}

      <div className="app__rooms">
        {ROOMS.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            currentBooking={getCurrentBooking(room.id, bookings, now)}
            onBook={handleBook}
          />
        ))}
      </div>
    </main>
  )
}

export default App
