import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useMatchQueue(user: User, enabled: boolean) {
  const navigate = useNavigate()

  const createMatch = useCallback(async (
    channel: ReturnType<typeof supabase.channel>,
    opponentId: string
  ) => {
    const player1 = user.id < opponentId ? user.id : opponentId
    const player2 = user.id < opponentId ? opponentId : user.id

    const { data, error } = await supabase
      .from('matches')
      .insert({ player1_id: player1, player2_id: player2 })
      .select('id')
      .single()

    if (error) return // Unique constraint hit — other side already created it

    await channel.send({
      type: 'broadcast',
      event: 'match_ready',
      payload: { match_id: data.id, player1_id: player1, player2_id: player2 },
    })
  }, [user.id])

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel('matchmaking', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const others = Object.keys(state).filter(k => k !== user.id)

        if (others.length === 0) return

        // Deterministic: player with smaller UUID initiates to avoid double-creation
        const opponent = others.sort()[0]
        if (user.id < opponent) {
          createMatch(channel, opponent)
        }
      })
      .on('broadcast', { event: 'match_ready' }, ({ payload }) => {
        const { match_id, player1_id, player2_id } = payload as {
          match_id: string
          player1_id: string
          player2_id: string
        }
        if (player1_id === user.id || player2_id === user.id) {
          navigate(`/battle/${match_id}`, {
            state: { player1_id, player2_id },
          })
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, enabled, createMatch, navigate])
}
