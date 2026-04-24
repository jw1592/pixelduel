import { describe, it, expect } from 'vitest'
import { detectGestures } from './useCombatGestures'
import type { PoseLandmark } from '../types'

function makeLandmarks(overrides: Partial<Record<number, Partial<PoseLandmark>>> = {}): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  // Default: right shoulder at (0.6, 0.4), right elbow at (0.7, 0.5), right wrist at (0.8, 0.6)
  lms[12] = { x: 0.6, y: 0.4, z: 0 } // right shoulder
  lms[14] = { x: 0.7, y: 0.5, z: 0 } // right elbow
  lms[16] = { x: 0.8, y: 0.6, z: 0 } // right wrist
  Object.entries(overrides).forEach(([i, v]) => {
    lms[Number(i)] = { ...lms[Number(i)], ...v }
  })
  return lms
}

describe('detectGestures', () => {
  it('returns not attacking and not blocking in neutral pose', () => {
    const history = Array(8).fill(0.6)
    const lms = makeLandmarks()
    const result = detectGestures(lms, history)
    expect(result.isAttacking).toBe(false)
    expect(result.isBlocking).toBe(false)
  })

  it('detects block when wrist is above shoulder', () => {
    // wrist.y (0.2) < shoulder.y (0.4) - 0.03
    const lms = makeLandmarks({ 16: { x: 0.5, y: 0.2, z: 0 } })
    const history = Array(8).fill(0.2)
    const result = detectGestures(lms, history)
    expect(result.isBlocking).toBe(true)
  })

  it('detects sword swing when wrist moves down fast with extended arm', () => {
    // Extended arm: wrist at (0.8, 0.7), shoulder at (0.6, 0.4) → distance ≈ 0.36
    // Fast downward: history goes from 0.3 to 0.7 (delta = 0.4 over 5 frames >> 0.06)
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.4 }, 16: { x: 0.8, y: 0.7 } })
    const history = [0.3, 0.35, 0.45, 0.55, 0.65, 0.7, 0.7, 0.7]
    const result = detectGestures(lms, history)
    expect(result.isAttacking).toBe(true)
  })

  it('does not detect swing when arm is not extended', () => {
    // Wrist close to shoulder (not extended)
    const lms = makeLandmarks({ 12: { x: 0.5, y: 0.4 }, 16: { x: 0.52, y: 0.42 } })
    const history = [0.3, 0.35, 0.45, 0.55, 0.65, 0.7, 0.7, 0.7]
    const result = detectGestures(lms, history)
    expect(result.isAttacking).toBe(false)
  })
})
