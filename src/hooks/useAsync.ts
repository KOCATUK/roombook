import { useCallback, useEffect, useState } from 'react'
import type { AsyncState } from '../types'

const DEFAULT_ERROR_MESSAGE = 'Не удалось загрузить данные'

export interface UseAsyncResult<T> {
  state: AsyncState<T>
  reload: () => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : DEFAULT_ERROR_MESSAGE
}

/**
 * `load` должен быть стабильной ссылкой (функция вне компонента или useCallback),
 * иначе загрузка будет перезапускаться на каждой перерисовке
 */
export function useAsync<T>(load: () => Promise<T>): UseAsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // Функцию в useState кладём через обёртку, иначе React вызовет её как инициализатор
  const [prevLoad, setPrevLoad] = useState(() => load)

  // Смена источника (например, другой комнаты) сразу показывает загрузку,
  // а не старые данные до прихода новых. Сброс во время рендера, а не в эффекте,
  // избавляет от лишнего кадра со старыми данными
  if (load !== prevLoad) {
    setPrevLoad(() => load)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    // Ответ устаревшего запроса не должен перезаписать результат более нового
    let isActual = true
    load().then(
      (data) => {
        if (isActual) {
          setState({ status: 'success', data })
        }
      },
      (error: unknown) => {
        if (isActual) {
          setState({ status: 'error', message: getErrorMessage(error) })
        }
      },
    )
    return () => {
      isActual = false
    }
  }, [load, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
