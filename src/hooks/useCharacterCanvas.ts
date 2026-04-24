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

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  avatarImg: HTMLImageElement | null,
  w: number,
  h: number
) {
  if (landmarks.length < 29) return

  const SKIN = '#c8966b'
  const SHIRT = '#4a5568'
  const PANTS = '#2b3a8a'
  const SWORD = '#d4d4d4'

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

  // Torso
  drawSegment(ctx, sMid, hMid, torsoThick, SHIRT)
  // Arms
  drawSegment(ctx, lShoulder, lElbow, limbThick, SKIN)
  drawSegment(ctx, lElbow, lWrist, limbThick, SKIN)
  drawSegment(ctx, rShoulder, rElbow, limbThick, SKIN)
  drawSegment(ctx, rElbow, rWrist, limbThick, SKIN)
  // Legs
  drawSegment(ctx, lHip, lKnee, limbThick, PANTS)
  drawSegment(ctx, lKnee, lAnkle, limbThick, PANTS)
  drawSegment(ctx, rHip, rKnee, limbThick, PANTS)
  drawSegment(ctx, rKnee, rAnkle, limbThick, PANTS)

  // Sword on right hand
  const forearmDx = rWrist.x - rElbow.x
  const forearmDy = rWrist.y - rElbow.y
  const forearmLen = Math.hypot(forearmDx, forearmDy)
  if (forearmLen > 0) {
    const swordLen = forearmLen * 2.2
    const nx = forearmDx / forearmLen
    const ny = forearmDy / forearmLen
    const swordTip: Point = { x: rWrist.x + nx * swordLen, y: rWrist.y + ny * swordLen }
    drawSegment(ctx, rWrist, swordTip, 10, SWORD)
    drawSegment(ctx, rWrist, swordTip, 5, '#ffffff')
  }

  // Head (avatar image or fallback colored block)
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

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  avatarUrl: string | null
  detectLoop: (onFrame: (lms: PoseLandmark[]) => void) => () => void
}

export function useCharacterCanvas({ videoRef, avatarUrl, detectLoop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestLandmarksRef = useRef<PoseLandmark[]>([])
  const avatarImgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!avatarUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = avatarUrl
    avatarImgRef.current = img
  }, [avatarUrl])

  const onFrame = useCallback((landmarks: PoseLandmark[]) => {
    latestLandmarksRef.current = landmarks
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    const ctx = canvas.getContext('2d')!
    // Mirror the webcam feed as background
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    ctx.restore()

    // Overlay character (landmarks are already mirrored since FacingMode=user mirrors the feed)
    const mirrored = landmarks.map(lm => ({ ...lm, x: 1 - lm.x }))
    drawCharacter(ctx, mirrored, avatarImgRef.current, w, h)
  }, [videoRef])

  useEffect(() => {
    return detectLoop(onFrame)
  }, [detectLoop, onFrame])

  return { canvasRef, latestLandmarksRef }
}

export { drawCharacter }
