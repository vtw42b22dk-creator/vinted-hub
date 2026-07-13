'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import InvestimentoPanel from '@/components/investimento/InvestimentoPanel'
import { createClient } from '@/lib/supabase/client'
import { loadInvestimento } from '@/lib/investimento-queries'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Compra } from '@/lib/types'

export default function InvestimentoPageClient() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const rows = await loadInvestimento(supabase)
      setCompras(rows)
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para criar a tabela de investimento.')
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
          <AutoRefresh intervalMs={15000} onRefresh={load} />
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Investimento</h2>
              <p className="mt-1 text-sm text-slate-500">
                As tuas compras na Vinted, sincronizadas automaticamente. Marca uma peça como vendida
                para registares o lucro.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <InvestimentoPanel compras={compras} onRefresh={load} />
          </div>
        </>
      )}
    </AppShell>
  )
}
