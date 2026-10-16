import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createBooking, getBookings, getRooms } from './api/mockApi'
import { BookingForm } from './components/BookingForm'
import { BookingList } from './components/BookingList'
import { RoomCard } from './components/RoomCard'
import { EmptyState } from './components/states/EmptyState'
import { ErrorState } from './components/states/ErrorState'
import { LoadingState } from './components/states/LoadingState'
import { useAsync } from './hooks/useAsync'
import { useNow } from './hooks/useNow'
import type { Booking, BookingDraft, Room } from './types'
import { getCurrentBooking } from './utils/bookings'
import { formatDate, formatTime } from './utils/dateTime'
import { formatRoomSummary, getRoomSummary } from './utils/roomSummary'

function App() {
  const now = useNow()
  const { state: roomsState, reload: reloadRooms } = useAsync(getRooms)
  const { state: bookingsState, reload: reloadBookings } = useAsync(getBookings)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [syncedBookings, setSyncedBookings] = useState<Booking[] | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<Room['id'] | null>(null)
  const [notice, setNotice] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Новые брони пока добавляются только локально, поэтому локальный список
  // перезаписываем лишь когда с API пришли новые данные (первая загрузка или «Повторить»)
  const loadedBookings =
    bookingsState.status === 'success' ? bookingsState.data : null
  if (loadedBookings && loadedBookings !== syncedBookings) {
    setSyncedBookings(loadedBookings)
    setBookings(loadedBookings)
  }

  const rooms = roomsState.status === 'success' ? roomsState.data : []
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId)

  function handleBook(roomId: Room['id']) {
    setNotice('')
    // Форма может ещё не быть в DOM: рендерим её синхронно, чтобы сразу перевести в неё фокус
    flushSync(() => setSelectedRoomId(roomId))
    titleInputRef.current?.focus()
  }

  // Ошибку не ловим: её показывает форма, чтобы сохранить введённые данные
  async function handleSubmit(draft: BookingDraft) {
    setNotice('')
    const booking = await createBooking(draft)
    setBookings((prev) => [...prev, booking])
    const roomName = rooms.find((room) => room.id === booking.roomId)?.name ?? ''
    setNotice(
      `Комната «${roomName}» забронирована: ${formatDate(booking.start)}, ${formatTime(booking.start)}–${formatTime(booking.end)}`,
    )
  }

  // Повторяем только упавшие запросы, чтобы не сбрасывать уже загруженное
  function handleRetry() {
    if (roomsState.status === 'error') {
      reloadRooms()
    }
    if (bookingsState.status === 'error') {
      reloadBookings()
    }
  }

  function renderRooms() {
    if (roomsState.status === 'error' || bookingsState.status === 'error') {
      const message =
        roomsState.status === 'error'
          ? roomsState.message
          : bookingsState.status === 'error'
            ? bookingsState.message
            : ''
      return <ErrorState message={message} onRetry={handleRetry} />
    }

    // Без броней статус комнат неизвестен, поэтому ждём оба запроса
    if (roomsState.status !== 'success' || bookingsState.status !== 'success') {
      return <LoadingState label="Загрузка комнат…" />
    }

    if (rooms.length === 0) {
      return <EmptyState message="Комнат пока нет" />
    }

    return (
      <div className="flex flex-col gap-4">
        <p>{formatRoomSummary(getRoomSummary(rooms, bookings, now))}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              currentBooking={getCurrentBooking(room.id, bookings, now)}
              onBook={handleBook}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-[1126px] px-4 py-8">
      <h1 className="mb-2">Переговорные</h1>

      {/* div, а не p: правило p { margin: 0 } в index.css вне слоёв и перебивает утилиты отступов */}
      <div className="mb-4 min-h-[1.45em] text-(--accent)" role="status">
        {notice}
      </div>

      {selectedRoom && (
        <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-6">
          <BookingForm
            rooms={rooms}
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

      {renderRooms()}
    </main>
  )
}

export default App
