import { describe, it, expect } from 'vitest'
import { getDifficulty } from './useAIOpponent'

describe('getDifficulty', () => {
  it('returns Easy for a new player (0 wins, 0 losses)', () => {
    const d = getDifficulty(0, 0)
    // winRate = 0/(0+0+1) = 0 < 0.3
    expect(d.attackInterval).toBe(3500)
    expect(d.blockChance).toBe(0.15)
  })

  it('returns Normal for a balanced record (5W 5L)', () => {
    // winRate = 5/11 ≈ 0.45, in [0.3, 0.6)
    const d = getDifficulty(5, 5)
    expect(d.attackInterval).toBe(2200)
    expect(d.blockChance).toBe(0.35)
  })

  it('returns Hard for a dominant record (10W 1L)', () => {
    // winRate = 10/12 ≈ 0.83 >= 0.6
    const d = getDifficulty(10, 1)
    expect(d.attackInterval).toBe(1300)
    expect(d.blockChance).toBe(0.60)
  })

  it('returns Easy at exactly the Easy/Normal boundary minus epsilon', () => {
    // winRate just below 0.3: wins=2, losses=8 → 2/11 ≈ 0.18
    const d = getDifficulty(2, 8)
    expect(d.attackInterval).toBe(3500)
  })

  it('returns Hard at exactly the Hard boundary', () => {
    // winRate = 0.6 exactly: wins=6, losses=3 → 6/10 = 0.6 >= 0.6
    const d = getDifficulty(6, 3)
    expect(d.attackInterval).toBe(1300)
  })
})
