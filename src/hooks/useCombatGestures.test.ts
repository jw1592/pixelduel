import { describe, it, expect } from 'vitest'
import { detectGestures } from './useCombatGestures'
import type { PoseLandmark } from '../types'

function makeLandmarks(overrides: Partial<Record<number, Partial<PoseLandmark>>> = {}): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
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
    const yHistory = Array(8).fill(0.6)
    const xHistory = Array(8).fill(0.8)
    const lms = makeLandmarks()
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(false)
    expect(result.isBlocking).toBe(false)
  })

  it('detects block when wrist is above shoulder', () => {
    const lms = makeLandmarks({ 16: { x: 0.5, y: 0.2, z: 0 } })
    const yHistory = Array(8).fill(0.2)
    const xHistory = Array(8).fill(0.5)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isBlocking).toBe(true)
  })

  it('detects swing when wrist moves down fast with extended arm', () => {
    // wrist at (0.8, 0.7), shoulder at (0.6, 0.4) → arm distance ≈ 0.36
    // Fast downward: Y history 0.3 → 0.7 (delta = 0.4 >> 0.05)
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.4 }, 16: { x: 0.8, y: 0.7 } })
    const yHistory = [0.3, 0.35, 0.45, 0.55, 0.65, 0.7, 0.7, 0.7]
    const xHistory = Array(8).fill(0.8)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(true)
  })

  it('detects swing when wrist moves horizontally fast with extended arm', () => {
    // Same extended arm, fast horizontal: X history 0.4 → 0.8 (delta = 0.4 >> 0.05)
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.4 }, 16: { x: 0.8, y: 0.7 } })
    const yHistory = Array(8).fill(0.7)
    const xHistory = [0.4, 0.45, 0.55, 0.65, 0.72, 0.78, 0.8, 0.8]
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(true)
  })

  it('does not detect swing when arm is not extended', () => {
    const lms = makeLandmarks({ 12: { x: 0.5, y: 0.4 }, 16: { x: 0.52, y: 0.42 } })
    const yHistory = [0.3, 0.35, 0.45, 0.55, 0.65, 0.7, 0.7, 0.7]
    const xHistory = Array(8).fill(0.52)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(false)
  })

  it('does not detect attack while blocking', () => {
    // Wrist above shoulder (blocking) but also moving fast
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.5 }, 16: { x: 0.8, y: 0.2 } })
    const yHistory = [0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.2, 0.2]
    const xHistory = Array(8).fill(0.8)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isBlocking).toBe(true)
    expect(result.isAttacking).toBe(false)
  })
})
