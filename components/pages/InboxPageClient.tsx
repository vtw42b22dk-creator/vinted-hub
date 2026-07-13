'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import { InboxList, LiveIndicator } from '@/components/inbox/InboxPanel'
import { createClient } from '@/lib/supabase/client'
import { loadConversas } from '@/lib/inbox-queries'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Conversa } from '@/lib/types'
import { ordenarConversas } from '@/lib/utils'

export default function InboxPageClient() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const rows = await loadConversas(supabase)
      setConversas(ordenarConversas(rows) as Conversa[])
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para actualizar a base de dados.')
    }
    setLoading(false)
  }, [])

  const liveStatus = useSupabaseRealtime(load, ['conversas'])

  useEffect(() => {
    load()
  }, [load])

  return (
    <AppShell>
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">A carregar…</p>
        </div>
      ) : (
        <>
          <AutoRefresh intervalMs={10000} onRefresh={load} />
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Mensagens & Negociações</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Adiciona conversas com o botão <strong>＋ Dashboard</strong> na inbox da Vinted —
                  aqui podes tirar apontamentos em cada uma.
                </p>
              </div>
              <LiveIndicator status={liveStatus} />
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <InboxList conversas={conversas} onRefresh={load} />
          </div>
        </>
      )}
    </AppShell>
  )
}
