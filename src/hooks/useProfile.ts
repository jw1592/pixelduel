import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

async function fetchCountryCode(): Promise<string | null> {
  try {
    const r = await fetch('https://ipapi.co/json/')
    const d = await r.json()
    return d.country_code ?? null
  } catch {
    return null
  }
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = useCallback(async (u: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .single()

    if (!error && data) {
      setProfile(data as Profile)
      return
    }

    const displayName =
      u.user_metadata?.full_name ??
      u.email?.split('@')[0] ??
      'Player'

    const countryCode = await fetchCountryCode()

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: u.id,
        display_name: displayName,
        avatar_url: u.user_metadata?.avatar_url ?? null,
        country_code: countryCode,
      })
      .select()
      .single()

    if (!createError && created) {
      setProfile(created as Profile)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data as Profile)
  }, [user])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    ensureProfile(user).finally(() => setLoading(false))
  }, [user, ensureProfile])

  return { profile, loading, refreshProfile }
}
