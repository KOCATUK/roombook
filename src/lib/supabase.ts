import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

// Без переменных клиент не создаём: createClient бросает исключение на пустом URL,
// а приложение должно открыться и работать на mock API
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE: после возврата с GitHub в адресе только одноразовый code, а не токены
        flowType: 'pkce',
      },
    })
  : null
