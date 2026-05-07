export type BattleBackground = 'city' | 'nature' | 'volcano' | 'grassland'

export const BATTLE_BACKGROUNDS: BattleBackground[] = ['city', 'nature', 'volcano', 'grassland']

function fillGradient(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  top: string, bottom: string
) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawCity(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillGradient(ctx, w, h, '#05051a', '#1a1a3a')

  // Stars
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137 + 17) % w)
    const sy = ((i * 89 + 31) % (h * 0.55))
    ctx.fillRect(sx, sy, 1, 1)
  }

  // Buildings
  const buildingColors = ['#1e1e2e', '#16162a', '#222236', '#12122a']
  const buildings = [
    { x: 0,       bw: 0.12, bh: 0.55 },
    { x: 0.10,    bw: 0.08, bh: 0.40 },
    { x: 0.17,    bw: 0.14, bh: 0.65 },
    { x: 0.30,    bw: 0.10, bh: 0.50 },
    { x: 0.39,    bw: 0.07, bh: 0.35 },
    { x: 0.45,    bw: 0.12, bh: 0.60 },
    { x: 0.56,    bw: 0.09, bh: 0.45 },
    { x: 0.64,    bw: 0.13, bh: 0.70 },
    { x: 0.76,    bw: 0.08, bh: 0.42 },
    { x: 0.83,    bw: 0.10, bh: 0.55 },
    { x: 0.92,    bw: 0.08, bh: 0.38 },
  ]
  buildings.forEach(({ x, bw, bh }, i) => {
    const bx = x * w
    const bwidth = bw * w
    const bheight = bh * h
    const by = h - bheight
    ctx.fillStyle = buildingColors[i % buildingColors.length]
    ctx.fillRect(bx, by, bwidth, bheight)

    // Windows
    const cols = Math.floor(bwidth / 8)
    const rows = Math.floor(bheight / 10)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.abs(((i * 7 + r * 13 + c * 5) % 10)) < 4) {
          ctx.fillStyle = ((i + r + c) % 3 === 0) ? '#ffe066' : '#4466aa'
          ctx.fillRect(bx + c * 8 + 2, by + r * 10 + 2, 4, 5)
        }
      }
    }
  })

  // Ground
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, h * 0.88, w, h * 0.12)
  ctx.fillStyle = '#222'
  ctx.fillRect(0, h * 0.88, w, 2)
}

function drawNature(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillGradient(ctx, w, h, '#4a8fc4', '#87ceeb')

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ;[[0.1, 0.12, 60, 18], [0.45, 0.08, 80, 20], [0.75, 0.15, 55, 16]].forEach(([cx, cy, cw, ch]) => {
    ctx.beginPath()
    ctx.ellipse(cx * w, cy * h, cw as number, ch as number, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  // Far mountains
  ctx.fillStyle = '#5a8a4a'
  ;[[0, 0.5, 0.35, 0.3], [0.25, 0.44, 0.3, 0.32], [0.55, 0.48, 0.28, 0.28], [0.78, 0.42, 0.22, 0.3]].forEach(([mx, my, mw, _mh]) => {
    ctx.beginPath()
    ctx.moveTo(mx * w, h)
    ctx.lineTo((mx + (mw as number) / 2) * w, my * h)
    ctx.lineTo((mx + (mw as number)) * w, h)
    ctx.fill()
  })

  // Ground
  fillGradient(ctx, w, h * 0.18, '#3a7a2a', '#2d5a1b')
  ctx.fillRect(0, h * 0.82, w, h * 0.18)

  // Trees
  ;[0.05, 0.18, 0.72, 0.85, 0.93].forEach(tx => {
    const th = h * 0.22
    const ty = h * 0.82 - th * 0.6
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(tx * w - 3, ty + th * 0.5, 6, th * 0.5)
    ctx.fillStyle = '#2a7a1a'
    ctx.beginPath()
    ctx.arc(tx * w, ty + th * 0.3, th * 0.35, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawVolcano(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillGradient(ctx, w, h, '#1a0000', '#8b1a00')

  // Lava glow at horizon
  const lavaGlow = ctx.createLinearGradient(0, h * 0.6, 0, h)
  lavaGlow.addColorStop(0, 'rgba(255,80,0,0)')
  lavaGlow.addColorStop(1, 'rgba(255,80,0,0.6)')
  ctx.fillStyle = lavaGlow
  ctx.fillRect(0, h * 0.6, w, h * 0.4)

  // Ash particles
  ctx.fillStyle = 'rgba(180,180,180,0.4)'
  for (let i = 0; i < 30; i++) {
    const px = ((i * 173 + 23) % w)
    const py = ((i * 97 + 11) % (h * 0.7))
    ctx.fillRect(px, py, 2, 2)
  }

  // Volcano shape
  ctx.fillStyle = '#1a0a00'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(w * 0.22, h * 0.38)
  ctx.lineTo(w * 0.44, h)
  ctx.fill()

  ctx.fillStyle = '#220c00'
  ctx.beginPath()
  ctx.moveTo(w * 0.38, h)
  ctx.lineTo(w * 0.62, h * 0.32)
  ctx.lineTo(w * 0.86, h)
  ctx.fill()

  ctx.fillStyle = '#1a0a00'
  ctx.beginPath()
  ctx.moveTo(w * 0.72, h)
  ctx.lineTo(w, h * 0.52)
  ctx.lineTo(w, h)
  ctx.fill()

  // Crater glow
  ctx.fillStyle = 'rgba(255,120,0,0.8)'
  ctx.beginPath()
  ctx.ellipse(w * 0.62, h * 0.32, w * 0.04, h * 0.025, 0, 0, Math.PI * 2)
  ctx.fill()

  // Lava ground
  const groundGrad = ctx.createLinearGradient(0, h * 0.85, 0, h)
  groundGrad.addColorStop(0, '#3a0800')
  groundGrad.addColorStop(1, '#1a0400')
  ctx.fillStyle = groundGrad
  ctx.fillRect(0, h * 0.85, w, h * 0.15)

  // Lava cracks
  ctx.strokeStyle = '#ff4500'
  ctx.lineWidth = 1.5
  ;[[0.1, 0.88, 0.25, 0.95], [0.5, 0.87, 0.65, 0.94], [0.8, 0.90, 0.9, 0.97]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath()
    ctx.moveTo(x1 * w, y1 * h)
    ctx.lineTo(x2 * w, y2 * h)
    ctx.stroke()
  })
}

function drawGrassland(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fillGradient(ctx, w, h, '#5ba3d9', '#a8d8ea')

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ;[[0.08, 0.10, 70, 22], [0.38, 0.07, 90, 25], [0.68, 0.13, 65, 19], [0.88, 0.09, 50, 16]].forEach(([cx, cy, cw, ch]) => {
    ctx.beginPath()
    ctx.ellipse(cx * w, cy * h, cw as number, ch as number, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  // Rolling hills (back)
  ctx.fillStyle = '#6ab04c'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.bezierCurveTo(w * 0.2, h * 0.62, w * 0.4, h * 0.58, w * 0.5, h * 0.65)
  ctx.bezierCurveTo(w * 0.6, h * 0.72, w * 0.8, h * 0.60, w, h * 0.68)
  ctx.lineTo(w, h)
  ctx.fill()

  // Rolling hills (front)
  ctx.fillStyle = '#4caf35'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.bezierCurveTo(w * 0.15, h * 0.72, w * 0.35, h * 0.68, w * 0.5, h * 0.75)
  ctx.bezierCurveTo(w * 0.65, h * 0.82, w * 0.82, h * 0.70, w, h * 0.78)
  ctx.lineTo(w, h)
  ctx.fill()

  // Ground
  fillGradient(ctx, w, h * 0.18, '#3a9a20', '#2d7a15')
  ctx.fillStyle = '#3a9a20'
  ctx.fillRect(0, h * 0.82, w, h * 0.18)

  // Flowers
  ;[0.08, 0.22, 0.38, 0.55, 0.70, 0.84].forEach((fx, i) => {
    const fy = h * (0.83 + (i % 3) * 0.02)
    ctx.fillStyle = i % 2 === 0 ? '#ffdd00' : '#ff6688'
    ctx.beginPath()
    ctx.arc(fx * w, fy, 4, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BattleBackground,
  w: number,
  h: number
) {
  switch (bg) {
    case 'city':      drawCity(ctx, w, h); break
    case 'nature':    drawNature(ctx, w, h); break
    case 'volcano':   drawVolcano(ctx, w, h); break
    case 'grassland': drawGrassland(ctx, w, h); break
  }
}
