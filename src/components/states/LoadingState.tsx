interface LoadingStateProps {
  /** Текст для скринридера: сам скелетон он не озвучивает */
  label?: string
  /** Сколько карточек-заглушек показать */
  count?: number
}

export function LoadingState({ label = 'Загрузка…', count = 3 }: LoadingStateProps) {
  return (
    <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--bg) p-5 shadow-(--shadow)"
        >
          <div className="h-5 w-1/2 animate-pulse rounded bg-(--border) motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-(--border) motion-reduce:animate-none" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-(--border) motion-reduce:animate-none" />
          <div className="h-10 animate-pulse rounded-lg bg-(--border) motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}
