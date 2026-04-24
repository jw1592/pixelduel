import { useRef, useState, useCallback } from 'react'
import type { PoseLandmark, GestureState } from '../types'

const SWING_VELOCITY_THRESHOLD = 0.06
const SWING_HISTORY_WINDOW = 5
const ARM_EXTENSION_THRESHOLD = 0.18
const BLOCK_Y_MARGIN = 0.03
const ATTACK_COOLDOWN_MS = 800
const HISTORY_SIZE = 8

export function detectGestures(landmarks: PoseLandmark[], wristYHistory: number[]): GestureState {
  if (landmarks.length < 29) return { isAttacking: false, isBlocking: false }

  const rShoulder = landmarks[12]
  const rWrist = landmarks[16]

  const isBlocking = rWrist.y < rShoulder.y - BLOCK_Y_MARGIN

  const armLength = Math.hypot(rWrist.x - rShoulder.x, rWrist.y - rShoulder.y)
  const isExtended = armLength > ARM_EXTENSION_THRESHOLD

  const histLen = wristYHistory.length
  const velocity =
    histLen >= SWING_HISTORY_WINDOW
      ? wristYHistory[histLen - 1] - wristYHistory[histLen - SWING_HISTORY_WINDOW]
      : 0

  const isAttacking = velocity > SWING_VELOCITY_THRESHOLD && isExtended

  return { isAttacking, isBlocking }
}

export function useCombatGestures(latestLandmarksRef: React.RefObject<PoseLandmark[]>) {
  const [gesture, setGesture] = useState<GestureState>({ isAttacking: false, isBlocking: false })
  const wristYHistoryRef = useRef<number[]>([])
  const cooldownRef = useRef(false)

  const update = useCallback(() => {
    const landmarks = latestLandmarksRef.current
    if (landmarks.length < 29) return

    const history = wristYHistoryRef.current
    history.push(landmarks[16].y)
    if (history.length > HISTORY_SIZE) history.shift()

    const raw = detectGestures(landmarks, history)

    if (raw.isAttacking && !cooldownRef.current) {
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, ATTACK_COOLDOWN_MS)
      setGesture({ isAttacking: true, isBlocking: raw.isBlocking })
      setTimeout(() => setGesture(g => ({ ...g, isAttacking: false })), 200)
    } else {
      setGesture(g => g.isBlocking !== raw.isBlocking ? { ...g, isBlocking: raw.isBlocking } : g)
    }
  }, [latestLandmarksRef])

  return { gesture, update }
}
