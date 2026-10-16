/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Project URL из настроек Supabase; без него приложение работает на mock API */
  readonly VITE_SUPABASE_URL?: string
  /** Публичный anon-ключ: доступ к данным ограничивают RLS и GRANT */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
