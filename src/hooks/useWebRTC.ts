import { useEffect, useRef, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchIceServers } from '../lib/iceServers'
import type { GameMessage, WebRTCSignal } from '../types'

interface Props {
  enabled: boolean
  user: User
  matchId: string
  player1Id: string
  player2Id: string
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onMessage: (msg: GameMessage) => void
}

export function useWebRTC({ enabled, user, matchId, player1Id, canvasRef, onMessage }: Props) {
  const [connected, setConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const isPlayer1 = user.id === player1Id

  const sendMessage = useCallback((msg: GameMessage) => {
    const dc = dcRef.current
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let aborted = false
    let pc: RTCPeerConnection | undefined
    let signalChannel: ReturnType<typeof supabase.channel> | undefined

    const setup = async () => {
      const iceServers = await fetchIceServers()
      if (aborted) return

      pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      // Add canvas stream (video only)
      const canvas = canvasRef.current
      if (canvas) {
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30)
        stream.getVideoTracks().forEach(t => pc!.addTrack(t, stream))
      }

      // Remote stream → video element
      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0]
        }
      }

      const onDataChannelOpen = (dc: RTCDataChannel) => {
        if (aborted) return
        dcRef.current = dc
        dc.onmessage = (e) => {
          try { onMessage(JSON.parse(e.data) as GameMessage) } catch { /* ignore */ }
        }
        setConnected(true)
      }

      if (isPlayer1) {
        const dc = pc.createDataChannel('game')
        dc.onopen = () => onDataChannelOpen(dc)
      } else {
        pc.ondatachannel = (e) => { e.channel.onopen = () => onDataChannelOpen(e.channel) }
      }

      // Assign signalChannel BEFORE setting onicecandidate (Bug 3 fix)
      signalChannel = supabase.channel(`signal-${matchId}`)

      // ICE candidates — now signalChannel is assigned
      pc.onicecandidate = (e) => {
        if (e.candidate && signalChannel) {
          signalChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice', candidate: e.candidate.toJSON() } as WebRTCSignal,
          })
        }
      }

      signalChannel
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          if (!pc) return
          try {
            const signal = payload as WebRTCSignal
            if (signal.type === 'offer' && !isPlayer1) {
              await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              signalChannel!.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer.sdp! } as WebRTCSignal })
            } else if (signal.type === 'answer' && isPlayer1) {
              await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
            } else if (signal.type === 'ice') {
              await pc.addIceCandidate(signal.candidate).catch(() => {})
            }
          } catch (err) {
            console.error('[useWebRTC] signaling error:', err)
          }
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !pc || aborted) return
          if (isPlayer1) {
            try {
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              signalChannel!.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer.sdp! } as WebRTCSignal })
            } catch (err) {
              console.error('[useWebRTC] offer error:', err)
            }
          }
        })
    }

    setup()

    return () => {
      aborted = true
      pcRef.current?.close()
      pcRef.current = null
      dcRef.current = null
      setConnected(false)
      if (signalChannel) supabase.removeChannel(signalChannel)
    }
  }, [enabled, matchId, isPlayer1, canvasRef, onMessage])  // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, sendMessage, remoteVideoRef }
}
