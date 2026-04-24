import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'

interface Props {
  user: User
}

export function Matchmaking({ user }: Props) {
  const navigate = useNavigate()
  const { profile } = useProfile(user)
  const [elapsed, setElapsed] = useState(0)
  const [searching, setSearching] = useState(false)

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

  // Enter queue on mount
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

  // Elapsed timer
  useEffect(() => {
    if (!searching) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [searching])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-green-400 text-xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />

        <p className="text-yellow-400 text-xs">Searching for opponent...</p>
        <p className="text-gray-500 text-xs">{mm}:{ss}</p>
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
