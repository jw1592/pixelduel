import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = useCallback(async (u: User) => {
    // Try to fetch existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .single()

    if (!error && data) {
      setProfile(data as Profile)
      return
    }

    // Auto-create on first login
    const displayName =
      u.user_metadata?.full_name ??
      u.email?.split('@')[0] ??
      'Player'

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: u.id,
        display_name: displayName,
        avatar_url: u.user_metadata?.avatar_url ?? null,
      })
      .select()
      .single()

    if (!createError && created) {
      setProfile(created as Profile)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    ensureProfile(user).finally(() => setLoading(false))
  }, [user, ensureProfile])

  return { profile, loading }
}
