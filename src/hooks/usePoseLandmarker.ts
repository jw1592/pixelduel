import { useEffect, useRef, useState, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { PoseLandmark } from '../types'

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export type PoseLandmarkerStatus = 'loading' | 'ready' | 'error'

export function usePoseLandmarker(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const [status, setStatus] = useState<PoseLandmarkerStatus>('loading')

  useEffect(() => {
    let cancelled = false
    let localLm: PoseLandmarker | null = null
    ;(async () => {
      try {
        const fs = await FilesetResolver.forVisionTasks(WASM_CDN)
        let lm: PoseLandmarker
        try {
          lm = await PoseLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        } catch {
          lm = await PoseLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        }
        localLm = lm
        if (!cancelled) {
          landmarkerRef.current = lm
          setStatus('ready')
        } else {
          lm.close()
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      localLm?.close()
      landmarkerRef.current = null
    }
  }, [])

  const detectLoop = useCallback(
    (onFrame: (landmarks: PoseLandmark[]) => void) => {
      let rafId: number
      const detect = () => {
        const video = videoRef.current
        if (video && video.readyState === 4 && landmarkerRef.current) {
          const result = landmarkerRef.current.detectForVideo(video, performance.now())
          onFrame(result.landmarks[0] ?? [])
        }
        rafId = requestAnimationFrame(detect)
      }
      rafId = requestAnimationFrame(detect)
      return () => cancelAnimationFrame(rafId)
    },
    [videoRef]
  )

  return { status, detectLoop }
}
