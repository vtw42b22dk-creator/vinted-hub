'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/AuthContext'

export default function SyncBanner() {
  const auth = useAuth()
  const [linked, setLinked] = useState<boolean | null>(null)

  useEffect(() => {
    if (!auth.user) return

    async function broadcastConfig() {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('sync_secret')
        .eq('id', auth.user!.id)
        .maybeSingle()

      if (!profile?.sync_secret) {
        setLinked(false)
        return
      }

      window.postMessage(
        {
          type: 'VINTED_HUB_CONFIG',
          syncSecret: profile.sync_secret,
        },
        '*'
      )
      setLinked(true)
    }

    broadcastConfig()
    const id = setInterval(broadcastConfig, 15000)
    return () => clearInterval(id)
  }, [auth.user])

  if (!auth.user || linked === null) return null

  if (linked) {
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-800">
        Extensão: sync automático ativo (10s) — mantém <strong>vinted.pt</strong> aberta
      </div>
    )
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Liga a extensão em <Link href="/setup" className="font-medium underline">/setup</Link> e recarrega-a no Chrome
    </div>
  )
}
