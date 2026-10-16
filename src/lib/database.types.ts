// Типы таблиц по миграциям из supabase/migrations. Написаны вручную в формате
// `supabase gen types typescript`: генерации нужен связанный проект или Docker.
// После изменения схемы обновите их вместе с миграцией.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          display_name?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          name: string
          floor: number
          capacity: number
          equipment: string[]
          created_at: string
        }
        Insert: {
          id: string
          name: string
          floor: number
          capacity: number
          equipment?: string[]
          created_at?: string
        }
        Update: {
          name?: string
          floor?: number
          capacity?: number
          equipment?: string[]
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          room_id: string
          user_id: string
          title: string
          starts_at: string
          ends_at: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id?: string
          title: string
          starts_at: string
          ends_at: string
          created_at?: string
        }
        // Только столбцы, на которые выдан GRANT UPDATE
        Update: {
          room_id?: string
          title?: string
          starts_at?: string
          ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']

export type RoomRow = PublicTables['rooms']['Row']
export type BookingRow = PublicTables['bookings']['Row']
export type BookingInsert = PublicTables['bookings']['Insert']
export type ProfileRow = PublicTables['profiles']['Row']
