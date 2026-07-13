'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import AnalyticsPanel from '@/components/analytics/AnalyticsPanel'
import { createClient } from '@/lib/supabase/client'
import { loadInvestimento } from '@/lib/investimento-queries'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Compra } from '@/lib/types'

export default function AnalyticsPageClient() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const c = await loadInvestimento(supabase)
      setCompras(c)
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para ativar a análise.')
    }
    setLoading(false)
  }, [])

  useSupabaseRealtime(load, ['investimento'])

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
          <AutoRefresh intervalMs={20000} onRefresh={load} />
          <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
              <p className="mt-1 text-sm text-slate-500">
                Análise do teu negócio: lucro, ROI, ritmo de compras e vendas.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <AnalyticsPanel compras={compras} />
          </div>
        </>
      )}
    </AppShell>
  )
}
