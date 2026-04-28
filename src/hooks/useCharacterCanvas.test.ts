import { describe, it, expect, beforeEach, vi } from 'vitest'
import { drawCharacter } from './useCharacterCanvas'
import { IDLE_POSE } from '../data/aiPoses'

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillStyle: '#000000',
    globalAlpha: 1,
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D
}

describe('drawCharacter', () => {
  let ctx: CanvasRenderingContext2D
  beforeEach(() => { ctx = makeCtx() })

  it('renders without throwing using default colors', () => {
    expect(() => drawCharacter(ctx, IDLE_POSE, null, 640, 480)).not.toThrow()
  })

  it('renders without throwing using custom colors', () => {
    const colors = { skin: '#5dc45d', shirt: '#3a8a3a', pants: '#2a6a2a' }
    expect(() => drawCharacter(ctx, IDLE_POSE, null, 640, 480, colors)).not.toThrow()
  })

  it('renders without throwing when colors are partially specified', () => {
    expect(() => drawCharacter(ctx, IDLE_POSE, null, 640, 480, { skin: '#ff0000' })).not.toThrow()
  })
})
