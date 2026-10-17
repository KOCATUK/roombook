import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }))

// Подменяем клиент целиком: тесты не должны ходить в Supabase
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: vi.fn(),
      signOut: signOutMock,
    },
  },
}))

function authApiError(status: number, code: string) {
  return Object.assign(new Error('auth error'), { name: 'AuthApiError', status, code })
}

async function signOutWith(result: { error: unknown }) {
  signOutMock.mockResolvedValue(result)
  const { result: hook } = renderHook(() => useAuth())
  await act(() => hook.current.signOut())
  return hook
}

describe('useAuth signOut', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    signOutMock.mockReset()
    vi.restoreAllMocks()
  })

  it('выходит только из текущей сессии', async () => {
    const hook = await signOutWith({ error: null })
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
    expect(hook.current.error).toBe('')
  })

  it('не считает ошибкой 403 session_not_found', async () => {
    const hook = await signOutWith({ error: authApiError(403, 'session_not_found') })
    expect(hook.current.error).toBe('')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('не считает ошибкой отсутствие локальной сессии', async () => {
    const missing = Object.assign(new Error('Auth session missing!'), {
      name: 'AuthSessionMissingError',
      status: 400,
    })
    const hook = await signOutWith({ error: missing })
    expect(hook.current.error).toBe('')
  })

  it('показывает прочие ошибки выхода', async () => {
    const hook = await signOutWith({ error: authApiError(500, 'unexpected_failure') })
    await waitFor(() => expect(hook.current.error).not.toBe(''))
    expect(hook.current.error).toContain('Не удалось выйти')
    expect(console.error).toHaveBeenCalled()
  })
})
