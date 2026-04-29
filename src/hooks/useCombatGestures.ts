import { useRef, useState, useCallback } from 'react'
import type { PoseLandmark, GestureState } from '../types'

const SWING_SPEED_THRESHOLD = 0.05
const SWING_HISTORY_WINDOW = 5
const ARM_EXTENSION_THRESHOLD = 0.18
const BLOCK_Y_MARGIN = 0.03
const ATTACK_COOLDOWN_MS = 600
const HISTORY_SIZE = 8

export function isBlocking(landmarks: PoseLandmark[]): boolean {
  return landmarks.length >= 29 &&
    landmarks[16].y < landmarks[12].y - BLOCK_Y_MARGIN
}

export function detectGestures(
  landmarks: PoseLandmark[],
  wristYHistory: number[],
  wristXHistory: number[],
): GestureState {
  if (landmarks.length < 29) return { isAttacking: false, isBlocking: false }

  const rShoulder = landmarks[12]
  const rWrist = landmarks[16]

  const blocking = rWrist.y < rShoulder.y - BLOCK_Y_MARGIN

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

  return {
    isAttacking: speed > SWING_SPEED_THRESHOLD && isExtended && !blocking,
    isBlocking: blocking,
  }
}

export function useCombatGestures(latestLandmarksRef: React.RefObject<PoseLandmark[]>) {
  const [gesture, setGesture] = useState<GestureState>({ isAttacking: false, isBlocking: false })
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

    if (raw.isAttacking && !cooldownRef.current) {
      cooldownRef.current = true
      setTimeout(() => { cooldownRef.current = false }, ATTACK_COOLDOWN_MS)
      setGesture({ isAttacking: true, isBlocking: false })
      setTimeout(() => setGesture(g => ({ ...g, isAttacking: false })), 200)
    } else {
      setGesture(g => g.isBlocking !== raw.isBlocking ? { ...g, isBlocking: raw.isBlocking } : g)
    }
  }, [latestLandmarksRef])

  return { gesture, update }
}
