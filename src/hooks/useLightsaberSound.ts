import { useRef, useCallback, useEffect } from 'react'
import bgMusicSrc from '../assets/bg.mp3'

export function useLightsaberSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const bgmRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const unlock = () => {
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    }
    document.addEventListener('touchstart', unlock, { once: true, passive: true })
    document.addEventListener('click', unlock, { once: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
  }, [])

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const startHum = useCallback(() => {
    if (bgmRef.current) return
    const audio = new Audio(bgMusicSrc)
    audio.loop = true
    audio.volume = 0.12
    bgmRef.current = audio
    audio.play().catch(() => {})
  }, [])

  const stopHum = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.currentTime = 0
      bgmRef.current = null
    }
  }, [])

  const playSwing = useCallback(() => {
    const ctx = getCtx()
    const now = ctx.currentTime

    const bufferSize = Math.ceil(ctx.sampleRate * 0.32)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2.5
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.32)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.45, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start(now)
  }, [getCtx])

  const playHit = useCallback(() => {
    const ctx = getCtx()
    const now = ctx.currentTime

    // Distorted sawtooth crash
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18)

    const distortion = ctx.createWaveShaper()
    const samples = 256
    const curve = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x))
    }
    distortion.curve = curve

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.6, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc.connect(distortion)
    distortion.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.22)

    // Electrical crackle burst
    const bufSize = Math.ceil(ctx.sampleRate * 0.09)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.55, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now)
  }, [getCtx])

  return { startHum, stopHum, playSwing, playHit }
}
