const TURN_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: '0a766fef78e64f2a56c10dec', credential: 'xzN1Dy35fl5G7Nhn' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '0a766fef78e64f2a56c10dec', credential: 'xzN1Dy35fl5G7Nhn' },
  { urls: 'turn:global.relay.metered.ca:443', username: '0a766fef78e64f2a56c10dec', credential: 'xzN1Dy35fl5G7Nhn' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '0a766fef78e64f2a56c10dec', credential: 'xzN1Dy35fl5G7Nhn' },
]

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(
      `https://pixeldual.metered.live/api/v1/turn/credentials?apiKey=${import.meta.env.VITE_METERED_API_KEY}`
    )
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    const servers = await res.json() as RTCIceServer[]
    console.log('[iceServers] fetched:', servers.length, 'servers')
    return servers
  } catch (e) {
    console.warn('[iceServers] API failed, using fallback TURN:', e)
    return TURN_FALLBACK
  }
}
