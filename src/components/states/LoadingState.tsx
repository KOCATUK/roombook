interface LoadingStateProps {
  /** Текст для скринридера: сам скелетон он не озвучивает */
  label?: string
  /** Сколько заглушек показать */
  count?: number
  /** compact — строки списка внутри карточки, cards — сетка карточек */
  variant?: 'cards' | 'compact'
}

const PULSE_CLASS_NAME = 'animate-pulse rounded bg-(--border) motion-reduce:animate-none'

export function LoadingState({
  label = 'Загрузка…',
  count = 3,
  variant = 'cards',
}: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, index) => index)

  if (variant === 'compact') {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">{label}</span>
        {items.map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="flex flex-col gap-1.5 rounded-md border-l-3 border-(--border) px-3 py-2"
          >
            <div className={`h-3 w-1/3 ${PULSE_CLASS_NAME}`} />
            <div className={`h-4 w-2/3 ${PULSE_CLASS_NAME}`} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">{label}</span>
      {items.map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--bg) p-5 shadow-(--shadow)"
        >
          <div className={`h-5 w-1/2 ${PULSE_CLASS_NAME}`} />
          <div className={`h-4 w-3/4 ${PULSE_CLASS_NAME}`} />
          <div className={`h-4 w-2/3 ${PULSE_CLASS_NAME}`} />
          <div className={`h-10 rounded-lg ${PULSE_CLASS_NAME}`} />
        </div>
      ))}
    </div>
  )
}
