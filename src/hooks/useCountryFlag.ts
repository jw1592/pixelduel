import { useEffect, useState } from 'react'

function toFlagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

export function useCountryFlag() {
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [flag, setFlag] = useState<string>('')

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const code = data.country_code as string
        setCountryCode(code)
        setFlag(toFlagEmoji(code))
      })
      .catch(() => {
        // Silently fail — flag stays empty
      })
  }, [])

  return { countryCode, flag }
}
