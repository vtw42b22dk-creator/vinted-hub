'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import RelevantesPanel from '@/components/relevantes/RelevantesPanel'
import { createClient } from '@/lib/supabase/client'
import { loadRelevantes } from '@/lib/relevantes-queries'
import type { Relevante } from '@/lib/types'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'

export default function RelevantesPageClient() {
  const [relevantes, setRelevantes] = useState<Relevante[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const rows = await loadRelevantes(supabase)
      setRelevantes(rows)
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para criar a tabela de relevantes.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useSupabaseRealtime(load, ['relevantes'])

  return (
    <AppShell>
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">A carregar…</p>
        </div>
      ) : (
        <>
          <AutoRefresh intervalMs={10000} onRefresh={load} />
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Anúncios relevantes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Artigos que queres comprar. Na Vinted, carrega na estrela ⭐ no canto de um anúncio e
                ele aparece aqui.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <RelevantesPanel relevantes={relevantes} onRefresh={load} />
          </div>
        </>
      )}
    </AppShell>
  )
}
