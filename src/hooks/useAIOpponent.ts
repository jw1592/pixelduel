import { useRef, useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import type { Profile, PoseLandmark } from '../types'
import { AI_CHARACTERS } from '../data/aiCharacters'
import { IDLE_POSE, ATTACK_POSE, BLOCK_POSE } from '../data/aiPoses'
import { drawCharacter } from './useCharacterCanvas'

const MAX_HP = 100
const HIT_DAMAGE = 25
const BLOCK_DAMAGE = 5
const LERP_DURATION = 250

const MOB_COLORS: Record<string, { skin: string; shirt: string; pants: string }> = {
  Creeper:  { skin: '#5dc45d', shirt: '#3a8a3a', pants: '#2a6a2a' },
  Skeleton: { skin: '#dddddd', shirt: '#aaaaaa', pants: '#888888' },
  Zombie:   { skin: '#6aaa7a', shirt: '#4a7a5a', pants: '#2a5a3a' },
  Enderman: { skin: '#222244', shirt: '#111122', pants: '#0a0a18' },
  Spider:   { skin: '#771111', shirt: '#4a1a1a', pants: '#331111' },
  Pig:      { skin: '#f0a0a0', shirt: '#e86b6b', pants: '#cc4444' },
  Villager: { skin: '#c8966b', shirt: '#8b6a44', pants: '#5a4030' },
}

export function getDifficulty(wins: number, losses: number) {
  const winRate = wins / (wins + losses + 1)
  if (winRate < 0.3) return { attackInterval: 3500, blockChance: 0.15 }
  if (winRate < 0.6) return { attackInterval: 2200, blockChance: 0.35 }
  return               { attackInterval: 1300, blockChance: 0.60 }
}

function lerpLandmarks(from: PoseLandmark[], to: PoseLandmark[], t: number): PoseLandmark[] {
  return from.map((f, i) => ({
    x: f.x + (to[i].x - f.x) * t,
    y: f.y + (to[i].y - f.y) * t,
    z: 0,
  }))
}

interface Props {
  enabled: boolean
  profile: Profile | null
  canvasRef: RefObject<HTMLCanvasElement | null>
  onAIAttack: () => void
}

export function useAIOpponent({ enabled, profile, canvasRef, onAIAttack }: Props) {
  const [aiHp, setAiHp] = useState(MAX_HP)
  const aiHpRef = useRef(MAX_HP)
  const aiNameRef = useRef(AI_CHARACTERS[Math.floor(Math.random() * AI_CHARACTERS.length)])

  const poseFromRef = useRef<PoseLandmark[]>(IDLE_POSE)
  const poseToRef = useRef<PoseLandmark[]>(IDLE_POSE)
  const poseStartRef = useRef<number>(0)
  const blockChanceRef = useRef(0.15)
  const onAIAttackRef = useRef(onAIAttack)

  useEffect(() => { onAIAttackRef.current = onAIAttack }, [onAIAttack])
  useEffect(() => { aiHpRef.current = aiHp }, [aiHp])

  const transitionPose = useCallback((target: PoseLandmark[]) => {
    const elapsed = performance.now() - poseStartRef.current
    const t = Math.min(1, elapsed / LERP_DURATION)
    poseFromRef.current = lerpLandmarks(poseFromRef.current, poseToRef.current, t)
    poseToRef.current = target
    poseStartRef.current = performance.now()
  }, [])

  // Canvas rendering loop
  useEffect(() => {
    if (!enabled) return
    let rafId: number
    const colors = MOB_COLORS[aiNameRef.current]
    const render = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const t = Math.min(1, (performance.now() - poseStartRef.current) / LERP_DURATION)
          const lms = lerpLandmarks(poseFromRef.current, poseToRef.current, t)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          drawCharacter(ctx, lms, null, canvas.width, canvas.height, colors)
        }
      }
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, canvasRef])

  // Attack loop
  useEffect(() => {
    if (!enabled) return
    const wins = profile?.wins ?? 0
    const losses = profile?.losses ?? 0
    const { attackInterval, blockChance } = getDifficulty(wins, losses)
    blockChanceRef.current = blockChance

    const id = setInterval(() => {
      if (aiHpRef.current <= 0) return
      transitionPose(ATTACK_POSE)
      setTimeout(() => { onAIAttackRef.current() }, 300)
      setTimeout(() => { transitionPose(IDLE_POSE) }, 600)
    }, attackInterval)

    return () => clearInterval(id)
  }, [enabled, profile, transitionPose])

  const receiveAttack = useCallback(() => {
    const blocking = Math.random() < blockChanceRef.current
    const damage = blocking ? BLOCK_DAMAGE : HIT_DAMAGE
    if (blocking) {
      transitionPose(BLOCK_POSE)
      setTimeout(() => transitionPose(IDLE_POSE), 400)
    }
    setAiHp(prev => Math.max(0, prev - damage))
  }, [transitionPose])

  return { aiHp, aiName: aiNameRef.current, receiveAttack }
}
