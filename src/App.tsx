import { useState } from 'react'
import { RoomCard } from './components/RoomCard'
import type { Room } from './types'
import './App.css'

const ROOMS: Room[] = [
  {
    id: 'baikal',
    name: 'Байкал',
    floor: 3,
    capacity: 8,
    equipment: ['projector', 'whiteboard', 'videoConference'],
    isOccupied: false,
  },
  {
    id: 'elbrus',
    name: 'Эльбрус',
    floor: 5,
    capacity: 4,
    equipment: ['whiteboard'],
    isOccupied: true,
  },
  {
    id: 'volga',
    name: 'Волга',
    floor: 2,
    capacity: 12,
    equipment: ['projector', 'videoConference'],
    isOccupied: false,
  },
]

function App() {
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
          <RoomCard key={room.id} room={room} onBook={setBookedRoomId} />
        ))}
      </div>
    </main>
  )
}

export default App
