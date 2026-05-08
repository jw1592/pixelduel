import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useWebcam } from '../hooks/useWebcam'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useCharacterCanvas } from '../hooks/useCharacterCanvas'
import { useCombatGestures, getBlockZone } from '../hooks/useCombatGestures'
import { useWebRTC } from '../hooks/useWebRTC'
import { useAIOpponent } from '../hooks/useAIOpponent'
import { useLightsaberSound } from '../hooks/useLightsaberSound'
import type { GameMessage, BattleStatus } from '../types'
import tutorialSrc from '../assets/tutorial.svg'

const VICTORY_LOTTIE = 'https://assets-v2.lottiefiles.com/a/79e175d2-1174-11ee-9fca-272a6738b821/JYhWAkgfAS.lottie'
const DEFEAT_LOTTIE  = 'https://assets-v2.lottiefiles.com/a/ce9f26b0-1164-11ee-9b7e-239ff0ec29ac/b2Ypt20XAK.lottie'

const MAX_HP = 100
const HIT_DAMAGE = 10

interface Props {
  user: User
}

interface BattleRouteState {
  player1_id: string
  player2_id: string
}

interface PlayerInfo {
  name: string
  avatarUrl?: string | null
  countryCode?: string | null
}

function toFlag(code: string): string {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

function HpBar({ hp, label, flip, playerInfo }: { hp: number; label: string; flip?: boolean; playerInfo?: PlayerInfo }) {
  const pct = Math.max(0, (hp / MAX_HP) * 100)
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#eab308' : '#ef4444'
  const flag = playerInfo?.countryCode ? toFlag(playerInfo.countryCode) : null
  const displayName = playerInfo?.name ?? label
  return (
    <div className={`w-full px-2 flex flex-col gap-1 ${flip ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-1.5 max-w-full ${flip ? 'flex-row-reverse' : ''}`}>
        {playerInfo?.avatarUrl ? (
          <img src={playerInfo.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
        ) : null}
        <span className="text-gray-300 text-xs truncate">
          {flag && <span className="mr-0.5">{flag}</span>}
          {displayName}
        </span>
        <span className="text-gray-500 text-xs flex-shrink-0">{hp}HP</span>
      </div>
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
  const [opponentProfile, setOpponentProfile] = useState<import('../types').Profile | null>(null)
  const [myHp, setMyHp] = useState(MAX_HP)
  const [opponentHp, setOpponentHp] = useState(MAX_HP)
  const [battleStatus, setBattleStatus] = useState<BattleStatus>(isAI ? 'active' : 'connecting')
  const [countdownValue, setCountdownValue] = useState<number | string | null>(null)
  const [endReason, setEndReason] = useState<'ko' | 'timeout'>('ko')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const myHpRef = useRef(MAX_HP)
  const opponentHpRef = useRef(MAX_HP)
  const [myFlash, setMyFlash] = useState(false)
  const [opponentFlash, setOpponentFlash] = useState(false)
  const [combatFeedback, setCombatFeedback] = useState<{ text: string; color: string; id: number; side: 'left' | 'right' } | null>(null)

  const showFeedback = useCallback((text: string, color: string, side: 'left' | 'right') => {
    setCombatFeedback({ text, color, id: Date.now(), side })
    setTimeout(() => setCombatFeedback(null), 500)
  }, [])

  const blockingRef = useRef(false)
  const battleStatusRef = useRef(battleStatus)

  const { videoRef, status: webcamStatus, start: startWebcam, stop: stopWebcam } = useWebcam()
  const { status: poseStatus, detectLoop } = usePoseLandmarker(videoRef)
  const isPlayer1 = !isAI && user.id === routeState?.player1_id
  const { canvasRef, avatarCanvasRef, latestLandmarksRef } = useCharacterCanvas({
    videoRef,
    avatarUrl: profile?.avatar_url ?? null,
    detectLoop,
    firstPerson: true,
    blockingRef,
    isPlayer1,
  })
  const { gesture, update: updateGestures } = useCombatGestures(latestLandmarksRef)

  useEffect(() => { blockingRef.current = gesture.isBlocking }, [gesture.isBlocking])
  useEffect(() => { battleStatusRef.current = battleStatus }, [battleStatus])
  useEffect(() => { myHpRef.current = myHp }, [myHp])

  const sendMessageRef = useRef<((msg: GameMessage) => void) | null>(null)
  const { startHum, stopHum, playSwing, playHit } = useLightsaberSound()
  const playHitRef = useRef(playHit)
  useEffect(() => { playHitRef.current = playHit }, [playHit])

  const aiCanvasRef = useRef<HTMLCanvasElement>(null)
  const { aiHp, aiName, receiveAttack } = useAIOpponent({
    enabled: isAI,
    profile,
    canvasRef: aiCanvasRef,
    onAIAttack: (zone) => {
      const playerBlock = getBlockZone(latestLandmarksRef.current)
      if (playerBlock === zone) {
        showFeedback('GUARD SUCCESS', '#60a5fa', 'left')
      } else {
        playHitRef.current()
        setMyHp(prev => Math.max(0, prev - HIT_DAMAGE))
        setMyFlash(true)
        setTimeout(() => setMyFlash(false), 200)
        navigator.vibrate?.(80)
      }
    },
  })

  useEffect(() => { opponentHpRef.current = isAI ? aiHp : opponentHp }, [isAI, aiHp, opponentHp])

  useEffect(() => {
    if (isAI || !routeState) return
    const opponentId = user.id === routeState.player1_id ? routeState.player2_id : routeState.player1_id
    supabase.from('profiles').select('*').eq('id', opponentId).single()
      .then(({ data }) => { if (data) setOpponentProfile(data as import('../types').Profile) })
  }, [isAI, routeState, user.id])

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
      if (opponentAfkRef.current) return
      const playerBlock = getBlockZone(latestLandmarksRef.current)
      if (playerBlock === msg.zone) {
        showFeedback('GUARD SUCCESS', '#60a5fa', 'left')
        sendMessageRef.current?.({ type: 'blocked' })
      } else {
        playHitRef.current()
        setMyFlash(true)
        setTimeout(() => setMyFlash(false), 200)
        navigator.vibrate?.(80)
        setMyHp(prev => {
          const next = Math.max(0, prev - HIT_DAMAGE)
          if (next > 0) {
            sendMessageRef.current?.({ type: 'hp', value: next })
          } else {
            sendMessageRef.current?.({ type: 'dead' })
          }
          return next
        })
      }
    } else if (msg.type === 'hp') {
      setOpponentHp(msg.value)
      showFeedback('ATTACK SUCCESS', '#f97316', 'right')
    } else if (msg.type === 'blocked') {
      // opponent blocked — no feedback needed
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

  const handleDisconnect = useCallback(() => {
    if (battleStatusRef.current !== 'active') return
    setBattleStatus('victory')
    if (matchId) {
      void supabase.from('matches')
        .update({ status: 'finished', winner_id: user.id })
        .eq('id', matchId)
        .then(({ error }) => { if (error) console.error(error) })
    }
  }, [matchId, user.id])

  const { connected, sendMessage, remoteVideoRef } = useWebRTC({
    enabled: !isAI && !!routeState,
    user,
    matchId: matchId ?? '',
    player1Id: routeState?.player1_id ?? '',
    player2Id: routeState?.player2_id ?? '',
    avatarCanvasRef,
    onMessage: handleMessage,
    onDisconnect: handleDisconnect,
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
      setBattleStatus('countdown')
      startHum()
    }
    return () => { if (!isAI) stopHum() }
  }, [connected, isAI, startHum, stopHum])

  useEffect(() => {
    if (battleStatus !== 'countdown') return
    const timers: ReturnType<typeof setTimeout>[] = []
    setCountdownValue(3)
    timers.push(setTimeout(() => setCountdownValue(2), 1000))
    timers.push(setTimeout(() => setCountdownValue(1), 2000))
    timers.push(setTimeout(() => setCountdownValue('FIGHT!'), 3000))
    timers.push(setTimeout(() => {
      setCountdownValue(null)
      setBattleStatus('active')
    }, 3800))
    return () => timers.forEach(clearTimeout)
  }, [battleStatus])

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
      if (!isAI) {
        const col = battleStatus === 'victory' ? 'wins' : 'losses'
        supabase.from('profiles').select(col).eq('id', user.id).single()
          .then(({ data, error }) => {
            if (error || !data) { console.error('stat fetch error:', error); return }
            const d = data as unknown as Record<string, number>
            return supabase.from('profiles').update({ [col]: d[col] + 1 }).eq('id', user.id)
          })
          .then(res => { if (res?.error) console.error('stat update error:', res.error) })
      }
      const t = setTimeout(() => navigate('/'), 6000)
      return () => clearTimeout(t)
    }
  }, [battleStatus, isAI, user.id, navigate])

  useEffect(() => {
    if (battleStatus !== 'active') return
    setTimeLeft(60)
    const id = setInterval(() => {
      setTimeLeft(t => (t !== null && t > 0) ? t - 1 : 0)
    }, 1000)
    return () => clearInterval(id)
  }, [battleStatus])

  useEffect(() => {
    if (timeLeft !== 0 || battleStatus !== 'active') return
    setEndReason('timeout')
    if (myHpRef.current >= opponentHpRef.current) {
      setBattleStatus('victory')
      if (!isAI && matchId) {
        void supabase.from('matches')
          .update({ status: 'finished', winner_id: user.id })
          .eq('id', matchId)
          .then(({ error }) => { if (error) console.error(error) })
      }
    } else {
      setBattleStatus('defeat')
    }
  }, [timeLeft, battleStatus, isAI, matchId, user.id])

  useEffect(() => {
    if (battleStatus !== 'active' && battleStatus !== 'countdown') return
    const id = setInterval(updateGestures, 50)
    return () => clearInterval(id)
  }, [battleStatus, updateGestures])

  const prevAttackingRef = useRef(false)
  useEffect(() => {
    if (gesture.isAttacking && !prevAttackingRef.current && battleStatus === 'active') {
      if (isAI) {
        const result = receiveAttack(gesture.attackZone!)
        if (result === 'hit') {
          showFeedback('ATTACK SUCCESS', '#f97316', 'right')
          setOpponentFlash(true)
          setTimeout(() => setOpponentFlash(false), 150)
        }
      } else {
        sendMessage({ type: 'attack', zone: gesture.attackZone! })
        setOpponentFlash(true)
        setTimeout(() => setOpponentFlash(false), 150)
      }
      playSwing()
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
    const isVictory = battleStatus === 'victory'
    const opponentFinalHp = isAI ? aiHp : opponentHp
    const myName = (profile?.display_name ?? 'YOU').toUpperCase()
    const opponentName = (isAI ? aiName : (opponentProfile?.display_name ?? 'OPPONENT')).toUpperCase()
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: isVictory
          ? 'radial-gradient(ellipse at center, #1a1200 0%, #000 70%)'
          : 'radial-gradient(ellipse at center, #1a0000 0%, #000 70%)'
        }}
      >
        <DotLottieReact
          src={isVictory ? VICTORY_LOTTIE : DEFEAT_LOTTIE}
          autoplay
          loop={false}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, opacity: 0.35 }}
        />
        <div className="relative z-10 flex flex-col items-center gap-5 px-8 w-full max-w-xs">
          <p className="text-gray-500 tracking-widest" style={{ fontSize: '0.55rem' }}>
            {endReason === 'timeout' ? '— TIME UP —' : '— K.O. —'}
          </p>
          <p style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 'clamp(2rem, 10vw, 3.5rem)',
            fontWeight: 'bold',
            lineHeight: 1.1,
            color: isVictory ? '#facc15' : '#ef4444',
            textShadow: isVictory
              ? '0 0 40px rgba(250,204,21,0.8), 0 0 80px rgba(250,204,21,0.3)'
              : '0 0 40px rgba(239,68,68,0.8), 0 0 80px rgba(239,68,68,0.3)',
          }}>
            {isVictory ? 'VICTORY' : 'DEFEAT'}
          </p>
          <div className="w-full flex gap-2 items-stretch mt-1">
            <div className="flex-1 flex flex-col items-start gap-1.5 bg-gray-900/60 px-3 py-2 rounded">
              <span className="text-gray-400 truncate" style={{ fontSize: '0.5rem' }}>{myName}</span>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(myHp / MAX_HP) * 100}%`, backgroundColor: myHp > 0 ? '#22c55e' : '#374151' }} />
              </div>
              <span style={{ fontSize: '0.5rem', color: myHp > 0 ? '#4ade80' : '#6b7280' }}>{myHp}HP</span>
            </div>
            <div className="flex items-center px-1">
              <span className="text-gray-700" style={{ fontSize: '0.55rem' }}>vs</span>
            </div>
            <div className="flex-1 flex flex-col items-end gap-1.5 bg-gray-900/60 px-3 py-2 rounded">
              <span className="text-gray-400 truncate" style={{ fontSize: '0.5rem' }}>{opponentName}</span>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full ml-auto" style={{ width: `${(opponentFinalHp / MAX_HP) * 100}%`, backgroundColor: opponentFinalHp > 0 ? '#22c55e' : '#374151' }} />
              </div>
              <span style={{ fontSize: '0.5rem', color: opponentFinalHp > 0 ? '#4ade80' : '#6b7280' }}>{opponentFinalHp}HP</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-1">Returning to lobby...</p>
        </div>
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
    <div className="overflow-hidden relative bg-black" style={{ height: '100dvh' }}>
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={avatarCanvasRef} className="hidden" width={640} height={480} />

      {/* Opponent: full-screen background */}
      {isAI ? (
        <canvas
          ref={aiCanvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {battleStatus === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/85">
              <p className="text-gray-600 tracking-widest mb-8" style={{ fontSize: '0.5rem' }}>OPPONENT FOUND</p>
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-3">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
                    : <div className="w-16 h-16 rounded-full border-2 border-blue-500 bg-gray-900 flex items-center justify-center">
                        <span className="text-white text-xl">{(profile?.display_name ?? 'Y')[0].toUpperCase()}</span>
                      </div>
                  }
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-white text-xs">{profile?.display_name ?? 'YOU'}</span>
                    {profile?.country_code && <span className="text-sm">{toFlag(profile.country_code)}</span>}
                  </div>
                </div>
                <span className="text-gray-700 font-bold" style={{ fontFamily: 'var(--font-pixel)', fontSize: '4vw' }}>VS</span>
                <div className="flex flex-col items-center gap-3">
                  {opponentProfile?.avatar_url
                    ? <img src={opponentProfile.avatar_url} className="w-16 h-16 rounded-full object-cover border-2 border-red-500" />
                    : <div className="w-16 h-16 rounded-full border-2 border-red-500 bg-gray-900 flex items-center justify-center">
                        {opponentProfile
                          ? <span className="text-white text-xl">{(opponentProfile.display_name ?? 'O')[0].toUpperCase()}</span>
                          : <span className="text-gray-600 text-xs animate-pulse">···</span>
                        }
                      </div>
                  }
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-white text-xs">{opponentProfile?.display_name ?? '···'}</span>
                    {opponentProfile?.country_code && <span className="text-sm">{toFlag(opponentProfile.country_code)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-10">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          {opponentAfk && opponentAfkCountdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 z-20">
              <p className="text-yellow-400 text-xs text-center px-4">Opponent is away</p>
              <p className="text-white text-2xl">{opponentAfkCountdown}</p>
              <p className="text-gray-400 text-xs text-center px-4">Victory in {opponentAfkCountdown}s</p>
            </div>
          )}
        </>
      )}

      {/* Opponent hit flash */}
      {opponentFlash && (
        <div className="absolute inset-0 pointer-events-none bg-orange-400/40 z-10" />
      )}

      {/* HP bars at top */}
      <div className="absolute top-0 left-0 right-0 flex gap-2 px-2 pt-2 z-10 items-start">
        <HpBar
          hp={myHp}
          label="YOU"
          playerInfo={{
            name: profile?.display_name ?? 'YOU',
            avatarUrl: profile?.avatar_url,
            countryCode: profile?.country_code,
          }}
        />
        <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 pt-0.5">
          {timeLeft !== null && (() => {
            const urgent = timeLeft <= 10
            const critical = timeLeft <= 5
            return (
              <span
                key={timeLeft}
                className={critical ? 'timer-critical' : urgent ? 'timer-urgent' : ''}
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  fontSize: urgent ? '1.6rem' : '0.75rem',
                  color: critical ? '#ef4444' : urgent ? '#f97316' : '#9ca3af',
                  textShadow: urgent ? `0 0 18px ${critical ? '#ef4444aa' : '#f97316aa'}` : 'none',
                }}
              >
                {timeLeft}
              </span>
            )
          })()}
        </div>
        <HpBar
          hp={isAI ? aiHp : opponentHp}
          label={isAI ? aiName.toUpperCase() : 'OPPONENT'}
          flip
          playerInfo={isAI
            ? { name: aiName.toUpperCase() }
            : opponentProfile
              ? { name: opponentProfile.display_name ?? 'OPPONENT', avatarUrl: opponentProfile.avatar_url, countryCode: opponentProfile.country_code }
              : undefined
          }
        />
      </div>

      {/* My arms: first-person transparent overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* My hit flash */}
      {myFlash && (
        <div className="absolute inset-0 pointer-events-none bg-red-500/50 z-20" />
      )}

      {/* Combat feedback text */}
      {combatFeedback && (
        <span
          key={combatFeedback.id}
          className="combat-feedback z-30"
          style={{
            color: combatFeedback.color,
            top: '52px',
            ...(combatFeedback.side === 'left' ? { left: '12px' } : { right: '12px' }),
          }}
        >
          {combatFeedback.text}
        </span>
      )}

      {/* Pose loading */}
      {poseStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-gray-600 text-xs">Loading pose model...</p>
        </div>
      )}

      {/* Tutorial hint during countdown */}
      {battleStatus === 'countdown' && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-10 z-25 pointer-events-none">
          <img src={tutorialSrc} alt="controls" style={{ width: '58vw', maxWidth: 300, opacity: 0.5 }} />
        </div>
      )}

      {/* Battle countdown */}
      {battleStatus === 'countdown' && countdownValue !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <span
            key={String(countdownValue)}
            className={typeof countdownValue === 'string' ? 'countdown-fight' : 'countdown-number'}
          >
            {countdownValue}
          </span>
        </div>
      )}

      {/* AFK warning */}
      {battleStatus === 'active' && myAfkCountdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 z-30">
          <p className="text-red-400 text-xs text-center px-4">You are not detected on screen</p>
          <p className="text-white text-3xl">{myAfkCountdown}</p>
          <p className="text-gray-400 text-xs text-center px-4">Defeat in {myAfkCountdown}s</p>
        </div>
      )}
    </div>
  )
}
