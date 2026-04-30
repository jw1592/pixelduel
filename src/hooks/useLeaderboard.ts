import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface LeaderboardEntry {
  id: string
  display_name: string
  avatar_url: string | null
  country_code: string | null
  pvp_wins: number
}

export function useLeaderboard(limit = 10) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, country_code, pvp_wins')
      .gt('pvp_wins', 0)
      .order('pvp_wins', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) { console.error('leaderboard fetch error:', error); return }
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [limit])

  return { entries, loading }
}
