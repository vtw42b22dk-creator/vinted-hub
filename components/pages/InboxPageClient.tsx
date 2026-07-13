'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import { InboxList, PastasBar } from '@/components/inbox/InboxPanel'
import { createClient } from '@/lib/supabase/client'
import { loadConversas, loadPastas } from '@/lib/inbox-queries'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Conversa, PastaConversas } from '@/lib/types'
import { ordenarConversas } from '@/lib/utils'

export default function InboxPageClient() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [pastas, setPastas] = useState<PastaConversas[]>([])
  const [activePasta, setActivePasta] = useState<string | null | 'todas'>('todas')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const [rows, folders] = await Promise.all([loadConversas(supabase), loadPastas(supabase)])
      setConversas(ordenarConversas(rows) as Conversa[])
      setPastas(folders)
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para actualizar a base de dados.')
    }
    setLoading(false)
  }, [])

  useSupabaseRealtime(load, ['conversas', 'pastas_conversas'])

  useEffect(() => {
    load()
  }, [load])

  const visiveis =
    activePasta === 'todas'
      ? conversas
      : conversas.filter((c) => (c.pasta_id ?? null) === activePasta)

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
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Mensagens & Negociações</h2>
              <p className="mt-1 text-sm text-slate-500">
                Adiciona conversas com o botão no canto do ecrã na Vinted e organiza-as em pastas.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <PastasBar
              pastas={pastas}
              conversas={conversas}
              activePasta={activePasta}
              onSelect={setActivePasta}
              onRefresh={load}
            />

            <InboxList conversas={visiveis} pastas={pastas} onRefresh={load} />
          </div>
        </>
      )}
    </AppShell>
  )
}
