import { PRIMARY_BUTTON_CLASS_NAME } from '../classNames'

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
      <button type="button" onClick={onRetry} className={PRIMARY_BUTTON_CLASS_NAME}>
        {retryLabel}
      </button>
    </div>
  )
}
