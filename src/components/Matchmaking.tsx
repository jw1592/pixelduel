import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useMatchQueue } from '../hooks/useMatchQueue'
import { AI_CHARACTERS } from '../data/aiCharacters'

const AI_FALLBACK_SECONDS = 4

interface Props {
  user: User
}

export function Matchmaking({ user }: Props) {
  const navigate = useNavigate()
  const { profile } = useProfile(user)
  const [elapsed, setElapsed] = useState(0)
  const [searching, setSearching] = useState(false)
  const [aiCountdown, setAiCountdown] = useState<number | null>(null)

  useMatchQueue(user, searching)

  const enterQueue = useCallback(async () => {
    await supabase.from('active_players').upsert({
      user_id: user.id,
      status: 'searching',
      updated_at: new Date().toISOString(),
    })
    setSearching(true)
  }, [user.id])

  const leaveQueue = useCallback(async () => {
    await supabase.from('active_players').upsert({
      user_id: user.id,
      status: 'lobby',
      updated_at: new Date().toISOString(),
    })
    setSearching(false)
    navigate('/')
  }, [user.id, navigate])

  useEffect(() => {
    enterQueue()
    return () => {
      supabase.from('active_players').upsert({
        user_id: user.id,
        status: 'lobby',
        updated_at: new Date().toISOString(),
      })
    }
  }, [enterQueue, user.id])

  useEffect(() => {
    if (!searching) return
    const id = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next === AI_FALLBACK_SECONDS) {
          const ai = AI_CHARACTERS[Math.floor(Math.random() * AI_CHARACTERS.length)]
          setAiCountdown(3)
          const countdown = setInterval(() => {
            setAiCountdown(c => {
              if (c === null || c <= 1) {
                clearInterval(countdown)
                navigate('/battle/ai', { state: { opponent: `AI — ${ai}` } })
                return null
              }
              return c - 1
            })
          }, 1000)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [searching, navigate])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  if (aiCountdown !== null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-green-400 text-xl leading-loose text-center">PIXEL<br/>DUEL</h1>
        <p className="text-gray-500 text-xs">No opponent found</p>
        <p className="text-yellow-400 text-xs">Switching to AI practice match</p>
        <p className="text-gray-600 text-xs">This match will not affect your record</p>
        <p className="text-white text-4xl">{aiCountdown}</p>
        <p className="text-gray-500 text-xs">Get ready...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-green-400 text-xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-yellow-400 text-xs">Searching for opponent...</p>
        <p className="text-gray-500 text-xs">{mm}:{ss}</p>
        {elapsed >= AI_FALLBACK_SECONDS - 5 && elapsed < AI_FALLBACK_SECONDS && (
          <p className="text-gray-600 text-xs">AI match in {AI_FALLBACK_SECONDS - elapsed}s...</p>
        )}
      </div>

      {profile && (
        <div className="text-center text-xs text-gray-600">
          <p>{profile.display_name}</p>
          <p className="mt-1">{profile.wins}W {profile.losses}L</p>
        </div>
      )}

      <button
        onClick={leaveQueue}
        className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
