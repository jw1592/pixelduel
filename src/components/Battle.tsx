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
import { useAIOpponent } from '../hooks/useAIOpponent'
import { useLightsaberSound } from '../hooks/useLightsaberSound'
import type { GameMessage, BattleStatus } from '../types'

const MAX_HP = 100
const HIT_DAMAGE = 10
const BLOCK_DAMAGE = 3

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
  const routeState = (location.state as BattleRouteState | null)

  const { profile } = useProfile(user)
  const profileRef = useRef(profile)
  useEffect(() => { profileRef.current = profile }, [profile])
  const [myHp, setMyHp] = useState(MAX_HP)
  const [opponentHp, setOpponentHp] = useState(MAX_HP)
  const [battleStatus, setBattleStatus] = useState<BattleStatus>(isAI ? 'active' : 'connecting')
  const [myFlash, setMyFlash] = useState(false)
  const [opponentFlash, setOpponentFlash] = useState(false)

  const { videoRef, status: webcamStatus, start: startWebcam, stop: stopWebcam } = useWebcam()
  const { status: poseStatus, detectLoop } = usePoseLandmarker(videoRef)
  const { canvasRef, latestLandmarksRef } = useCharacterCanvas({
    videoRef,
    avatarUrl: profile?.avatar_url ?? null,
    detectLoop,
  })
  const { gesture, update: updateGestures } = useCombatGestures(latestLandmarksRef)

  const sendMessageRef = useRef<((msg: GameMessage) => void) | null>(null)
  const { startHum, stopHum, playSwing, playHit } = useLightsaberSound()
  const playHitRef = useRef(playHit)
  useEffect(() => { playHitRef.current = playHit }, [playHit])

  const aiCanvasRef = useRef<HTMLCanvasElement>(null)
  const { aiHp, aiName, receiveAttack } = useAIOpponent({
    enabled: isAI,
    profile,
    canvasRef: aiCanvasRef,
    onAIAttack: () => {
      playHitRef.current()
      const blocking = isBlocking(latestLandmarksRef.current)
      const damage = blocking ? BLOCK_DAMAGE : HIT_DAMAGE
      setMyHp(prev => Math.max(0, prev - damage))
      setMyFlash(true)
      setTimeout(() => setMyFlash(false), 200)
      navigator.vibrate?.(80)
    },
  })

  const opponentAfkRef = useRef(false)
  const [myAfkCountdown, setMyAfkCountdown] = useState<number | null>(null)
  const [opponentAfk, setOpponentAfk] = useState(false)
  const [opponentAfkCountdown, setOpponentAfkCountdown] = useState<number | null>(null)
  const afkAbsenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const afkCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const opponentAfkCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iSentAfkWarningRef = useRef(false)

  // handleMessage must remain stable — useWebRTC re-registers the data channel handler on identity change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMessage = useCallback((msg: GameMessage) => {
    if (msg.type === 'attack') {
      playHitRef.current()
      if (opponentAfkRef.current) return  // pause battle while opponent is AFK
      const isBlockingNow = isBlocking(latestLandmarksRef.current)
      const damage = isBlockingNow ? BLOCK_DAMAGE : HIT_DAMAGE
      setMyFlash(true)
      setTimeout(() => setMyFlash(false), 200)
      navigator.vibrate?.(80)
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
        void supabase.from('matches')
          .update({ status: 'finished', winner_id: user.id })
          .eq('id', matchId)
          .then(({ error }) => { if (error) console.error(error) })
      }
    } else if (msg.type === 'afk_warning') {
      opponentAfkRef.current = true
      setOpponentAfk(true)
      setOpponentAfkCountdown(10)
      opponentAfkCountdownIntervalRef.current = setInterval(() => {
        setOpponentAfkCountdown(c => {
          if (c === null || c <= 1) {
            clearInterval(opponentAfkCountdownIntervalRef.current!)
            opponentAfkCountdownIntervalRef.current = null
            return null
          }
          return c - 1
        })
      }, 1000)
    } else if (msg.type === 'afk_cancel') {
      opponentAfkRef.current = false
      setOpponentAfk(false)
      setOpponentAfkCountdown(null)
      if (opponentAfkCountdownIntervalRef.current) {
        clearInterval(opponentAfkCountdownIntervalRef.current)
        opponentAfkCountdownIntervalRef.current = null
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
    if (isAI || !!routeState) startWebcam()
    return () => stopWebcam()
  }, [isAI, startWebcam, stopWebcam])

  useEffect(() => {
    if (connected) {
      setBattleStatus('active')
      startHum()
    }
    return () => { if (!isAI) stopHum() }
  }, [connected, isAI, startHum, stopHum])

  useEffect(() => {
    if (!isAI) return
    startHum()
    return () => stopHum()
  }, [isAI, startHum, stopHum])

  useEffect(() => {
    if (myHp === 0 && battleStatus === 'active') {
      setBattleStatus('defeat')
    }
  }, [myHp, battleStatus])

  useEffect(() => {
    if (!isAI) return
    if (aiHp === 0 && battleStatus === 'active') {
      setBattleStatus('victory')
    }
  }, [isAI, aiHp, battleStatus])

  useEffect(() => {
    if (battleStatus === 'victory' || battleStatus === 'defeat') {
      if (!isAI && profileRef.current) {
        const p = profileRef.current
        if (battleStatus === 'victory') {
          void supabase.from('profiles').update({ wins: p.wins + 1 }).eq('id', user.id)
        } else {
          void supabase.from('profiles').update({ losses: p.losses + 1 }).eq('id', user.id)
        }
      }
      const t = setTimeout(() => navigate('/'), 3000)
      return () => clearTimeout(t)
    }
  }, [battleStatus, isAI, user.id, navigate])

  useEffect(() => {
    if (battleStatus !== 'active') return
    const id = setInterval(updateGestures, 50)
    return () => clearInterval(id)
  }, [battleStatus, updateGestures])

  const prevAttackingRef = useRef(false)
  useEffect(() => {
    if (gesture.isAttacking && !prevAttackingRef.current && battleStatus === 'active') {
      if (isAI) {
        receiveAttack()
      } else {
        sendMessage({ type: 'attack' })
      }
      playSwing()
      setOpponentFlash(true)
      setTimeout(() => setOpponentFlash(false), 150)
    }
    prevAttackingRef.current = gesture.isAttacking
  }, [gesture.isAttacking, sendMessage, battleStatus, playSwing, isAI, receiveAttack])

  const presenceGateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (webcamStatus !== 'granted' || isAI) return
    presenceGateRef.current = setTimeout(() => {
      if (latestLandmarksRef.current.length === 0) {
        navigate('/')
      }
    }, 10000)
    return () => {
      if (presenceGateRef.current) clearTimeout(presenceGateRef.current)
    }
  }, [webcamStatus, isAI, navigate, latestLandmarksRef])

  // No dep array — runs every render to catch first pose detection via ref (refs don't trigger re-renders)
  useEffect(() => {
    if (latestLandmarksRef.current.length > 0 && presenceGateRef.current) {
      clearTimeout(presenceGateRef.current)
      presenceGateRef.current = null
    }
  })

  useEffect(() => {
    return () => {
      if (opponentAfkCountdownIntervalRef.current) clearInterval(opponentAfkCountdownIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (battleStatus !== 'active' || isAI) return
    const check = setInterval(() => {
      const absent = latestLandmarksRef.current.length === 0
      if (absent && !iSentAfkWarningRef.current) {
        if (!afkAbsenceTimerRef.current) {
          afkAbsenceTimerRef.current = setTimeout(() => {
            iSentAfkWarningRef.current = true
            sendMessageRef.current?.({ type: 'afk_warning' })
            setMyAfkCountdown(10)
            afkCountdownIntervalRef.current = setInterval(() => {
              setMyAfkCountdown(c => {
                if (c === null || c <= 1) {
                  clearInterval(afkCountdownIntervalRef.current!)
                  sendMessageRef.current?.({ type: 'dead' })
                  setBattleStatus('defeat')
                  return null
                }
                return c - 1
              })
            }, 1000)
          }, 3000)
        }
      } else if (!absent && iSentAfkWarningRef.current) {
        iSentAfkWarningRef.current = false
        clearInterval(afkCountdownIntervalRef.current!)
        afkCountdownIntervalRef.current = null
        setMyAfkCountdown(null)
        sendMessageRef.current?.({ type: 'afk_cancel' })
      } else if (!absent) {
        if (afkAbsenceTimerRef.current) {
          clearTimeout(afkAbsenceTimerRef.current)
          afkAbsenceTimerRef.current = null
        }
      }
    }, 500)
    return () => {
      clearInterval(check)
      if (afkAbsenceTimerRef.current) clearTimeout(afkAbsenceTimerRef.current)
      if (afkCountdownIntervalRef.current) clearInterval(afkCountdownIntervalRef.current)
    }
  }, [battleStatus, isAI, latestLandmarksRef])  // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="overflow-hidden flex flex-col md:flex-row bg-black" style={{ height: '100dvh' }}>
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Left: Me */}
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
          {battleStatus === 'active' && myAfkCountdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
              <p className="text-red-400 text-xs text-center px-4">You are not detected on screen</p>
              <p className="text-white text-3xl">{myAfkCountdown}</p>
              <p className="text-gray-400 text-xs text-center px-4">
                Defeat in {myAfkCountdown}s
              </p>
            </div>
          )}
          {myFlash && (
            <div className="absolute inset-0 pointer-events-none bg-red-500/50 transition-opacity" />
          )}
          {battleStatus === 'active' && (
            <div className="absolute bottom-2 left-2">
              <span className={`text-xs px-2 py-1 rounded ${gesture.isBlocking ? 'bg-blue-900 text-blue-300' : gesture.isAttacking ? 'bg-red-900 text-red-300' : 'text-gray-700'}`}>
                {gesture.isAttacking ? 'ATTACK' : gesture.isBlocking ? 'BLOCK' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 py-2">
          <HpBar hp={myHp} label="YOU" />
        </div>
      </div>

      {/* Right: Opponent */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative bg-gray-900">
          {isAI ? (
            <>
              <canvas
                ref={aiCanvasRef}
                width={640}
                height={480}
                className="w-full h-full object-cover"
              />
              {opponentFlash && (
                <div className="absolute inset-0 pointer-events-none bg-orange-400/50 transition-opacity" />
              )}
              <div className="absolute top-2 left-0 right-0 flex justify-center">
                <span className="text-xs text-gray-500">{aiName.toUpperCase()}</span>
              </div>
            </>
          ) : (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {opponentFlash && (
                <div className="absolute inset-0 pointer-events-none bg-orange-400/50 transition-opacity" />
              )}
              {battleStatus === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-500 text-xs">Connecting...</p>
                </div>
              )}
              {opponentAfk && opponentAfkCountdown !== null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                  <p className="text-yellow-400 text-xs text-center px-4">Opponent is away</p>
                  <p className="text-white text-2xl">{opponentAfkCountdown}</p>
                  <p className="text-gray-400 text-xs text-center px-4">
                    Victory in {opponentAfkCountdown}s
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex-shrink-0 py-2">
          <HpBar hp={isAI ? aiHp : opponentHp} label={isAI ? aiName.toUpperCase() : 'OPPONENT'} flip />
        </div>
      </div>
    </div>
  )
}
