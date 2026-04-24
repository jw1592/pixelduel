import type { User } from '@supabase/supabase-js'
interface Props { user: User }
export function Matchmaking({ user: _ }: Props) {
  return <div className="p-8 text-yellow-400 text-xs">Matchmaking...</div>
}
