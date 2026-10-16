interface ErrorStateProps {
  message: string
  onRetry: () => void
  retryLabel?: string
}

export function ErrorState({ message, onRetry, retryLabel = 'Повторить' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-(--text-h)"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-lg bg-(--accent) px-4 py-2.5 font-medium text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) dark:text-[#16171d]"
      >
        {retryLabel}
      </button>
    </div>
  )
}
