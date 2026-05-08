import { useRef, useState, useCallback } from 'react'
import type { PoseLandmark, GestureState, AttackZone } from '../types'

const SWING_SPEED_THRESHOLD = 0.05
const SWING_HISTORY_WINDOW = 5
const ARM_EXTENSION_THRESHOLD = 0.12
const ATTACK_COOLDOWN_MS = 600
const HISTORY_SIZE = 8

// Thresholds relative to torso height so they work regardless of camera angle or distance.
// torsoH = hip.y - shoulder.y (always positive, clamped to min 0.12)

export function getBlockZone(landmarks: PoseLandmark[]): AttackZone | null {
  if (landmarks.length < 29) return null
  const lWrist    = landmarks[15]
  const lShoulder = landmarks[11]
  const lHip      = landmarks[23]
  const torsoH    = Math.max(0.30,lHip.y - lShoulder.y)
  if (lWrist.y < lShoulder.y + torsoH * 0.15) return 'head'
  if (lWrist.y < lShoulder.y + torsoH * 0.70) return 'body'
  return null
}

export function isBlocking(landmarks: PoseLandmark[]): boolean {
  return getBlockZone(landmarks) !== null
}

// Right wrist Y relative to torso: above shoulder = head, within torso = body
function getAttackZone(landmarks: PoseLandmark[]): AttackZone | null {
  const rWrist    = landmarks[16]
  const rShoulder = landmarks[12]
  const rHip      = landmarks[24]
  const torsoH    = Math.max(0.30,rHip.y - rShoulder.y)
  if (rWrist.y < rShoulder.y + torsoH * 0.15) return 'head'
  if (rWrist.y < rShoulder.y + torsoH * 1.20) return 'body'
  return null
}

export function detectGestures(
  landmarks: PoseLandmark[],
  wristYHistory: number[],
  wristXHistory: number[],
): GestureState {
  if (landmarks.length < 29) return { isAttacking: false, isBlocking: false, attackZone: null, blockZone: null }

  const rShoulder = landmarks[12]
  const rWrist = landmarks[16]
  const blockZone = getBlockZone(landmarks)
  const blocking = blockZone !== null

  const armLength = Math.hypot(rWrist.x - rShoulder.x, rWrist.y - rShoulder.y)
  const isExtended = armLength > ARM_EXTENSION_THRESHOLD

  const histLen = wristYHistory.length
  const velY = histLen >= SWING_HISTORY_WINDOW
    ? wristYHistory[histLen - 1] - wristYHistory[histLen - SWING_HISTORY_WINDOW]
    : 0
  const velX = histLen >= SWING_HISTORY_WINDOW
    ? wristXHistory[histLen - 1] - wristXHistory[histLen - SWING_HISTORY_WINDOW]
    : 0
  const speed = Math.hypot(velX, velY)

  const attackZone = !blocking ? getAttackZone(landmarks) : null
  const isAttacking = speed > SWING_SPEED_THRESHOLD && isExtended && !blocking && attackZone !== null

  return {
    isAttacking,
    isBlocking: blocking,
    attackZone: isAttacking ? attackZone : null,
    blockZone,
  }
}

export function useCombatGestures(latestLandmarksRef: React.RefObject<PoseLandmark[]>) {
  const [gesture, setGesture] = useState<GestureState>({ isAttacking: false, isBlocking: false, attackZone: null, blockZone: null })
  const wristYHistoryRef = useRef<number[]>([])
  const wristXHistoryRef = useRef<number[]>([])
  const cooldownRef = useRef(false)

  const update = useCallback(() => {
    const landmarks = latestLandmarksRef.current
    if (landmarks.length < 29) return

    const yHistory = wristYHistoryRef.current
    const xHistory = wristXHistoryRef.current
    yHistory.push(landmarks[16].y)
    xHistory.push(landmarks[16].x)
    if (yHistory.length > HISTORY_SIZE) yHistory.shift()
    if (xHistory.length > HISTORY_SIZE) xHistory.shift()

    const raw = detectGestures(landmarks, yHistory, xHistory)

    if (raw.isAttacking && raw.attackZone && !cooldownRef.current) {
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, ATTACK_COOLDOWN_MS)
      setGesture({ isAttacking: true, isBlocking: false, attackZone: raw.attackZone, blockZone: null })
      setTimeout(() => setGesture(g => ({ ...g, isAttacking: false, attackZone: null })), 200)
    } else {
      setGesture(g =>
        g.isBlocking !== raw.isBlocking || g.blockZone !== raw.blockZone
          ? { ...g, isBlocking: raw.isBlocking, blockZone: raw.blockZone }
          : g
      )
    }
  }, [latestLandmarksRef])

  return { gesture, update }
}
