import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  cancelBooking,
  createBooking,
  getBookings,
  getRooms,
} from './api/mockApi'
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
  // Последние успешно загруженные брони: пока после создания или отмены идёт перезагрузка,
  // каталог и проверка формы работают по ним, а не мигают скелетоном
  const [lastBookings, setLastBookings] = useState<Booking[] | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<Room['id'] | null>(null)
  const [notice, setNotice] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const loadedBookings =
    bookingsState.status === 'success' ? bookingsState.data : null
  // Обновляем во время рендера, а не в эффекте (как в useAsync): иначе один кадр
  // после загрузки показал бы устаревшие брони
  if (loadedBookings && loadedBookings !== lastBookings) {
    setLastBookings(loadedBookings)
  }

  const bookings = loadedBookings ?? lastBookings ?? []
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
    reloadBookings()
    const roomName = rooms.find((room) => room.id === booking.roomId)?.name ?? ''
    setNotice(
      `Комната «${roomName}» забронирована: ${formatDate(booking.start)}, ${formatTime(booking.start)}–${formatTime(booking.end)}`,
    )
  }

  // Ошибку не ловим: её показывает строка расписания
  async function handleCancel(booking: Booking) {
    setNotice('')
    await cancelBooking(booking.id)
    reloadBookings()
    setNotice(`Бронь «${booking.title}» отменена`)
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
    // Если брони уже загружались, ошибку перезагрузки показывает расписание,
    // а каталог остаётся с последними данными
    const isBookingsFailed =
      bookingsState.status === 'error' && lastBookings === null
    if (roomsState.status === 'error' || isBookingsFailed) {
      const message =
        roomsState.status === 'error'
          ? roomsState.message
          : bookingsState.status === 'error'
            ? bookingsState.message
            : ''
      return <ErrorState message={message} onRetry={handleRetry} />
    }

    // Без броней статус комнат неизвестен, поэтому ждём оба запроса
    if (roomsState.status !== 'success' || lastBookings === null) {
      return <LoadingState label="Загрузка комнат…" />
    }

    if (rooms.length === 0) {
      return <EmptyState message="Комнат пока нет" />
    }

    return (
      <div className="flex flex-col gap-4">
        <p>{formatRoomSummary(getRoomSummary(rooms, bookings, now))}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
      <h1 className="mb-1">Переговорные</h1>

      <div className="mb-3 min-h-[1.45em] text-(--accent) sm:mb-4" role="status">
        {notice}
      </div>

      {selectedRoom && (
        // На широком экране форме хватает 24rem, остальную ширину получает расписание
        <div className="mb-8 grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-6">
          <BookingForm
            rooms={rooms}
            bookings={bookings}
            now={now}
            roomId={selectedRoom.id}
            onRoomChange={setSelectedRoomId}
            onSubmit={handleSubmit}
            titleInputRef={titleInputRef}
          />
          <BookingList
            room={selectedRoom}
            bookingsState={bookingsState}
            onRetry={reloadBookings}
            onCancel={handleCancel}
          />
        </div>
      )}

      {renderRooms()}
    </main>
  )
}

export default App
