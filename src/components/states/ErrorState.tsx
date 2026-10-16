import { PRIMARY_BUTTON_CLASS_NAME } from '../classNames'

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-(--text-h)"
    >
      <p>{message}</p>
      <button type="button" onClick={onRetry} className={PRIMARY_BUTTON_CLASS_NAME}>
        Повторить
      </button>
    </div>
  )
}
