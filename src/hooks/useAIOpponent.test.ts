import { describe, it, expect } from 'vitest'
import { getDifficulty } from './useAIOpponent'

describe('getDifficulty', () => {
  it('returns Easy for a new player (0 wins, 0 losses)', () => {
    const d = getDifficulty(0, 0)
    expect(d.minInterval).toBe(1200)
    expect(d.maxInterval).toBe(2800)
    expect(d.blockChance).toBe(0.40)
  })

  it('returns Normal for a balanced record (5W 5L)', () => {
    const d = getDifficulty(5, 5)
    expect(d.minInterval).toBe(700)
    expect(d.maxInterval).toBe(1600)
    expect(d.blockChance).toBe(0.60)
  })

  it('returns Hard for a dominant record (10W 1L)', () => {
    const d = getDifficulty(10, 1)
    expect(d.minInterval).toBe(400)
    expect(d.maxInterval).toBe(900)
    expect(d.blockChance).toBe(0.80)
  })

  it('returns Easy at winRate just below 0.3', () => {
    const d = getDifficulty(2, 8)
    expect(d.minInterval).toBe(1200)
  })

  it('returns Hard at winRate exactly 0.6', () => {
    const d = getDifficulty(6, 3)
    expect(d.minInterval).toBe(400)
  })
})
