import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useOnlineCount(user: User | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('online_users', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: Date.now() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  return count
}
