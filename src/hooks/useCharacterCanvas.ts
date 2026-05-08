import { useRef, useEffect, useCallback } from 'react'
import type { PoseLandmark } from '../types'
import { BATTLE_BACKGROUNDS, drawBackground } from '../data/battleBackgrounds'
import type { BattleBackground } from '../data/battleBackgrounds'

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

function drawShield(ctx: CanvasRenderingContext2D, center: Point, size: number, blocking: boolean, isEnemy?: boolean) {
  ctx.save()
  if (blocking) {
    ctx.shadowColor = isEnemy ? '#ff4422' : '#60a5fa'
    ctx.shadowBlur = 24
  }
  // Outer body
  ctx.beginPath()
  ctx.arc(center.x, center.y, size, 0, Math.PI * 2)
  ctx.fillStyle = isEnemy ? '#2a1a1a' : '#8a7a6a'
  ctx.fill()
  // Inner plate
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = isEnemy ? '#1a0808' : '#5a4a3a'
  ctx.fill()
  // Cross detail
  ctx.strokeStyle = isEnemy ? '#5a2a2a' : '#7a6a5a'
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
  ctx.strokeStyle = blocking ? (isEnemy ? '#ff6644' : '#93c5fd') : (isEnemy ? '#8b3a2a' : '#b09a70')
  ctx.lineWidth = blocking ? 4 : 2.5
  ctx.stroke()
  // Boss
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = isEnemy ? '#cc3322' : '#c8a860'
  ctx.fill()
  ctx.restore()
}

function drawFaceInHead(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  origLms: PoseLandmark[],
  scaledLms: PoseLandmark[],
  w: number,
  h: number,
) {
  if (origLms.length < 13 || video.readyState < 2) return

  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 480

  const nose = scaledLms[0]
  const lS = scaledLms[11]
  const rS = scaledLms[12]
  const shoulderW = Math.abs(rS.x - lS.x) * w
  const headR = Math.max(22, shoulderW * 0.45)
  const headCx = nose.x * w
  const headCy = (nose.y - 0.02) * h

  const origNose = origLms[0]
  const origLEar = origLms[7]
  const origREar = origLms[8]
  const earDist = Math.abs(origLEar.x - origREar.x) * vw
  const faceSize = Math.max(80, earDist * 2.8)
  const sx = Math.max(0, origNose.x * vw - faceSize / 2)
  const sy = Math.max(0, (origNose.y - 0.03) * vh - faceSize * 0.55)
  const sw = Math.min(faceSize, vw - sx)
  const sh = Math.min(faceSize * 1.1, vh - sy)
  if (sw <= 0 || sh <= 0) return

  ctx.save()
  // Dark background fills square corners before clip
  ctx.beginPath()
  ctx.arc(headCx, headCy, headR + 3, 0, Math.PI * 2)
  ctx.fillStyle = '#111'
  ctx.fill()
  // Clip to circle
  ctx.beginPath()
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2)
  ctx.clip()
  // Flip face horizontally to match mirrored avatar orientation
  ctx.translate(headCx, headCy)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, -headR, -headR, headR * 2, headR * 2)
  ctx.restore()
  // Border ring
  ctx.beginPath()
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(200,170,120,0.7)'
  ctx.lineWidth = 2.5
  ctx.stroke()
}

// First-person coordinate mapping
// Camera y [0,1] top→bottom, x mirrored for natural self-view
const FP_ZOOM = 1.3
const FP_CX = 0.5
const FP_CY = 0.5
const FP_Y_OFFSET = 0.66

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
  drawShield(ctx, lWrist, limbThick * 4.0, blocking)

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
  colors?: { skin?: string; shirt?: string; pants?: string },
  isBlocking?: boolean,
  upperBodyOnly?: boolean,
  isEnemy?: boolean
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
  if (!upperBodyOnly) {
    drawSegment(ctx, lHip, lKnee, limbThick, PANTS)
    drawSegment(ctx, lKnee, lAnkle, limbThick, PANTS)
    drawSegment(ctx, rHip, rKnee, limbThick, PANTS)
    drawSegment(ctx, rKnee, rAnkle, limbThick, PANTS)
  }

  // Lightsaber on right hand
  const forearmDx = rWrist.x - rElbow.x
  const forearmDy = rWrist.y - rElbow.y
  const forearmLen = Math.hypot(forearmDx, forearmDy)
  if (forearmLen > 0) {
    const nx = forearmDx / forearmLen
    const ny = forearmDy / forearmLen
    const bladeLen = forearmLen * 2.5
    const bladeTip: Point = { x: rWrist.x + nx * bladeLen, y: rWrist.y + ny * bladeLen }

    const [c1, c2, c3, c4] = isEnemy
      ? ['#cc2200', '#ee3311', '#ff5533', '#ffaa88']
      : ['#2255cc', '#3366ee', '#5588ff', '#99bbff']
    ctx.save()
    ctx.globalAlpha = 0.10; drawSegment(ctx, rWrist, bladeTip, 36, c1)
    ctx.globalAlpha = 0.22; drawSegment(ctx, rWrist, bladeTip, 24, c2)
    ctx.globalAlpha = 0.45; drawSegment(ctx, rWrist, bladeTip, 14, c3)
    ctx.globalAlpha = 0.75; drawSegment(ctx, rWrist, bladeTip, 7, c4)
    ctx.globalAlpha = 1.00; drawSegment(ctx, rWrist, bladeTip, 3, '#ffffff')
    ctx.restore()

    const hiltLen = forearmLen * 0.45
    const hiltStart: Point = { x: rWrist.x - nx * hiltLen, y: rWrist.y - ny * hiltLen }
    drawSegment(ctx, hiltStart, rWrist, 14, '#1a1a2e')
    drawSegment(ctx, hiltStart, rWrist, 10, '#2a2a4a')
    const emitA: Point = { x: rWrist.x - nx * 5, y: rWrist.y - ny * 5 }
    const emitB: Point = { x: rWrist.x + nx * 5, y: rWrist.y + ny * 5 }
    drawSegment(ctx, emitA, emitB, 16, isEnemy ? '#441111' : '#334466')
  }

  // Shield on left wrist
  const shieldSize = Math.max(20, limbThick * 2.8)
  drawShield(ctx, lWrist, shieldSize, !!isBlocking, isEnemy)

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
  isPlayer1?: boolean
}

export function useCharacterCanvas({ videoRef, avatarUrl, detectLoop, firstPerson, blockingRef, isPlayer1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null)
  const latestLandmarksRef = useRef<PoseLandmark[]>([])
  const avatarImgRef = useRef<HTMLImageElement | null>(null)
  const bgRef = useRef<BattleBackground>(
    BATTLE_BACKGROUNDS[Math.floor(Math.random() * BATTLE_BACKGROUNDS.length)]
  )

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

      // Avatar canvas — composited stream for WebRTC transmission
      const avatarCanvas = avatarCanvasRef.current
      if (avatarCanvas && landmarks.length >= 29) {
        const actx = avatarCanvas.getContext('2d')
        if (actx) {
          const aw = 640, ah = 480
          if (avatarCanvas.width !== aw) avatarCanvas.width = aw
          if (avatarCanvas.height !== ah) avatarCanvas.height = ah
          // Scale character to ~75% so background is visible above/sides — gives depth feel
          const ZOOM = 0.75, cx = 0.5
          const scaled = landmarks.map(lm => ({
            ...lm,
            x: ((1 - lm.x) - cx) * ZOOM + cx,
            y: lm.y * ZOOM,
          }))
          // Player1 = blue team, player2 = red team
          const teamColors = isPlayer1 !== false
            ? { skin: '#c8966b', shirt: '#2a4a8a', pants: '#1a2a5a' }
            : { skin: '#9a6040', shirt: '#8a2a2a', pants: '#4a1a1a' }
          const isEnemy = isPlayer1 === false
          drawBackground(actx, bgRef.current, aw, ah)
          drawCharacter(actx, scaled, null, aw, ah, teamColors, blockingRef?.current ?? false, false, isEnemy)
          drawFaceInHead(actx, video, landmarks, scaled, aw, ah)
        }
      }
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

  return { canvasRef, avatarCanvasRef, latestLandmarksRef }
}
