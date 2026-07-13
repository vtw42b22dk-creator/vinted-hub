'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/AuthContext'

// Componente invisível: envia o sync secret à extensão Chrome em qualquer página.
export default function SyncBanner() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.user) return

    async function broadcastConfig() {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('sync_secret')
        .eq('id', auth.user!.id)
        .maybeSingle()

      if (!profile?.sync_secret) return

      window.postMessage(
        {
          type: 'VINTED_HUB_CONFIG',
          syncSecret: profile.sync_secret,
        },
        '*'
      )
    }

    broadcastConfig()
    const id = setInterval(broadcastConfig, 15000)
    return () => clearInterval(id)
  }, [auth.user])

  return null
}
