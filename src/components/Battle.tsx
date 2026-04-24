import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useWebcam } from '../hooks/useWebcam'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useCharacterCanvas } from '../hooks/useCharacterCanvas'
import { useCombatGestures, isBlocking } from '../hooks/useCombatGestures'
import { useWebRTC } from '../hooks/useWebRTC'
import type { GameMessage, BattleStatus } from '../types'

const MAX_HP = 100
const HIT_DAMAGE = 25
const BLOCK_DAMAGE = 5

interface Props {
  user: User
}

interface BattleRouteState {
  player1_id: string
  player2_id: string
}

function HpBar({ hp, label, flip }: { hp: number; label: string; flip?: boolean }) {
  const pct = Math.max(0, (hp / MAX_HP) * 100)
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444'
  return (
    <div className={`w-full px-4 flex flex-col gap-1 ${flip ? 'items-end' : 'items-start'}`}>
      <span className="text-gray-400 text-xs">{label} {hp}HP</span>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-150 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color, marginLeft: flip ? 'auto' : undefined }}
        />
      </div>
    </div>
  )
}

export function Battle({ user }: Props) {
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()
  const location = useLocation()
  const isAI = matchId === 'ai'
  const aiOpponent = (location.state as { opponent?: string } | null)?.opponent
  const routeState = (location.state as BattleRouteState | null)

  const { profile } = useProfile(user)
  const [myHp, setMyHp] = useState(MAX_HP)
  const [opponentHp, setOpponentHp] = useState(MAX_HP)
  const [battleStatus, setBattleStatus] = useState<BattleStatus>('connecting')

  const { videoRef, status: webcamStatus, start: startWebcam, stop: stopWebcam } = useWebcam()
  const { status: poseStatus, detectLoop } = usePoseLandmarker(videoRef)
  const { canvasRef, latestLandmarksRef } = useCharacterCanvas({
    videoRef,
    avatarUrl: profile?.avatar_url ?? null,
    detectLoop,
  })
  const { gesture, update: updateGestures } = useCombatGestures(latestLandmarksRef)

  const sendMessageRef = useRef<((msg: GameMessage) => void) | null>(null)

  // handleMessage must remain stable — useWebRTC re-registers the data channel handler on identity change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMessage = useCallback((msg: GameMessage) => {
    if (msg.type === 'attack') {
      const isBlockingNow = isBlocking(latestLandmarksRef.current)
      const damage = isBlockingNow ? BLOCK_DAMAGE : HIT_DAMAGE
      setMyHp(prev => {
        const next = Math.max(0, prev - damage)
        if (next > 0) {
          sendMessageRef.current?.({ type: 'hp', value: next })
        } else {
          sendMessageRef.current?.({ type: 'dead' })
        }
        return next
      })
    } else if (msg.type === 'hp') {
      setOpponentHp(msg.value)
    } else if (msg.type === 'dead') {
      setBattleStatus('victory')
      if (matchId) {
        supabase.from('matches')
          .update({ status: 'finished', winner_id: user.id })
          .eq('id', matchId)
          .catch(console.error)
      }
    }
  }, [user.id, matchId, latestLandmarksRef])

  const { connected, sendMessage, remoteVideoRef } = useWebRTC({
    enabled: !isAI && !!routeState,
    user,
    matchId: matchId ?? '',
    player1Id: routeState?.player1_id ?? '',
    player2Id: routeState?.player2_id ?? '',
    canvasRef,
    onMessage: handleMessage,
  })

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  useEffect(() => {
    if (!isAI) startWebcam()
    return () => stopWebcam()
  }, [isAI, startWebcam, stopWebcam])

  useEffect(() => {
    if (connected) setBattleStatus('active')
  }, [connected])

  useEffect(() => {
    if (myHp === 0 && battleStatus === 'active') {
      setBattleStatus('defeat')
    }
  }, [myHp, battleStatus])

  useEffect(() => {
    if (battleStatus === 'victory' || battleStatus === 'defeat') {
      const t = setTimeout(() => navigate('/'), 3000)
      return () => clearTimeout(t)
    }
  }, [battleStatus, navigate])

  useEffect(() => {
    if (battleStatus !== 'active') return
    const id = setInterval(updateGestures, 50)
    return () => clearInterval(id)
  }, [battleStatus, updateGestures])

  const prevAttackingRef = useRef(false)
  useEffect(() => {
    if (gesture.isAttacking && !prevAttackingRef.current && battleStatus === 'active') {
      sendMessage({ type: 'attack' })
    }
    prevAttackingRef.current = gesture.isAttacking
  }, [gesture.isAttacking, sendMessage, battleStatus])

  if (isAI) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
        <h1 className="text-green-400 text-2xl leading-loose text-center">PIXEL<br/>DUEL</h1>
        <div className="border border-gray-700 p-8 flex flex-col items-center gap-4 w-80 text-center">
          <p className="text-yellow-400 text-xs">AI MATCH</p>
          <p className="text-white text-sm mt-2">{aiOpponent}</p>
          <p className="text-gray-500 text-xs mt-4">AI battle coming in Phase 2C.</p>
        </div>
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer transition-colors">
          Back to Lobby
        </button>
      </div>
    )
  }

  if (battleStatus === 'victory' || battleStatus === 'defeat') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-green-400 text-2xl leading-loose text-center">PIXEL<br/>DUEL</h1>
        <p className={`text-4xl font-bold ${battleStatus === 'victory' ? 'text-yellow-400' : 'text-red-500'}`}>
          {battleStatus === 'victory' ? 'VICTORY' : 'DEFEAT'}
        </p>
        <p className="text-gray-500 text-xs">Returning to lobby...</p>
      </div>
    )
  }

  if (!isAI && !routeState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-500 text-xs">Match data missing. Please find a new match.</p>
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer">Back to Lobby</button>
      </div>
    )
  }

  if (webcamStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-500 text-xs">Camera access denied. Battle requires webcam.</p>
        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-400 text-xs border border-gray-700 px-6 py-3 cursor-pointer">Back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="flex-1 flex flex-col">
        <div className="pt-2">
          <HpBar hp={opponentHp} label="OPPONENT" flip />
        </div>
        <div className="flex-1 relative bg-gray-900">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {battleStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-xs">Connecting...</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative bg-gray-950">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover"
          />
          {poseStatus === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-600 text-xs">Loading pose model...</p>
            </div>
          )}
          {battleStatus === 'active' && (
            <div className="absolute bottom-2 left-2">
              <span className={`text-xs px-2 py-1 rounded ${gesture.isBlocking ? 'bg-blue-900 text-blue-300' : gesture.isAttacking ? 'bg-red-900 text-red-300' : 'text-gray-700'}`}>
                {gesture.isAttacking ? 'ATTACK' : gesture.isBlocking ? 'BLOCK' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="pb-2">
          <HpBar hp={myHp} label="YOU" />
        </div>
      </div>
    </div>
  )
}
