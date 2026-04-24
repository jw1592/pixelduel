# PixelDuel Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lobby foundation — Google login, real-time online player count, user profile/stats display, and matchmaking queue entry screen.

**Architecture:** Single-page React app with Supabase for auth + real-time presence. Route structure: `/` (login or lobby depending on auth state) → `/matchmaking` (queue waiting screen). Game state lives in Supabase Realtime channels; no custom backend needed for Phase 1.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Tailwind CSS v4, Supabase JS v2, React Router v7

---

## Prerequisites (Manual — AJ must do these before running tasks)

1. Create a Supabase project at https://supabase.com → note `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. In Supabase dashboard → SQL Editor, run this schema:

```sql
-- User profiles (auto-created on first login)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public read" on public.profiles for select using (true);
create policy "Own write" on public.profiles for all using (auth.uid() = id);

-- Active players presence (for real-time count)
create table public.active_players (
  user_id uuid references auth.users on delete cascade primary key,
  status text not null default 'lobby',
  updated_at timestamptz default now()
);
alter table public.active_players enable row level security;
create policy "Public read" on public.active_players for select using (true);
create policy "Own write" on public.active_players for all using (auth.uid() = user_id);
```

3. In Supabase dashboard → Authentication → Providers → Enable Google OAuth
   - Add Google Client ID + Secret (from Google Cloud Console)
   - Set redirect URL: `http://localhost:5173` (dev) + your Vercel URL (prod)

4. Create `/Users/aj/projects/pixelduel/.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## File Structure

```
src/
├── lib/
│   └── supabase.ts          # Supabase client singleton + DB type helper
├── types/
│   └── index.ts             # All shared TypeScript types
├── hooks/
│   ├── useAuth.ts           # Auth state (user, loading, signIn, signOut)
│   ├── useProfile.ts        # Fetch/create profile + stats
│   └── useOnlineCount.ts    # Real-time online player count via Supabase Realtime
├── components/
│   ├── LoginScreen.tsx      # Pre-login landing page
│   ├── Lobby.tsx            # Post-login main screen (stats + find opponent)
│   └── Matchmaking.tsx      # Queue waiting screen
├── App.tsx                  # Auth gate + React Router
├── main.tsx                 # Entry point (keep minimal)
└── index.css                # Tailwind v4 import + pixel font
```

---

## Task 1: Project Configuration

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Create: `.env.example`
- Delete: `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`

- [ ] **Step 1: Configure Tailwind v4 in vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 2: Replace src/index.css with Tailwind v4 + pixel font**

```css
@import "tailwindcss";

@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

:root {
  --font-pixel: 'Press Start 2P', monospace;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0a0a0f;
  color: #e0e0e0;
  font-family: var(--font-pixel), monospace;
  min-height: 100vh;
}
```

- [ ] **Step 3: Replace src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Update index.html title**

Change `<title>` to `<title>PixelDuel</title>`. Remove Vite default favicon links, keep `<link rel="icon" href="/favicon.svg" />`.

- [ ] **Step 5: Create .env.example**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 6: Delete boilerplate files**

```bash
rm src/App.css src/assets/react.svg src/assets/vite.svg 2>/dev/null || true
```

- [ ] **Step 7: Verify Tailwind works**

Replace `src/App.tsx` temporarily:
```tsx
export default function App() {
  return <div className="min-h-screen flex items-center justify-center text-green-400 text-xl">PixelDuel ⚔️</div>
}
```

Run `npm run dev` → verify green text on dark background at localhost:5173.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: configure Tailwind v4, pixel font, clean boilerplate"
```

---

## Task 2: Types + Supabase Client

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create src/types/index.ts**

```ts
export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
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
```

- [ ] **Step 2: Create src/lib/supabase.ts**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add types and Supabase client"
```

---

## Task 3: Auth Hook + Login Screen

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/components/LoginScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create src/hooks/useAuth.ts**

```ts
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { user, loading, signInWithGoogle, signOut }
}
```

- [ ] **Step 2: Create src/components/LoginScreen.tsx**

```tsx
interface Props {
  onLogin: () => void
  onlineCount: number
}

export function LoginScreen({ onLogin, onlineCount }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-green-400 text-2xl mb-2 leading-loose">PIXEL<br/>DUEL</h1>
        <p className="text-gray-500 text-xs">Minecraft-style webcam battle</p>
      </div>

      <div className="text-yellow-400 text-xs">
        ⚔ {onlineCount} battling now
      </div>

      <button
        onClick={onLogin}
        className="flex items-center gap-3 bg-white text-gray-900 px-6 py-3 text-xs hover:bg-gray-100 transition-colors cursor-pointer border-2 border-white"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>

      <p className="text-gray-600 text-xs text-center max-w-xs leading-relaxed">
        Desktop Chrome recommended.<br/>Webcam required.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './components/LoginScreen'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'

function AuthGate() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={signInWithGoogle} onlineCount={0} />
  }

  return (
    <Routes>
      <Route path="/" element={<Lobby user={user} onSignOut={signOut} />} />
      <Route path="/matchmaking" element={<Matchmaking user={user} />} />
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

- [ ] **Step 4: Create stub components so App.tsx compiles**

Create `src/components/Lobby.tsx`:
```tsx
import type { User } from '@supabase/supabase-js'
interface Props { user: User; onSignOut: () => void }
export function Lobby({ user, onSignOut }: Props) {
  return <div className="p-8 text-green-400 text-xs">Lobby — {user.email} <button onClick={onSignOut} className="ml-4 text-gray-500">Sign out</button></div>
}
```

Create `src/components/Matchmaking.tsx`:
```tsx
import type { User } from '@supabase/supabase-js'
interface Props { user: User }
export function Matchmaking({ user: _ }: Props) {
  return <div className="p-8 text-yellow-400 text-xs">Matchmaking...</div>
}
```

- [ ] **Step 5: Install react-router-dom if not yet installed**

Check `package.json` — if `react-router-dom` is missing:
```bash
npm install react-router-dom
```

- [ ] **Step 6: Run and verify**

```bash
npm run dev
```

Open localhost:5173. Verify:
- Dark background with "PIXEL DUEL" title
- "Sign in with Google" button visible
- Clicking button redirects to Google OAuth
- After login, shows "Lobby — [email]" with sign out button

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Google auth + login screen + routing scaffold"
```

---

## Task 4: User Profile Hook (auto-create on first login)

**Files:**
- Create: `src/hooks/useProfile.ts`

- [ ] **Step 1: Create src/hooks/useProfile.ts**

```ts
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfile.ts && git commit -m "feat: useProfile hook with auto-create on first login"
```

---

## Task 5: Real-time Online Player Count

**Files:**
- Create: `src/hooks/useOnlineCount.ts`

- [ ] **Step 1: Create src/hooks/useOnlineCount.ts**

Uses Supabase Realtime Presence to track connected users without polling.

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useOnlineCount.ts && git commit -m "feat: useOnlineCount via Supabase Realtime Presence"
```

---

## Task 6: Lobby Screen

**Files:**
- Modify: `src/components/Lobby.tsx` (replace stub)
- Modify: `src/components/LoginScreen.tsx` (wire real online count)
- Modify: `src/App.tsx` (pass online count to LoginScreen)

- [ ] **Step 1: Replace src/components/Lobby.tsx**

```tsx
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useProfile } from '../hooks/useProfile'
import { useOnlineCount } from '../hooks/useOnlineCount'

interface Props {
  user: User
  onSignOut: () => void
}

export function Lobby({ user, onSignOut }: Props) {
  const navigate = useNavigate()
  const { profile, loading } = useProfile(user)
  const onlineCount = useOnlineCount(user)

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  const total = profile.wins + profile.losses + profile.draws
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      {/* Title */}
      <h1 className="text-green-400 text-2xl leading-loose text-center">
        PIXEL<br/>DUEL
      </h1>

      {/* Online count */}
      <div className="text-yellow-400 text-xs">
        ⚔ {onlineCount} battling now
      </div>

      {/* Player card */}
      <div className="border border-gray-700 p-6 flex flex-col items-center gap-4 w-72">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-12 h-12 rounded-full border-2 border-green-500"
          />
        )}
        <p className="text-green-400 text-xs">{profile.display_name}</p>

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
      </div>

      {/* Find opponent */}
      <button
        onClick={() => navigate('/matchmaking')}
        className="bg-green-500 hover:bg-green-400 text-black text-xs px-8 py-4 transition-colors cursor-pointer font-bold"
      >
        ⚔ FIND OPPONENT
      </button>

      {/* Sign out */}
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

- [ ] **Step 2: Wire online count to LoginScreen in App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useOnlineCount } from './hooks/useOnlineCount'
import { LoginScreen } from './components/LoginScreen'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'

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
      <Route path="/" element={<Lobby user={user} onSignOut={signOut} />} />
      <Route path="/matchmaking" element={<Matchmaking user={user} />} />
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

- [ ] **Step 3: Run and verify**

```bash
npm run dev
```

Verify:
- Login screen shows real-time online count (1 after login)
- After login: player card shows display name, Google avatar, 0W 0L 0D
- "FIND OPPONENT" button navigates to /matchmaking
- "Sign out" returns to login screen

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: lobby screen with profile, stats, and real-time online count"
```

---

## Task 7: Matchmaking Screen

**Files:**
- Modify: `src/components/Matchmaking.tsx` (replace stub)

Uses Supabase to enter/leave a matchmaking queue. Phase 1 only shows the waiting UI — actual match pairing happens in Phase 2.

- [ ] **Step 1: Replace src/components/Matchmaking.tsx**

```tsx
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
```

- [ ] **Step 2: Run and verify**

```bash
npm run dev
```

Verify:
- "FIND OPPONENT" from lobby navigates to /matchmaking
- Spinner animates, timer counts up
- Cancel button returns to lobby
- Check Supabase `active_players` table → row appears with status `searching` when on this screen, status `lobby` after cancel

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, successful build.

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "feat: matchmaking queue screen with enter/leave queue" && git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Google login ← Task 3
- [x] Real-time online count ← Task 5, 6
- [x] User profile + stats (wins/losses) ← Task 4, 6
- [x] "Find Opponent" entry ← Task 6
- [x] Matchmaking queue screen ← Task 7
- [x] English UI ← All components
- [x] Dark Minecraft aesthetic ← Task 1 (pixel font, dark bg)

**Out of scope for Phase 1 (Phase 2+):**
- WebRTC video connection
- Actual match pairing logic
- Battle screen
- MediaPipe body rendering
