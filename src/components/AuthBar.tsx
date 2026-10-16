import type { AuthStatus, AuthUser } from '../hooks/useAuth'
import { FOCUS_RING_CLASS_NAME, PRIMARY_BUTTON_CLASS_NAME } from './classNames'

interface AuthBarProps {
  status: AuthStatus
  user: AuthUser | null
  error: string
  onSignIn: () => void
  onSignOut: () => void
}

const SECONDARY_BUTTON_CLASS_NAME = `min-h-11 cursor-pointer rounded-lg border border-(--accent-border) px-4 py-2 text-(--accent) hover:bg-(--accent-bg) ${FOCUS_RING_CLASS_NAME}`

export function AuthBar({ status, user, error, onSignIn, onSignOut }: AuthBarProps) {
  if (status === 'unavailable') {
    return null
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'loading' && (
        // Резервируем высоту кнопки, чтобы шапка не прыгала после проверки сессии
        <span className="min-h-11 text-[14px]" aria-live="polite">
          Проверяем вход…
        </span>
      )}

      {status === 'signedOut' && (
        <button type="button" className={PRIMARY_BUTTON_CLASS_NAME} onClick={onSignIn}>
          Войти через GitHub
        </button>
      )}

      {status === 'signedIn' && user && (
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            // alt пустой: рядом написано имя, аватар его только дублирует
            <img
              className="size-9 rounded-full"
              src={user.avatarUrl}
              alt=""
              width={36}
              height={36}
              referrerPolicy="no-referrer"
            />
          )}
          <span className="font-medium text-(--text-h)">{user.displayName}</span>
          <button type="button" className={SECONDARY_BUTTON_CLASS_NAME} onClick={onSignOut}>
            Выйти
          </button>
        </div>
      )}

      {error !== '' && (
        <p role="alert" className="text-[14px] text-(--danger)">
          {error}
        </p>
      )}
    </div>
  )
}
