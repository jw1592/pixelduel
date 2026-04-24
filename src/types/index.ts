export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  country_code: string | null
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

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  status: 'active' | 'finished'
  winner_id: string | null
  created_at: string
}

export type PoseLandmark = { x: number; y: number; z: number; visibility?: number }

export type GestureState = { isAttacking: boolean; isBlocking: boolean }

export type GameMessage =
  | { type: 'pose'; landmarks: PoseLandmark[]; t: number }
  | { type: 'attack' }
  | { type: 'hp'; value: number }
  | { type: 'dead' }

export type WebRTCSignal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit }

export type BattleStatus = 'connecting' | 'active' | 'victory' | 'defeat'
