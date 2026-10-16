export type DataSource = 'mock' | 'supabase'

export interface GetBookingsOptions {
  /**
   * Запросить имя автора (profiles). Только для вошедшего пользователя:
   * у гостя нет прав на profiles. Mock API параметр игнорирует
   */
  withAuthors?: boolean
}
