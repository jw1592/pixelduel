const TURN_FALLBACK: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'turn:openrelay.metered.ca:80',              username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',             username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(
      `https://pixeldual.metered.live/api/v1/turn/credentials?apiKey=${import.meta.env.VITE_METERED_API_KEY}`
    )
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('invalid response')
    const servers = data as RTCIceServer[]
    console.log('[iceServers] fetched:', servers.length, 'servers')
    return servers
  } catch (e) {
    console.warn('[iceServers] API failed, using fallback TURN:', e)
    return TURN_FALLBACK
  }
}
