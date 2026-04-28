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
  // hips [23-24], knees [25-26], ankles [27-28] — fixed stance, same across all poses
  lms[23] = { x: 0.40, y: 0.58, z: 0 }
  lms[24] = { x: 0.60, y: 0.58, z: 0 }
  lms[25] = { x: 0.40, y: 0.76, z: 0 }
  lms[26] = { x: 0.60, y: 0.76, z: 0 }
  lms[27] = { x: 0.40, y: 0.93, z: 0 }
  lms[28] = { x: 0.60, y: 0.93, z: 0 }
  return lms
}

export const IDLE_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],  // nose
  [0.38, 0.28],  // lShoulder
  [0.62, 0.28],  // rShoulder
  [0.30, 0.45],  // lElbow
  [0.70, 0.45],  // rElbow
  [0.30, 0.60],  // lWrist
  [0.70, 0.60],  // rWrist
)

export const ATTACK_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28],
  [0.62, 0.28],
  [0.30, 0.45],
  [0.80, 0.22],  // rElbow raised and forward
  [0.30, 0.60],
  [0.92, 0.28],  // rWrist extended forward-up
)

export const BLOCK_POSE: PoseLandmark[] = makePose(
  [0.50, 0.12],
  [0.38, 0.28],
  [0.62, 0.28],
  [0.30, 0.45],
  [0.72, 0.30],  // rElbow raised
  [0.30, 0.60],
  [0.55, 0.22],  // rWrist across upper chest
)
