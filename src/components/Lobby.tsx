import type { User } from '@supabase/supabase-js'
interface Props { user: User; onSignOut: () => void }
export function Lobby({ user, onSignOut }: Props) {
  return <div className="p-8 text-green-400 text-xs">Lobby — {user.email} <button onClick={onSignOut} className="ml-4 text-gray-500">Sign out</button></div>
}
