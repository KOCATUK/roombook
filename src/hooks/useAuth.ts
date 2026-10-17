import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { toAppError } from '../api/appError'
import type { ApiOperation } from '../api/appError'
import { trackEvent } from '../lib/analytics'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

export type AuthStatus = 'unavailable' | 'loading' | 'signedIn' | 'signedOut'

export interface AuthUser {
  id: string
  displayName: string
  avatarUrl: string | null
}

export interface UseAuthResult {
  status: AuthStatus
  session: Session | null
  user: AuthUser | null
  /** Сообщение последней ошибки входа или выхода */
  error: string
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

// Те же запасные варианты, что в триггере handle_new_user, чтобы имя в шапке
// совпадало с профилем без отдельного запроса к profiles
function toAuthUser(session: Session): AuthUser {
  const metadata = session.user.user_metadata
  return {
    id: session.user.id,
    displayName:
      readMetadataString(metadata, 'full_name') ??
      readMetadataString(metadata, 'name') ??
      readMetadataString(metadata, 'user_name') ??
      'Пользователь',
    avatarUrl: readMetadataString(metadata, 'avatar_url'),
  }
}

// SIGNED_IN приходит и при возврате на вкладку, поэтому login отправляем только
// после перехода на GitHub из этой вкладки; sessionStorage переживает редирект
const LOGIN_PENDING_KEY = 'roombook:login-pending'

function setLoginPending(isPending: boolean) {
  try {
    if (isPending) {
      sessionStorage.setItem(LOGIN_PENDING_KEY, '1')
    } else {
      sessionStorage.removeItem(LOGIN_PENDING_KEY)
    }
  } catch {
    // Без sessionStorage (запрет в браузере) просто не будет события login
  }
}

function isLoginPending(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_PENDING_KEY) !== null
  } catch {
    return false
  }
}

function reportError(error: unknown, operation: ApiOperation): string {
  const appError = toAppError(error, operation)
  logger.error('Auth request failed', {
    operation,
    kind: appError.kind,
    status: appError.cause.status,
    code: appError.cause.code,
  })
  return appError.message
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null)
  // Без клиента ждать нечего; иначе ждём INITIAL_SESSION от подписки
  const [isLoading, setIsLoading] = useState(supabase !== null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      return
    }
    // Подписка сразу присылает INITIAL_SESSION, поэтому отдельный getSession не нужен.
    // Она же ловит возврат с GitHub, выход в другой вкладке и обновление токена
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_IN' && nextSession && isLoginPending()) {
        setLoginPending(false)
        trackEvent('login', { method: 'github' })
      }
      setSession(nextSession)
      setIsLoading(false)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const signInWithGitHub = useCallback(async () => {
    if (!supabase) {
      return
    }
    setError('')
    setLoginPending(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      })
      if (signInError) {
        throw signInError
      }
    } catch (caught: unknown) {
      setLoginPending(false)
      setError(reportError(caught, 'signIn'))
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      return
    }
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        throw signOutError
      }
    } catch (caught: unknown) {
      setError(reportError(caught, 'signOut'))
    }
  }, [])

  const status: AuthStatus = !supabase
    ? 'unavailable'
    : isLoading
      ? 'loading'
      : session
        ? 'signedIn'
        : 'signedOut'

  return {
    status,
    session,
    user: session ? toAuthUser(session) : null,
    error,
    signInWithGitHub,
    signOut,
  }
}
