import { describe, it, expect } from 'vitest'
import { detectGestures, getBlockZone } from './useCombatGestures'
import type { PoseLandmark } from '../types'

function makeLandmarks(overrides: Partial<Record<number, Partial<PoseLandmark>>> = {}): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  lms[11] = { x: 0.4, y: 0.35, z: 0 } // left shoulder
  lms[12] = { x: 0.6, y: 0.35, z: 0 } // right shoulder
  lms[14] = { x: 0.7, y: 0.50, z: 0 } // right elbow
  lms[15] = { x: 0.3, y: 0.75, z: 0 } // left wrist (hanging down — not blocking)
  lms[16] = { x: 0.8, y: 0.40, z: 0 } // right wrist (body zone: 0.22–0.52)
  Object.entries(overrides).forEach(([i, v]) => {
    lms[Number(i)] = { ...lms[Number(i)], ...v }
  })
  return lms
}

describe('detectGestures', () => {
  it('returns not attacking and not blocking in neutral pose', () => {
    const yHistory = Array(8).fill(0.40)
    const xHistory = Array(8).fill(0.80)
    const lms = makeLandmarks()
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(false)
    expect(result.isBlocking).toBe(false)
  })

  it('detects block (head) when left wrist is above left shoulder', () => {
    // lms[15].y < lms[11].y → head zone
    const lms = makeLandmarks({ 15: { x: 0.4, y: 0.20, z: 0 } })
    const yHistory = Array(8).fill(0.40)
    const xHistory = Array(8).fill(0.80)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isBlocking).toBe(true)
    expect(result.blockZone).toBe('head')
  })

  it('detects block (body) when left wrist is near chest level', () => {
    // lms[11].y = 0.35, lms[15].y = 0.50 → 0.50 < 0.35 + 0.20 = 0.55 → body
    const lms = makeLandmarks({ 15: { x: 0.4, y: 0.50, z: 0 } })
    const yHistory = Array(8).fill(0.40)
    const xHistory = Array(8).fill(0.80)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isBlocking).toBe(true)
    expect(result.blockZone).toBe('body')
  })

  it('detects attack in body zone when wrist moves fast with extended arm', () => {
    // rWrist y=0.40 → body zone; fast downward swing
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.35 }, 16: { x: 0.8, y: 0.40 } })
    const yHistory = [0.10, 0.15, 0.22, 0.30, 0.35, 0.40, 0.40, 0.40]
    const xHistory = Array(8).fill(0.80)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(true)
    expect(result.attackZone).toBe('body')
  })

  it('detects attack in head zone when wrist is raised high and moves fast', () => {
    // rWrist y=0.18 → head zone; fast horizontal swing
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.35 }, 16: { x: 0.8, y: 0.18 } })
    const yHistory = Array(8).fill(0.18)
    const xHistory = [0.40, 0.45, 0.55, 0.65, 0.72, 0.78, 0.80, 0.80]
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(true)
    expect(result.attackZone).toBe('head')
  })

  it('does not detect attack when wrist is below attack zone (> 0.52)', () => {
    const lms = makeLandmarks({ 12: { x: 0.6, y: 0.35 }, 16: { x: 0.8, y: 0.70 } })
    const yHistory = [0.30, 0.40, 0.50, 0.60, 0.65, 0.70, 0.70, 0.70]
    const xHistory = Array(8).fill(0.80)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(false)
    expect(result.attackZone).toBeNull()
  })

  it('does not detect swing when arm is not extended', () => {
    const lms = makeLandmarks({ 12: { x: 0.5, y: 0.35 }, 16: { x: 0.52, y: 0.37 } })
    const yHistory = [0.10, 0.15, 0.22, 0.30, 0.35, 0.37, 0.37, 0.37]
    const xHistory = Array(8).fill(0.52)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isAttacking).toBe(false)
  })

  it('does not detect attack while blocking (left arm)', () => {
    // Left wrist above left shoulder → blocking; right wrist in head zone with fast movement
    const lms = makeLandmarks({
      11: { x: 0.4, y: 0.50 },
      15: { x: 0.4, y: 0.20 }, // left wrist above left shoulder → blocking
      16: { x: 0.8, y: 0.18 }, // right wrist in head zone
    })
    const yHistory = [0.40, 0.35, 0.30, 0.25, 0.20, 0.18, 0.18, 0.18]
    const xHistory = Array(8).fill(0.80)
    const result = detectGestures(lms, yHistory, xHistory)
    expect(result.isBlocking).toBe(true)
    expect(result.isAttacking).toBe(false)
  })
})

describe('getBlockZone', () => {
  it('returns null when wrist is well below shoulder', () => {
    const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    lms[11] = { x: 0.4, y: 0.35, z: 0 } // left shoulder
    lms[15] = { x: 0.3, y: 0.75, z: 0 } // left wrist far below
    expect(getBlockZone(lms)).toBeNull()
  })

  it('returns head when wrist is above shoulder', () => {
    const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    lms[11] = { x: 0.4, y: 0.40, z: 0 }
    lms[15] = { x: 0.4, y: 0.20, z: 0 } // above shoulder
    expect(getBlockZone(lms)).toBe('head')
  })

  it('returns body when wrist is within 0.20 below shoulder', () => {
    const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    lms[11] = { x: 0.4, y: 0.40, z: 0 }
    lms[15] = { x: 0.4, y: 0.55, z: 0 } // 0.40 + 0.20 = 0.60 → 0.55 < 0.60 → body
    expect(getBlockZone(lms)).toBe('body')
  })
})
