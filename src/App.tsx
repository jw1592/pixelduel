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
      <Route path="/" element={<Lobby user={user} onSignOut={signOut} onlineCount={onlineCount} />} />
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
