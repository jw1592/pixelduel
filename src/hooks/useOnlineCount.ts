import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useOnlineCount(user: User | null) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const channel = supabase.channel('online_users', {
      config: { presence: { key: user?.id ?? 'anon' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({ user_id: user.id, online_at: Date.now() })
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [user])

  return count
}
