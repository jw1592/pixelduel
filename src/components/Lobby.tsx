import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useProfile } from '../hooks/useProfile'
import { useCountryFlag } from '../hooks/useCountryFlag'
import { useLeaderboard } from '../hooks/useLeaderboard'

interface Props {
  user: User
  onSignOut: () => void
  onlineCount: number
}

function countryFlag(code: string | null): string {
  if (!code) return ''
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

export function Lobby({ user, onSignOut, onlineCount }: Props) {
  const navigate = useNavigate()
  const { profile, loading } = useProfile(user)
  const { flag } = useCountryFlag()
  const { entries: leaderboard } = useLeaderboard(3)

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  const total = profile.wins + profile.losses + profile.draws
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0
  const displayFlag = profile.country_code ? countryFlag(profile.country_code) : flag

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 overflow-hidden" style={{ height: '100dvh' }}>
      <h1 className="text-green-400 text-4xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      <div className="text-yellow-400 text-sm">
        ⚔ {onlineCount} online now
      </div>

      {leaderboard.length > 0 && (
        <div className="w-72 border border-gray-800 bg-gray-900/40 px-4 pt-3 pb-4 flex flex-col items-center gap-3">
          <p className="text-gray-600 text-xs tracking-widest">PVP RANKING</p>
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex items-end gap-4 cursor-pointer group"
          >
            {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, podiumIdx) => {
              if (!entry) return <div key={podiumIdx} className="w-16" />
              const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3
              const medals = ['🥇', '🥈', '🥉'] as const
              const medal = medals[rank - 1]
              const isFirst = rank === 1
              return (
                <div key={entry.id} className={`flex flex-col items-center gap-1 ${isFirst ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`}>
                  <span className="text-xs">{medal}</span>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.display_name}
                      className={`object-cover border ${isFirst ? 'w-10 h-10 border-yellow-500' : 'w-8 h-8 border-gray-600'}`}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className={`bg-gray-800 border flex items-center justify-center ${isFirst ? 'w-10 h-10 border-yellow-500' : 'w-8 h-8 border-gray-600'}`}>
                      <span className="text-gray-600" style={{ fontSize: isFirst ? 18 : 14 }}>?</span>
                    </div>
                  )}
                  <span className={`text-xs truncate max-w-16 ${isFirst ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {countryFlag(entry.country_code)}{entry.display_name.split(' ')[0]}
                  </span>
                  <span className={`text-xs ${isFirst ? 'text-yellow-500' : 'text-gray-600'}`}>{entry.pvp_wins}W</span>
                </div>
              )
            })}
          </button>
        </div>
      )}

      <div className="border border-gray-700 p-6 flex flex-col items-center gap-4 w-72">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-12 h-12 border-2 border-green-500 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
        <p className="text-green-400 text-xs">
          {displayFlag && <span className="mr-2">{displayFlag}</span>}
          {profile.display_name}
        </p>

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
          <div>
            <p className="text-yellow-500">PVP</p>
            <p className="text-white mt-1">{profile.pvp_wins}</p>
          </div>
        </div>

        {total > 0 && (
          <p className="text-xs text-gray-500">Win rate {winRate}%</p>
        )}

        <button
          onClick={() => navigate('/profile')}
          className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer underline"
        >
          Edit Profile
        </button>
      </div>

      <button
        onClick={() => navigate('/matchmaking')}
        className="bg-green-500 hover:bg-green-400 text-black text-xs px-8 py-4 transition-colors cursor-pointer font-bold"
      >
        ⚔ START BATTLE
      </button>

      <button
        onClick={onSignOut}
        className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
      >
        Sign out
      </button>
    </div>
  )
}
