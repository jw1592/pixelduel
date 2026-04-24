import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useCountryFlag } from '../hooks/useCountryFlag'
import { AVATARS } from '../data/avatars'

interface Props {
  user: User
}

export function ProfileEdit({ user }: Props) {
  const navigate = useNavigate()
  const { profile, loading, refreshProfile } = useProfile(user)
  const { flag } = useCountryFlag()

  const [name, setName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setName(profile.display_name)
      setSelectedAvatar(profile.avatar_url)
    }
  }, [profile])

  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [stream])

  const startWebcam = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true })
    setStream(s)
    setWebcamActive(true)
    setTimeout(() => {
      if (videoRef.current) videoRef.current.srcObject = s
    }, 50)
  }, [])

  const stopWebcam = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setWebcamActive(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    canvas.getContext('2d')!.drawImage(video, sx, sy, size, size, 0, 0, 128, 128)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    setCapturedPhoto(dataUrl)
    setSelectedAvatar(dataUrl)
    stopWebcam()
  }, [stopWebcam])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        avatar_url: selectedAvatar,
      })
      .eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    navigate('/')
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 text-xs">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-6 px-4 py-8">
      <h1 className="text-green-400 text-xl leading-loose text-center">
        EDIT PROFILE
      </h1>

      <div className="w-72 flex flex-col gap-2">
        <label className="text-gray-500 text-xs">DISPLAY NAME {flag}</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          className="bg-gray-900 border border-gray-700 text-white text-xs px-3 py-2 outline-none focus:border-green-500 w-full"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <label className="text-gray-500 text-xs">AVATAR</label>
        {selectedAvatar && (
          <img
            src={selectedAvatar}
            alt="selected avatar"
            className="w-16 h-16 border-2 border-green-500 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>

      <div className="w-72 flex flex-col gap-3">
        <p className="text-gray-500 text-xs">TAKE PHOTO</p>
        {!webcamActive ? (
          <button
            onClick={startWebcam}
            className="border border-gray-700 text-gray-400 hover:text-white text-xs px-4 py-2 cursor-pointer transition-colors"
          >
            Start Camera
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-48 h-36 object-cover border border-gray-700"
            />
            <div className="flex gap-3">
              <button
                onClick={capturePhoto}
                className="bg-green-500 hover:bg-green-400 text-black text-xs px-4 py-2 cursor-pointer"
              >
                Capture
              </button>
              <button
                onClick={stopWebcam}
                className="border border-gray-700 text-gray-500 hover:text-white text-xs px-4 py-2 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {capturedPhoto && (
          <p className="text-green-400 text-xs text-center">Photo captured</p>
        )}
      </div>

      <div className="w-72 flex flex-col gap-3">
        <p className="text-gray-500 text-xs">OR CHOOSE CHARACTER</p>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map(av => (
            <button
              key={av.id}
              onClick={() => { setSelectedAvatar(av.path); setCapturedPhoto(null) }}
              className={`border-2 p-1 cursor-pointer transition-colors ${
                selectedAvatar === av.path
                  ? 'border-green-500'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <img
                src={av.path}
                alt={av.name}
                className="w-full aspect-square object-cover"
                style={{ imageRendering: 'pixelated' }}
                title={av.name}
              />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black text-xs px-8 py-3 cursor-pointer transition-colors font-bold"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      <button
        onClick={() => navigate('/')}
        className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )
}
