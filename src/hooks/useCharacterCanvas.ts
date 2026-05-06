import { useRef, useEffect, useCallback } from 'react'
import type { PoseLandmark } from '../types'

type Point = { x: number; y: number }

function lm2px(lm: PoseLandmark, w: number, h: number): Point {
  return { x: lm.x * w, y: lm.y * h }
}

function drawSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point, thickness: number, color: string) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.rotate(Math.atan2(dy, dx))
  ctx.fillStyle = color
  ctx.fillRect(0, -thickness / 2, len, thickness)
  ctx.restore()
}

function drawShield(ctx: CanvasRenderingContext2D, center: Point, size: number, blocking: boolean) {
  ctx.save()
  if (blocking) {
    ctx.shadowColor = '#60a5fa'
    ctx.shadowBlur = 24
  }
  // Outer body
  ctx.beginPath()
  ctx.arc(center.x, center.y, size, 0, Math.PI * 2)
  ctx.fillStyle = '#8a7a6a'
  ctx.fill()
  // Inner plate
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = '#5a4a3a'
  ctx.fill()
  // Cross detail
  ctx.strokeStyle = '#7a6a5a'
  ctx.lineWidth = size * 0.08
  ctx.beginPath()
  ctx.moveTo(center.x, center.y - size * 0.5)
  ctx.lineTo(center.x, center.y + size * 0.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(center.x - size * 0.5, center.y)
  ctx.lineTo(center.x + size * 0.5, center.y)
  ctx.stroke()
  // Rim
  ctx.beginPath()
  ctx.arc(center.x, center.y, size, 0, Math.PI * 2)
  ctx.strokeStyle = blocking ? '#93c5fd' : '#b09a70'
  ctx.lineWidth = blocking ? 4 : 2.5
  ctx.stroke()
  // Boss
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = '#c8a860'
  ctx.fill()
  ctx.restore()
}

// First-person coordinate mapping
// Camera y [0,1] top→bottom, x mirrored for natural self-view
const FP_ZOOM = 2.2
const FP_CX = 0.5
const FP_CY = 0.5
const FP_Y_OFFSET = 0.72

function fpPt(lm: PoseLandmark, w: number, h: number): Point {
  return {
    x: ((1 - lm.x) - FP_CX) * FP_ZOOM * w + w * 0.5,
    y: (lm.y - FP_CY) * FP_ZOOM * h + h * FP_Y_OFFSET,
  }
}

function drawFirstPersonArms(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  w: number,
  h: number,
  blocking: boolean
) {
  if (landmarks.length < 17) return

  const SKIN = '#c8966b'
  const limbThick = Math.max(18, w * 0.05)

  const lShoulder = fpPt(landmarks[11], w, h)
  const lElbow    = fpPt(landmarks[13], w, h)
  const lWrist    = fpPt(landmarks[15], w, h)
  const rShoulder = fpPt(landmarks[12], w, h)
  const rElbow    = fpPt(landmarks[14], w, h)
  const rWrist    = fpPt(landmarks[16], w, h)

  // Draw arms
  drawSegment(ctx, lShoulder, lElbow, limbThick, SKIN)
  drawSegment(ctx, lElbow, lWrist, limbThick, SKIN)
  drawSegment(ctx, rShoulder, rElbow, limbThick, SKIN)
  drawSegment(ctx, rElbow, rWrist, limbThick, SKIN)

  // Shield on left wrist
  drawShield(ctx, lWrist, limbThick * 2.0, blocking)

  // Lightsaber on right hand
  const faDx = rWrist.x - rElbow.x
  const faDy = rWrist.y - rElbow.y
  const faLen = Math.hypot(faDx, faDy)
  if (faLen > 0) {
    const nx = faDx / faLen
    const ny = faDy / faLen
    const bladeLen = faLen * 2.2
    const bladeTip: Point = { x: rWrist.x + nx * bladeLen, y: rWrist.y + ny * bladeLen }

    ctx.save()
    ctx.globalAlpha = 0.10; drawSegment(ctx, rWrist, bladeTip, 36, '#2255cc')
    ctx.globalAlpha = 0.22; drawSegment(ctx, rWrist, bladeTip, 24, '#3366ee')
    ctx.globalAlpha = 0.45; drawSegment(ctx, rWrist, bladeTip, 14, '#5588ff')
    ctx.globalAlpha = 0.75; drawSegment(ctx, rWrist, bladeTip, 7,  '#99bbff')
    ctx.globalAlpha = 1.00; drawSegment(ctx, rWrist, bladeTip, 3,  '#ffffff')
    ctx.restore()

    const hiltLen = faLen * 0.45
    const hiltStart: Point = { x: rWrist.x - nx * hiltLen, y: rWrist.y - ny * hiltLen }
    drawSegment(ctx, hiltStart, rWrist, 14, '#1a1a2e')
    drawSegment(ctx, hiltStart, rWrist, 10, '#2a2a4a')
    const emitA: Point = { x: rWrist.x - nx * 5, y: rWrist.y - ny * 5 }
    const emitB: Point = { x: rWrist.x + nx * 5, y: rWrist.y + ny * 5 }
    drawSegment(ctx, emitA, emitB, 16, '#334466')
  }
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  avatarImg: HTMLImageElement | null,
  w: number,
  h: number,
  colors?: { skin?: string; shirt?: string; pants?: string }
) {
  if (landmarks.length < 29) return

  const SKIN = colors?.skin ?? '#c8966b'
  const SHIRT = colors?.shirt ?? '#4a5568'
  const PANTS = colors?.pants ?? '#2b3a8a'

  const lShoulder = lm2px(landmarks[11], w, h)
  const rShoulder = lm2px(landmarks[12], w, h)
  const lElbow    = lm2px(landmarks[13], w, h)
  const rElbow    = lm2px(landmarks[14], w, h)
  const lWrist    = lm2px(landmarks[15], w, h)
  const rWrist    = lm2px(landmarks[16], w, h)
  const lHip      = lm2px(landmarks[23], w, h)
  const rHip      = lm2px(landmarks[24], w, h)
  const lKnee     = lm2px(landmarks[25], w, h)
  const rKnee     = lm2px(landmarks[26], w, h)
  const lAnkle    = lm2px(landmarks[27], w, h)
  const rAnkle    = lm2px(landmarks[28], w, h)

  const shoulderWidth = Math.hypot(rShoulder.x - lShoulder.x, rShoulder.y - lShoulder.y)
  const limbThick = Math.max(10, shoulderWidth * 0.18)
  const torsoThick = Math.max(20, shoulderWidth * 0.7)

  const sMid: Point = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 }
  const hMid: Point = { x: (lHip.x + rHip.x) / 2,          y: (lHip.y + rHip.y) / 2 }

  drawSegment(ctx, sMid, hMid, torsoThick, SHIRT)
  drawSegment(ctx, lShoulder, lElbow, limbThick, SKIN)
  drawSegment(ctx, lElbow, lWrist, limbThick, SKIN)
  drawSegment(ctx, rShoulder, rElbow, limbThick, SKIN)
  drawSegment(ctx, rElbow, rWrist, limbThick, SKIN)
  drawSegment(ctx, lHip, lKnee, limbThick, PANTS)
  drawSegment(ctx, lKnee, lAnkle, limbThick, PANTS)
  drawSegment(ctx, rHip, rKnee, limbThick, PANTS)
  drawSegment(ctx, rKnee, rAnkle, limbThick, PANTS)

  // Lightsaber on right hand
  const forearmDx = rWrist.x - rElbow.x
  const forearmDy = rWrist.y - rElbow.y
  const forearmLen = Math.hypot(forearmDx, forearmDy)
  if (forearmLen > 0) {
    const nx = forearmDx / forearmLen
    const ny = forearmDy / forearmLen
    const bladeLen = forearmLen * 2.5
    const bladeTip: Point = { x: rWrist.x + nx * bladeLen, y: rWrist.y + ny * bladeLen }

    ctx.save()
    ctx.globalAlpha = 0.10; drawSegment(ctx, rWrist, bladeTip, 36, '#2255cc')
    ctx.globalAlpha = 0.22; drawSegment(ctx, rWrist, bladeTip, 24, '#3366ee')
    ctx.globalAlpha = 0.45; drawSegment(ctx, rWrist, bladeTip, 14, '#5588ff')
    ctx.globalAlpha = 0.75; drawSegment(ctx, rWrist, bladeTip, 7, '#99bbff')
    ctx.globalAlpha = 1.00; drawSegment(ctx, rWrist, bladeTip, 3, '#ffffff')
    ctx.restore()

    const hiltLen = forearmLen * 0.45
    const hiltStart: Point = { x: rWrist.x - nx * hiltLen, y: rWrist.y - ny * hiltLen }
    drawSegment(ctx, hiltStart, rWrist, 14, '#1a1a2e')
    drawSegment(ctx, hiltStart, rWrist, 10, '#2a2a4a')
    const emitA: Point = { x: rWrist.x - nx * 5, y: rWrist.y - ny * 5 }
    const emitB: Point = { x: rWrist.x + nx * 5, y: rWrist.y + ny * 5 }
    drawSegment(ctx, emitA, emitB, 16, '#334466')
  }

  // Head
  const nose = lm2px(landmarks[0], w, h)
  const headSize = Math.max(40, shoulderWidth * 0.9)
  if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(avatarImg, nose.x - headSize / 2, nose.y - headSize / 2, headSize, headSize)
  } else {
    ctx.fillStyle = SKIN
    ctx.fillRect(nose.x - headSize / 2, nose.y - headSize / 2, headSize, headSize)
  }
}

const DISPLAY_SCALE = 0.75

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  avatarUrl: string | null
  detectLoop: (onFrame: (lms: PoseLandmark[]) => void) => () => void
  firstPerson?: boolean
  blockingRef?: React.RefObject<boolean>
}

export function useCharacterCanvas({ videoRef, avatarUrl, detectLoop, firstPerson, blockingRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestLandmarksRef = useRef<PoseLandmark[]>([])
  const avatarImgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!avatarUrl) { avatarImgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = avatarUrl
    avatarImgRef.current = img
    return () => { avatarImgRef.current = null }
  }, [avatarUrl])

  const onFrame = useCallback((landmarks: PoseLandmark[]) => {
    latestLandmarksRef.current = landmarks
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (firstPerson) {
      // Match canvas to display dimensions for crisp first-person rendering
      const dw = canvas.clientWidth || 640
      const dh = canvas.clientHeight || 480
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw
        canvas.height = dh
      }
      ctx.clearRect(0, 0, dw, dh)
      drawFirstPersonArms(ctx, landmarks, dw, dh, blockingRef?.current ?? false)
      return
    }

    // Third-person mode (original)
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    const S = DISPLAY_SCALE
    const scaledW = w * S
    const scaledH = h * S
    const offsetX = (w - scaledW) / 2
    const offsetY = (h - scaledH) / 2

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -(offsetX + scaledW), offsetY, scaledW, scaledH)
    ctx.restore()

    const off = (1 - S) / 2
    const adjusted = landmarks.map(lm => ({
      ...lm,
      x: off + (1 - lm.x) * S,
      y: off + lm.y * S,
    }))
    drawCharacter(ctx, adjusted, avatarImgRef.current, w, h)
  }, [videoRef, firstPerson, blockingRef])

  useEffect(() => {
    return detectLoop(onFrame)
  }, [detectLoop, onFrame])

  return { canvasRef, latestLandmarksRef }
}
