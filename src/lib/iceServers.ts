export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(
      `https://pixeldual.metered.live/api/v1/turn/credentials?apiKey=${import.meta.env.VITE_METERED_API_KEY}`
    )
    if (!res.ok) throw new Error('fetch failed')
    return await res.json() as RTCIceServer[]
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }]
  }
}
