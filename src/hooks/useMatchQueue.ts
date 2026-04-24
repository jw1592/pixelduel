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
      .insert({ player1_id: player1, player2_id: player2, status: 'active' })
      .select('id')
      .single()

    if (error) {
      console.error('[matchqueue] createMatch error:', error)
      return
    }

    const payload = { match_id: data.id, player1_id: player1, player2_id: player2 }

    await channel.send({
      type: 'broadcast',
      event: 'match_ready',
      payload,
    })

    // Broadcaster doesn't receive own broadcast — navigate directly
    navigate(`/battle/${data.id}`, { state: { player1_id: player1, player2_id: player2 } })
  }, [user.id, navigate])

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel('matchmaking', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const others = Object.keys(state).filter(k => k !== user.id)
        console.log('[matchqueue] presence sync — state keys:', Object.keys(state), '| others:', others)

        if (others.length === 0) return

        // Deterministic: player with smaller UUID initiates to avoid double-creation
        const opponent = others.sort()[0]
        console.log('[matchqueue] opponent found:', opponent, '| I initiate:', user.id < opponent)
        if (user.id < opponent) {
          createMatch(channel, opponent)
        }
      })
      .on('broadcast', { event: 'match_ready' }, ({ payload }) => {
        console.log('[matchqueue] match_ready received:', payload)
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
        console.log('[matchqueue] channel status:', status)
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id })
          console.log('[matchqueue] tracked user:', user.id)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, enabled, createMatch, navigate])
}
