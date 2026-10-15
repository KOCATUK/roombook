import { useEffect, useState } from 'react'
import type { LocalDateTime } from '../types'
import { toLocalDateTime } from '../utils/dateTime'

const DEFAULT_INTERVAL_MS = 30_000

// Точность до минуты: строка меняется раз в минуту, и React пропускает
// перерисовку, пока значение то же. Частый опрос нужен только чтобы смена минуты не запаздывала
export function useNow(intervalMs = DEFAULT_INTERVAL_MS): LocalDateTime {
  const [now, setNow] = useState(() => toLocalDateTime(new Date()))

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(toLocalDateTime(new Date()))
    }, intervalMs)
    return () => window.clearInterval(timerId)
  }, [intervalMs])

  return now
}
