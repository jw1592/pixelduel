# PixelDuel Phase 2A — Profile + Real Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add profile editing (name, avatar, country flag), and replace the AI fallback with real 1v1 player matching via Supabase Realtime Presence.

**Architecture:** Profile edits save to `profiles` table; country flag is fetched from `ipapi.co` on mount and stored with the profile. Real matchmaking uses Supabase Realtime Presence — both players join a shared channel, the one with the smaller UUID creates a `matches` row and broadcasts `match_ready` to both; a unique constraint handles simultaneous inserts cleanly.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Tailwind CSS v4, Supabase JS v2, React Router v7, ipapi.co (free, no key)

---

## Prerequisites (Manual — AJ must do before running tasks)

In Supabase SQL Editor (`https://supabase.com/dashboard/project/gttijatyjbjqhxueihnj/sql/new`), run:

```sql
-- Add country_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;

-- Matches table (canonical_order ensures player1_id < player2_id, preventing race duplicates)
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid REFERENCES auth.users NOT NULL,
  player2_id uuid REFERENCES auth.users NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_match CHECK (player1_id != player2_id),
  CONSTRAINT canonical_order CHECK (player1_id < player2_id),
  UNIQUE(player1_id, player2_id)
);
ALTER TABLE public.matches ENABLE row level security;
CREATE POLICY "Players can read own matches" ON public.matches
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Players can insert as player1" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = player1_id);
```

---

## File Structure

```
src/
├── data/
│   └── avatars.ts              NEW — 12 Minecraft character definitions
├── hooks/
│   ├── useCountryFlag.ts       NEW — fetch country_code + flag emoji from ipapi.co
│   └── useMatchQueue.ts        NEW — Realtime Presence matchmaking, pair players
├── components/
│   └── ProfileEdit.tsx         NEW — /profile page: name, avatar (webcam + 12 defaults)
├── hooks/useProfile.ts         MODIFY — save country_code on first profile creation
├── types/index.ts              MODIFY — add country_code to Profile, add Match type
├── components/Lobby.tsx        MODIFY — show flag, add "Edit Profile" link
├── components/Matchmaking.tsx  MODIFY — replace AI fallback with useMatchQueue
├── components/Battle.tsx       MODIFY — accept matchId from route, show opponent name
└── App.tsx                     MODIFY — add /profile route
public/
└── avatars/                    NEW — 12 PNG files copied from minecraft-face-filter
    steve.png, creeper1.png, creeper2.png, enderman.png, spider.png,
    pig.png, cow.png, sheep.png, sheep-dyed.png, zombie.png, skeleton.png,
    villager.png
```

---

## Task 1: Copy Avatar Assets + Create avatars.ts

**Files:**
- Create: `public/avatars/` (12 PNGs copied from minecraft-face-filter)
- Create: `src/data/avatars.ts`

- [ ] **Step 1: Copy PNG files**

```bash
mkdir -p /Users/aj/projects/pixelduel/public/avatars
cp /Users/aj/projects/minecraft-face-filter/public/faces/*.png /Users/aj/projects/pixelduel/public/avatars/
ls /Users/aj/projects/pixelduel/public/avatars/
```

Expected: 12 files: cow.png creeper1.png creeper2.png enderman.png pig.png sheep-dyed.png sheep.png skeleton.png spider.png steve.png villager.png zombie.png

- [ ] **Step 2: Create src/data/avatars.ts**

```ts
export interface Avatar {
  id: string
  name: string
  path: string
}

export const AVATARS: Avatar[] = [
  { id: 'steve',      name: 'Steve',        path: '/avatars/steve.png' },
  { id: 'creeper1',   name: 'Creeper',      path: '/avatars/creeper1.png' },
  { id: 'creeper2',   name: 'Creeper Dark', path: '/avatars/creeper2.png' },
  { id: 'enderman',   name: 'Enderman',     path: '/avatars/enderman.png' },
  { id: 'spider',     name: 'Spider',       path: '/avatars/spider.png' },
  { id: 'pig',        name: 'Pig',          path: '/avatars/pig.png' },
  { id: 'cow',        name: 'Cow',          path: '/avatars/cow.png' },
  { id: 'sheep',      name: 'Sheep',        path: '/avatars/sheep.png' },
  { id: 'sheep-dyed', name: 'Blue Sheep',   path: '/avatars/sheep-dyed.png' },
  { id: 'zombie',     name: 'Zombie',       path: '/avatars/zombie.png' },
  { id: 'skeleton',   name: 'Skeleton',     path: '/avatars/skeleton.png' },
  { id: 'villager',   name: 'Villager',     path: '/avatars/villager.png' },
]
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/aj/projects/pixelduel && git add public/avatars/ src/data/avatars.ts && git commit -m "feat: add Minecraft avatar assets and data"
```

---

## Task 2: Types Update + useCountryFlag Hook

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/hooks/useCountryFlag.ts`

- [ ] **Step 1: Update src/types/index.ts**

```ts
export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  country_code: string | null
  wins: number
  losses: number
  draws: number
  created_at: string
}

export interface ActivePlayer {
  user_id: string
  status: 'lobby' | 'searching' | 'in_game'
  updated_at: string
}

export type AuthUser = {
  id: string
  email: string | null
  user_metadata: {
    full_name?: string
    avatar_url?: string
  }
}

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  status: 'active' | 'finished'
  created_at: string
}
```

- [ ] **Step 2: Create src/hooks/useCountryFlag.ts**

```ts
import { useEffect, useState } from 'react'

function toFlagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

export function useCountryFlag() {
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [flag, setFlag] = useState<string>('')

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const code = data.country_code as string
        setCountryCode(code)
        setFlag(toFlagEmoji(code))
      })
      .catch(() => {
        // Silently fail — flag stays empty
      })
  }, [])

  return { countryCode, flag }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/aj/projects/pixelduel && git add src/types/index.ts src/hooks/useCountryFlag.ts && git commit -m "feat: add country_code to Profile type and useCountryFlag hook"
```

---

## Task 3: Update useProfile to Save country_code on Creation

**Files:**
- Modify: `src/hooks/useProfile.ts`

- [ ] **Step 1: Rewrite src/hooks/useProfile.ts**

```ts
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/aj/projects/pixelduel && git add src/hooks/useProfile.ts && git commit -m "feat: save country_code on profile creation, expose refreshProfile"
```

---

## Task 4: Profile Edit Page

**Files:**
- Create: `src/components/ProfileEdit.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Lobby.tsx`

- [ ] **Step 1: Create src/components/ProfileEdit.tsx**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useCountryFlag } from '../hooks/useCountryFlag'
import { AVATARS } from '../data/avatars'

interface Props {
  user: User
}

export function ProfileEdit({ user }: Props) {
  const navigate = useNavigate()
  const { profile, loading, refreshProfile } = useProfile(user)
  const { flag } = useCountryFlag()

  const [name, setName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)

  // Populate form from loaded profile
  useEffect(() => {
    if (profile) {
      setName(profile.display_name)
      setSelectedAvatar(profile.avatar_url)
    }
  }, [profile])

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [stream])

  const startWebcam = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true })
    setStream(s)
    setWebcamActive(true)
    setTimeout(() => {
      if (videoRef.current) videoRef.current.srcObject = s
    }, 50)
  }, [])

  const stopWebcam = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setWebcamActive(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    canvas.getContext('2d')!.drawImage(video, sx, sy, size, size, 0, 0, 128, 128)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    setCapturedPhoto(dataUrl)
    setSelectedAvatar(dataUrl)
    stopWebcam()
  }, [stopWebcam])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        avatar_url: selectedAvatar,
      })
      .eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    navigate('/')
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-6 px-4 py-8">
      <h1 className="text-green-400 text-xl leading-loose text-center">
        EDIT PROFILE
      </h1>

      {/* Name */}
      <div className="w-72 flex flex-col gap-2">
        <label className="text-gray-500 text-xs">DISPLAY NAME {flag}</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          className="bg-gray-900 border border-gray-700 text-white text-xs px-3 py-2 outline-none focus:border-green-500 w-full"
        />
      </div>

      {/* Current avatar preview */}
      <div className="flex flex-col items-center gap-2">
        <label className="text-gray-500 text-xs">AVATAR</label>
        {selectedAvatar && (
          <img
            src={selectedAvatar}
            alt="selected avatar"
            className="w-16 h-16 border-2 border-green-500 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>

      {/* Webcam capture */}
      <div className="w-72 flex flex-col gap-3">
        <p className="text-gray-500 text-xs">TAKE PHOTO</p>
        {!webcamActive ? (
          <button
            onClick={startWebcam}
            className="border border-gray-700 text-gray-400 hover:text-white text-xs px-4 py-2 cursor-pointer transition-colors"
          >
            Start Camera
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-48 h-36 object-cover border border-gray-700"
            />
            <div className="flex gap-3">
              <button
                onClick={capturePhoto}
                className="bg-green-500 hover:bg-green-400 text-black text-xs px-4 py-2 cursor-pointer"
              >
                Capture
              </button>
              <button
                onClick={stopWebcam}
                className="border border-gray-700 text-gray-500 hover:text-white text-xs px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {capturedPhoto && (
          <p className="text-green-400 text-xs text-center">Photo captured</p>
        )}
      </div>

      {/* Character grid */}
      <div className="w-72 flex flex-col gap-3">
        <p className="text-gray-500 text-xs">OR CHOOSE CHARACTER</p>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map(av => (
            <button
              key={av.id}
              onClick={() => { setSelectedAvatar(av.path); setCapturedPhoto(null) }}
              className={`border-2 p-1 cursor-pointer transition-colors ${
                selectedAvatar === av.path
                  ? 'border-green-500'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <img
                src={av.path}
                alt={av.name}
                className="w-full aspect-square object-cover"
                style={{ imageRendering: 'pixelated' }}
                title={av.name}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black text-xs px-8 py-3 cursor-pointer transition-colors font-bold"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      <button
        onClick={() => navigate('/')}
        className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add /profile route to src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useOnlineCount } from './hooks/useOnlineCount'
import { LoginScreen } from './components/LoginScreen'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'
import { Battle } from './components/Battle'
import { ProfileEdit } from './components/ProfileEdit'

function AuthGate() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const onlineCount = useOnlineCount(user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={signInWithGoogle} onlineCount={onlineCount} />
  }

  return (
    <Routes>
      <Route path="/" element={<Lobby user={user} onSignOut={signOut} onlineCount={onlineCount} />} />
      <Route path="/profile" element={<ProfileEdit user={user} />} />
      <Route path="/matchmaking" element={<Matchmaking user={user} />} />
      <Route path="/battle/:matchId" element={<Battle user={user} />} />
      <Route path="/battle" element={<Battle user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Update src/components/Lobby.tsx to show flag + profile edit link**

```tsx
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useProfile } from '../hooks/useProfile'
import { useCountryFlag } from '../hooks/useCountryFlag'

interface Props {
  user: User
  onSignOut: () => void
  onlineCount: number
}

export function Lobby({ user, onSignOut, onlineCount }: Props) {
  const navigate = useNavigate()
  const { profile, loading } = useProfile(user)
  const { flag } = useCountryFlag()

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  const total = profile.wins + profile.losses + profile.draws
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0
  const displayFlag = profile.country_code
    ? [...profile.country_code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
    : flag

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-green-400 text-2xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      <div className="text-yellow-400 text-xs">
        ⚔ {onlineCount} battling now
      </div>

      <div className="border border-gray-700 p-6 flex flex-col items-center gap-4 w-72">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-12 h-12 border-2 border-green-500 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
        <p className="text-green-400 text-xs">
          {displayFlag && <span className="mr-2">{displayFlag}</span>}
          {profile.display_name}
        </p>

        <div className="flex gap-6 text-xs text-center">
          <div>
            <p className="text-gray-500">PLAYED</p>
            <p className="text-white mt-1">{total}</p>
          </div>
          <div>
            <p className="text-green-500">WIN</p>
            <p className="text-white mt-1">{profile.wins}</p>
          </div>
          <div>
            <p className="text-red-500">LOSE</p>
            <p className="text-white mt-1">{profile.losses}</p>
          </div>
          <div>
            <p className="text-gray-500">DRAW</p>
            <p className="text-white mt-1">{profile.draws}</p>
          </div>
        </div>

        {total > 0 && (
          <p className="text-xs text-gray-500">Win rate {winRate}%</p>
        )}

        <button
          onClick={() => navigate('/profile')}
          className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer underline"
        >
          Edit Profile
        </button>
      </div>

      <button
        onClick={() => navigate('/matchmaking')}
        className="bg-green-500 hover:bg-green-400 text-black text-xs px-8 py-4 transition-colors cursor-pointer font-bold"
      >
        ⚔ FIND OPPONENT
      </button>

      <button
        onClick={onSignOut}
        className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
      >
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/aj/projects/pixelduel && git add -A && git commit -m "feat: profile edit page with name, avatar picker, webcam capture, country flag"
```

---

## Task 5: Real Matchmaking Hook

**Files:**
- Create: `src/hooks/useMatchQueue.ts`

- [ ] **Step 1: Create src/hooks/useMatchQueue.ts**

Uses Supabase Realtime Presence to find an opponent. The player with the smaller UUID creates the `matches` row and broadcasts `match_ready` to both. The unique constraint in the DB handles the race condition where both sides try to create a match simultaneously.

```ts
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
          navigate(`/battle/${match_id}`)
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/aj/projects/pixelduel && git add src/hooks/useMatchQueue.ts && git commit -m "feat: useMatchQueue — real 1v1 pairing via Supabase Realtime Presence"
```

---

## Task 6: Wire Real Matchmaking + Update Battle Screen

**Files:**
- Modify: `src/components/Matchmaking.tsx`
- Modify: `src/components/Battle.tsx`

- [ ] **Step 1: Rewrite src/components/Matchmaking.tsx**

Real matchmaking runs in parallel with the 30-second AI fallback. If a real opponent is found first, `useMatchQueue` navigates away automatically. After 30 seconds with no real opponent, AI fallback kicks in.

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useMatchQueue } from '../hooks/useMatchQueue'
import { AI_CHARACTERS } from './Battle'

const AI_FALLBACK_SECONDS = 30

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
        <p className="text-yellow-400 text-xs">Opponent found!</p>
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
```

- [ ] **Step 2: Rewrite src/components/Battle.tsx**

```tsx
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
}

const AI_CHARACTERS = ['Creeper', 'Skeleton', 'Zombie', 'Enderman', 'Spider', 'Pig', 'Villager']

export { AI_CHARACTERS }

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
```

- [ ] **Step 3: Verify TypeScript + build**

```bash
cd /Users/aj/projects/pixelduel && npx tsc --noEmit && npm run build
```

Expected: zero TypeScript errors, successful Vite build.

- [ ] **Step 4: Final commit + push**

```bash
cd /Users/aj/projects/pixelduel && git add -A && git commit -m "feat: real 1v1 matchmaking with 30s AI fallback, battle screen shows match id" && git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Profile edit page ← Task 4
- [x] Name editing ← Task 4 (ProfileEdit name input + save)
- [x] 12 Minecraft default avatars ← Task 1 (assets) + Task 4 (grid picker)
- [x] Webcam photo capture ← Task 4 (ProfileEdit webcam section)
- [x] Country flag via IP ← Task 2 (useCountryFlag) + Task 3 (saved on creation) + Task 4 (display in Lobby)
- [x] Real 1v1 matchmaking ← Task 5 (useMatchQueue) + Task 6 (wired into Matchmaking)
- [x] AI fallback (30s) ← Task 6
- [x] Match navigates to /battle/:matchId ← Task 5 + Task 6

**Out of scope (Phase 2B):**
- WebRTC video connection
- Minecraft face/body overlay on video
- HP gauge and combat mechanics
