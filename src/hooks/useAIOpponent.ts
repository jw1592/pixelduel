import { useRef, useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import type { Profile, PoseLandmark, AttackZone } from '../types'
import { AI_CHARACTERS } from '../data/aiCharacters'
import {
  IDLE_POSE, IDLE_SWAY_L, IDLE_SWAY_R,
  ATTACK_HEAD_POSE, ATTACK_BODY_POSE,
  BLOCK_HEAD_POSE, BLOCK_BODY_POSE,
} from '../data/aiPoses'
import { BATTLE_BACKGROUNDS, drawBackground } from '../data/battleBackgrounds'
import type { BattleBackground } from '../data/battleBackgrounds'
import { drawCharacter } from './useCharacterCanvas'

const MAX_HP = 100
const HIT_DAMAGE = 10
const LERP_DURATION = 200

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
  if (winRate < 0.3) return { minInterval: 800,  maxInterval: 1600, blockChance: 0.35 }
  if (winRate < 0.6) return { minInterval: 450,  maxInterval: 950,  blockChance: 0.60 }
  return               { minInterval: 250,  maxInterval: 550,  blockChance: 0.80 }
}

function randInterval(min: number, max: number): number {
  return min + Math.random() * (max - min)
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
  onAIAttack: (zone: AttackZone) => void
}

export function useAIOpponent({ enabled, profile, canvasRef, onAIAttack }: Props) {
  const [aiHp, setAiHp] = useState(MAX_HP)
  const aiHpRef = useRef(MAX_HP)
  const aiNameRef = useRef<string | null>(null)
  if (aiNameRef.current === null) {
    aiNameRef.current = AI_CHARACTERS[Math.floor(Math.random() * AI_CHARACTERS.length)]
  }

  const bgRef = useRef<BattleBackground>(
    BATTLE_BACKGROUNDS[Math.floor(Math.random() * BATTLE_BACKGROUNDS.length)]
  )

  const poseFromRef = useRef<PoseLandmark[]>(IDLE_POSE)
  const poseToRef = useRef<PoseLandmark[]>(IDLE_POSE)
  const poseStartRef = useRef<number>(0)
  const blockChanceRef = useRef(0.15)
  const aiBlockingRef = useRef(false)
  const isActingRef = useRef(false)
  const swaySideRef = useRef(false)
  const onAIAttackRef = useRef(onAIAttack)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])
  useEffect(() => { onAIAttackRef.current = onAIAttack }, [onAIAttack])
  useEffect(() => { aiHpRef.current = aiHp }, [aiHp])

  const transitionPose = useCallback((target: PoseLandmark[]) => {
    const elapsed = performance.now() - poseStartRef.current
    const t = Math.min(1, elapsed / LERP_DURATION)
    poseFromRef.current = lerpLandmarks(poseFromRef.current, poseToRef.current, t)
    poseToRef.current = target
    poseStartRef.current = performance.now()
  }, [])

  // Render loop
  useEffect(() => {
    if (!enabled) return
    let rafId: number
    const colors = MOB_COLORS[aiNameRef.current!] ?? MOB_COLORS['Creeper']
    const render = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const t = Math.min(1, (performance.now() - poseStartRef.current) / LERP_DURATION)
          const lms = lerpLandmarks(poseFromRef.current, poseToRef.current, t)
          const zoom = 0.75
          const cx = 0.5
          const scaledLms = lms.map(lm => ({
            ...lm,
            x: (lm.x - cx) * zoom + cx,
            y: lm.y * zoom + 0.15,
          }))
          drawBackground(ctx, bgRef.current, canvas.width, canvas.height)
          drawCharacter(ctx, scaledLms, null, canvas.width, canvas.height, colors, aiBlockingRef.current, false, true)
        }
      }
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, canvasRef])

  // Idle sway loop
  useEffect(() => {
    if (!enabled) return
    let timerId: ReturnType<typeof setTimeout>
    const doSway = () => {
      if (mountedRef.current && !isActingRef.current) {
        const pose = swaySideRef.current ? IDLE_SWAY_R : IDLE_SWAY_L
        swaySideRef.current = !swaySideRef.current
        transitionPose(pose)
        setTimeout(() => {
          if (mountedRef.current && !isActingRef.current) transitionPose(IDLE_POSE)
        }, 350)
      }
      timerId = setTimeout(doSway, randInterval(700, 1000))
    }
    timerId = setTimeout(doSway, randInterval(400, 700))
    return () => clearTimeout(timerId)
  }, [enabled, transitionPose])

  // Action loop (attack / proactive block)
  useEffect(() => {
    if (!enabled) return
    const wins = profile?.wins ?? 0
    const losses = profile?.losses ?? 0
    const { minInterval, maxInterval, blockChance } = getDifficulty(wins, losses)
    blockChanceRef.current = blockChance

    let timerId: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      timerId = setTimeout(() => {
        if (!mountedRef.current) return
        if (aiHpRef.current > 0) {
          const roll = Math.random()
          if (roll < 0.65) {
            const zone: AttackZone = Math.random() < 0.5 ? 'head' : 'body'
            const attackPose = zone === 'head' ? ATTACK_HEAD_POSE : ATTACK_BODY_POSE
            isActingRef.current = true
            transitionPose(attackPose)
            setTimeout(() => { if (mountedRef.current) onAIAttackRef.current(zone) }, 300)
            setTimeout(() => {
              if (mountedRef.current) {
                transitionPose(IDLE_POSE)
                isActingRef.current = false
              }
            }, 600)
          } else if (roll < 0.85) {
            const zone: AttackZone = Math.random() < 0.5 ? 'head' : 'body'
            const blockPose = zone === 'head' ? BLOCK_HEAD_POSE : BLOCK_BODY_POSE
            isActingRef.current = true
            aiBlockingRef.current = true
            transitionPose(blockPose)
            setTimeout(() => {
              if (mountedRef.current) {
                aiBlockingRef.current = false
                transitionPose(IDLE_POSE)
                isActingRef.current = false
              }
            }, 450)
          }
          // 15%: no action — sway loop handles movement
        }
        scheduleNext()
      }, randInterval(minInterval, maxInterval))
    }
    scheduleNext()

    return () => clearTimeout(timerId)
  }, [enabled, profile, transitionPose])

  const receiveAttack = useCallback((zone: AttackZone): 'hit' | 'blocked' => {
    const blocking = Math.random() < blockChanceRef.current
    if (blocking) {
      const blockPose = zone === 'head' ? BLOCK_HEAD_POSE : BLOCK_BODY_POSE
      isActingRef.current = true
      aiBlockingRef.current = true
      transitionPose(blockPose)
      setTimeout(() => {
        if (mountedRef.current) {
          aiBlockingRef.current = false
          transitionPose(IDLE_POSE)
          isActingRef.current = false
        }
      }, 400)
      return 'blocked'
    }
    setAiHp(prev => Math.max(0, prev - HIT_DAMAGE))
    return 'hit'
  }, [transitionPose])

  return { aiHp, aiName: aiNameRef.current!, receiveAttack }
}
