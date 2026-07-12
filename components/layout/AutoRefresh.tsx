'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AutoRefreshProps {
  intervalMs?: number
}

export default function AutoRefresh({ intervalMs = 30000 }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    function tick() {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
