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
    let offerSent = false

    const setup = async () => {
      const iceServers = await fetchIceServers()
      if (aborted) return

      pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      pc.oniceconnectionstatechange = () => console.log('[webrtc] ICE state:', pc?.iceConnectionState)
      pc.onconnectionstatechange = () => console.log('[webrtc] connection state:', pc?.connectionState)

      const canvas = canvasRef.current
      console.log('[webrtc] canvas:', canvas, '| isPlayer1:', isPlayer1)
      if (canvas) {
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30)
        const tracks = stream.getVideoTracks()
        console.log('[webrtc] video tracks to add:', tracks.length)
        tracks.forEach(t => pc!.addTrack(t, stream))
      }

      pc.ontrack = (e) => {
        console.log('[webrtc] ontrack fired — streams:', e.streams.length, 'tracks:', e.track.kind)
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

      signalChannel = supabase.channel(`signal-${matchId}`, {
        config: { presence: { key: user.id } },
      })

      pc.onicecandidate = (e) => {
        if (e.candidate && signalChannel) {
          signalChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice', candidate: e.candidate.toJSON() } as WebRTCSignal,
          })
        }
      }

      const sendOffer = async () => {
        if (!pc || offerSent || aborted) return
        offerSent = true
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          signalChannel!.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', sdp: offer.sdp! } as WebRTCSignal })
          console.log('[webrtc] offer sent')
        } catch (err) {
          console.error('[webrtc] offer error:', err)
        }
      }

      console.log('[webrtc] subscribing to signal channel:', `signal-${matchId}`)
      signalChannel
        // Player1 waits for player2's presence before sending offer — fixes signaling race condition
        .on('presence', { event: 'sync' }, () => {
          if (!isPlayer1) return
          const others = Object.keys(signalChannel!.presenceState()).filter(k => k !== user.id)
          console.log('[webrtc] presence sync, others in channel:', others.length)
          if (others.length > 0) sendOffer()
        })
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          if (!pc) return
          try {
            const signal = payload as WebRTCSignal
            if (signal.type === 'offer' && !isPlayer1) {
              await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              signalChannel!.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', sdp: answer.sdp! } as WebRTCSignal })
              console.log('[webrtc] answer sent')
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
          console.log('[webrtc] signal channel status:', status, '| isPlayer1:', isPlayer1)
          if (status !== 'SUBSCRIBED' || !pc || aborted) return
          await signalChannel!.track({ user_id: user.id })
          console.log('[webrtc] presence tracked')
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
  }, [enabled, matchId, isPlayer1, user.id, canvasRef, onMessage])  // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, sendMessage, remoteVideoRef }
}
