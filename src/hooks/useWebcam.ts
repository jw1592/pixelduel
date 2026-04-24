import { useRef, useState, useCallback, useEffect } from 'react'

export type WebcamStatus = 'idle' | 'requesting' | 'granted' | 'denied'

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<WebcamStatus>('idle')

  const start = useCallback(async () => {
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('granted')
    } catch {
      setStatus('denied')
    }
  }, [])

  const stop = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setStatus('idle')
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, status, start, stop }
}
