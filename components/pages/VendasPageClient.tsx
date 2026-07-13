'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import VendasPanel from '@/components/vendas/VendasPanel'
import { createClient } from '@/lib/supabase/client'
import { loadVendas } from '@/lib/vendas-queries'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Venda } from '@/lib/types'

export default function VendasPageClient() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    try {
      const rows = await loadVendas(supabase)
      setVendas(rows)
      setError(null)
    } catch {
      setError('Executa supabase/sync-rpc.sql no Supabase para criar a tabela de vendas.')
    }
    setLoading(false)
  }, [])

  useSupabaseRealtime(load, ['vendas'])

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
              <h2 className="text-2xl font-bold text-slate-900">Vendas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tudo o que já vendeste na Vinted. Seleciona peças para somar o que ganhaste com elas.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <VendasPanel vendas={vendas} />
          </div>
        </>
      )}
    </AppShell>
  )
}
