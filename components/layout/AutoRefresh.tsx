'use client'

import { useEffect } from 'react'

interface AutoRefreshProps {
  intervalMs?: number
  onRefresh?: () => void
}

export default function AutoRefresh({ intervalMs = 30000, onRefresh }: AutoRefreshProps) {
  useEffect(() => {
    if (!onRefresh) return

    function tick() {
      if (document.visibilityState === 'visible') {
        onRefresh?.()
      }
    }

    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [onRefresh, intervalMs])

  return null
}
