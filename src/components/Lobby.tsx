import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useProfile } from '../hooks/useProfile'

interface Props {
  user: User
  onSignOut: () => void
  onlineCount: number
}

export function Lobby({ user, onSignOut, onlineCount }: Props) {
  const navigate = useNavigate()
  const { profile, loading } = useProfile(user)

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  const total = profile.wins + profile.losses + profile.draws
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      {/* Title */}
      <h1 className="text-green-400 text-2xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      {/* Online count */}
      <div className="text-yellow-400 text-xs">
        ⚔ {onlineCount} battling now
      </div>

      {/* Player card */}
      <div className="border border-gray-700 p-6 flex flex-col items-center gap-4 w-72">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-12 h-12 rounded-full border-2 border-green-500"
          />
        )}
        <p className="text-green-400 text-xs">{profile.display_name}</p>

        <div className="flex gap-6 text-xs text-center">
          <div>
            <p className="text-gray-500">PLAYED</p>
            <p className="text-white mt-1">{total}</p>
          </div>
          <div>
            <p className="text-green-500">WIN</p>
            <p className="text-white mt-1">{profile.wins}</p>
          </div>
          <div>
            <p className="text-red-500">LOSE</p>
            <p className="text-white mt-1">{profile.losses}</p>
          </div>
          <div>
            <p className="text-gray-500">DRAW</p>
            <p className="text-white mt-1">{profile.draws}</p>
          </div>
        </div>

        {total > 0 && (
          <p className="text-xs text-gray-500">Win rate {winRate}%</p>
        )}
      </div>

      {/* Find opponent */}
      <button
        onClick={() => navigate('/matchmaking')}
        className="bg-green-500 hover:bg-green-400 text-black text-xs px-8 py-4 transition-colors cursor-pointer font-bold"
      >
        ⚔ FIND OPPONENT
      </button>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
      >
        Sign out
      </button>
    </div>
  )
}
