import { useNavigate } from 'react-router-dom'
import { useLeaderboard } from '../hooks/useLeaderboard'

function countryFlag(code: string | null): string {
  if (!code) return ''
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

export function Leaderboard() {
  const navigate = useNavigate()
  const { entries, loading } = useLeaderboard(20)

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6">
      <h1 className="text-green-400 text-xl leading-loose text-center">PIXEL<br/>DUEL</h1>
      <h2 className="text-white text-xs tracking-widest">RANKING</h2>

      {loading ? (
        <p className="text-gray-600 text-xs">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-600 text-xs">No ranked players yet.</p>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-2">
          {entries.map((entry, i) => {
            const medals = ['🥇', '🥈', '🥉']
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 border ${i === 0 ? 'border-yellow-500 bg-yellow-500/5' : 'border-gray-800'}`}
              >
                <span className="text-sm w-6 text-center">
                  {i < 3 ? medals[i] : <span className="text-gray-600 text-xs">{i + 1}</span>}
                </span>
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.display_name}
                    className="w-7 h-7 object-cover border border-gray-700"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-7 h-7 bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-gray-600 text-xs">?</span>
                  </div>
                )}
                <span className="text-xs w-5 text-center text-gray-600">
                  {countryFlag(entry.country_code)}
                </span>
                <span className={`flex-1 text-xs truncate ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>
                  {entry.display_name}
                </span>
                <span className={`text-xs ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {entry.pvp_wins}W
                </span>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer transition-colors"
      >
        Back
      </button>
    </div>
  )
}
