import { useState } from 'react'
import { RoomCard } from './components/RoomCard'
import { createInitialBookings } from './data/initialBookings'
import { useNow } from './hooks/useNow'
import type { Booking, Room } from './types'
import { getCurrentBooking } from './utils/bookings'
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
  const [bookings] = useState<Booking[]>(() => createInitialBookings(new Date()))
  const [bookedRoomId, setBookedRoomId] = useState<Room['id'] | null>(null)
  const bookedRoom = ROOMS.find((room) => room.id === bookedRoomId)

  return (
    <main className="app">
      <h1 className="app__title">Переговорные</h1>

      <p className="app__notice" role="status">
        {bookedRoom ? `Вы выбрали комнату «${bookedRoom.name}»` : ''}
      </p>

      <div className="app__rooms">
        {ROOMS.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            currentBooking={getCurrentBooking(room.id, bookings, now)}
            onBook={setBookedRoomId}
          />
        ))}
      </div>
    </main>
  )
}

export default App
