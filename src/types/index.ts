export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  wins: number
  losses: number
  draws: number
  created_at: string
}

export interface ActivePlayer {
  user_id: string
  status: 'lobby' | 'searching' | 'in_game'
  updated_at: string
}

export type AuthUser = {
  id: string
  email: string | null
  user_metadata: {
    full_name?: string
    avatar_url?: string
  }
}
