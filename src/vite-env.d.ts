/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Project URL из настроек Supabase; без него приложение работает на mock API */
  readonly VITE_SUPABASE_URL?: string
  /** Публичный anon-ключ: доступ к данным ограничивают RLS и GRANT */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Measurement ID Google Analytics 4; без него берётся ID проекта из analytics.ts */
  readonly VITE_GA_MEASUREMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
