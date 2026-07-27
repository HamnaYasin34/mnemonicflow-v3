/**
 * Minimal hand-written typing for the `profiles` table so every Supabase
 * client in the app (browser + server) shares one schema definition.
 *
 * If you later run `supabase gen types typescript`, you can drop this file
 * in favor of the generated one — the shape below matches it either way.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          total_cards: number
          total_reviews: number
          streak_days: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          total_cards?: number
          total_reviews?: number
          streak_days?: number
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          total_cards?: number
          total_reviews?: number
          streak_days?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
