import type { PoseLandmark } from '../types'

function zero(): PoseLandmark { return { x: 0, y: 0, z: 0 } }

function makePose(
  nose: [number, number],
  lShoulder: [number, number],
  rShoulder: [number, number],
  lElbow: [number, number],
  rElbow: [number, number],
  lWrist: [number, number],
  rWrist: [number, number],
): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 29 }, zero)
  lms[0]  = { x: nose[0],      y: nose[1],      z: 0 }
  lms[11] = { x: lShoulder[0], y: lShoulder[1], z: 0 }
  lms[12] = { x: rShoulder[0], y: rShoulder[1], z: 0 }
  lms[13] = { x: lElbow[0],    y: lElbow[1],    z: 0 }
  lms[14] = { x: rElbow[0],    y: rElbow[1],    z: 0 }
  lms[15] = { x: lWrist[0],    y: lWrist[1],    z: 0 }
  lms[16] = { x: rWrist[0],    y: rWrist[1],    z: 0 }
  // hips, knees, ankles — fixed stance
  lms[23] = { x: 0.40, y: 0.58, z: 0 }
  lms[24] = { x: 0.60, y: 0.58, z: 0 }
  lms[25] = { x: 0.40, y: 0.76, z: 0 }
  lms[26] = { x: 0.60, y: 0.76, z: 0 }
  lms[27] = { x: 0.40, y: 0.93, z: 0 }
  lms[28] = { x: 0.60, y: 0.93, z: 0 }
  return lms
}

// Neutral fighting stance
export const IDLE_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28], [0.62, 0.28],
  [0.30, 0.45], [0.70, 0.45],
  [0.30, 0.60], [0.70, 0.60],
)

// Weight shifted left — idle sway variation
export const IDLE_SWAY_L: PoseLandmark[] = makePose(
  [0.48, 0.13],
  [0.36, 0.27], [0.60, 0.30],
  [0.28, 0.44], [0.68, 0.47],
  [0.28, 0.59], [0.68, 0.62],
)

// Weight shifted right — idle sway variation
export const IDLE_SWAY_R: PoseLandmark[] = makePose(
  [0.52, 0.13],
  [0.40, 0.30], [0.64, 0.27],
  [0.32, 0.47], [0.72, 0.44],
  [0.32, 0.62], [0.72, 0.59],
)

// Overhead slash — rWrist raised well above shoulder (head attack zone)
export const ATTACK_HEAD_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28], [0.60, 0.24],
  [0.30, 0.45], [0.76, 0.10],
  [0.30, 0.60], [0.92, 0.06],
)

// Forward thrust — rWrist extended at body level
export const ATTACK_BODY_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28], [0.62, 0.28],
  [0.30, 0.45], [0.82, 0.32],
  [0.30, 0.60], [0.92, 0.40],
)

// Shield high — lWrist above shoulder (head block zone: y < shoulder + torsoH*0.15 = 0.325)
export const BLOCK_HEAD_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28], [0.62, 0.28],
  [0.28, 0.16], [0.70, 0.45],
  [0.36, 0.06], [0.70, 0.60],
)

// Shield at chest — lWrist at mid-torso (body block zone: y < shoulder + torsoH*0.70 = 0.49)
export const BLOCK_BODY_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28], [0.62, 0.28],
  [0.28, 0.36], [0.70, 0.45],
  [0.35, 0.44], [0.70, 0.60],
)
