import { useNavigate, useLocation, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
}


export function Battle({ user: _ }: Props) {
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()
  const location = useLocation()
  const isAI = matchId === 'ai'
  const aiOpponent = (location.state as { opponent?: string } | null)?.opponent

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-green-400 text-2xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      <div className="border border-gray-700 p-8 flex flex-col items-center gap-4 w-80 text-center">
        <p className="text-yellow-400 text-xs">
          {isAI ? 'AI MATCH' : 'MATCH FOUND'}
        </p>
        <p className="text-white text-sm mt-2">
          {isAI ? aiOpponent : `Match ID: ${matchId?.slice(0, 8)}...`}
        </p>
        <p className="text-gray-500 text-xs mt-4 leading-relaxed">
          Battle system coming in Phase 2B.<br/>
          WebRTC + webcam + Minecraft body rendering.
        </p>
      </div>

      <button
        onClick={() => navigate('/')}
        className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer transition-colors"
      >
        Back to Lobby
      </button>
    </div>
  )
}
