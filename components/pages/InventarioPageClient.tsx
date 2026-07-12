'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import {
  InventarioFilters,
  InventarioMetricsCards,
  InventarioTable,
} from '@/components/inventario/InventarioPanel'
import { createClient } from '@/lib/supabase/client'
import type { ArtigoVinted } from '@/lib/types'
import { calcularMetricasVinted, filtrarArtigosInventario } from '@/lib/utils'

type FiltroInventario = 'a_venda' | 'vendidos' | 'todos'

function InventarioContent() {
  const searchParams = useSearchParams()
  const filtroRaw = searchParams.get('filtro') ?? 'a_venda'
  const filtro: FiltroInventario = ['a_venda', 'vendidos', 'todos'].includes(filtroRaw)
    ? (filtroRaw as FiltroInventario)
    : 'a_venda'

  const [todos, setTodos] = useState<ArtigoVinted[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('artigos_vinted_com_lucro')
      .select('*')
      .order('sincronizado_em', { ascending: false })

    setTodos((data ?? []) as ArtigoVinted[])
    setError(
      fetchError ? 'Não foi possível carregar o inventário. Executa o SQL no Supabase.' : null
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const artigos = filtrarArtigosInventario(todos, filtro)
  const metrics = calcularMetricasVinted(todos)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    )
  }

  return (
    <>
      <AutoRefresh intervalMs={30000} onRefresh={load} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventário Auto-Sync</h2>
          <p className="mt-1 text-sm text-slate-500">
            Valor potencial = soma dos preços dos artigos ainda à venda
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <InventarioMetricsCards metrics={metrics} />
        <InventarioFilters filtroAtivo={filtro} />
        <InventarioTable artigos={artigos} onRefresh={load} />
      </div>
    </>
  )
}

export default function InventarioPageClient() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-slate-500">A carregar…</p>
          </div>
        }
      >
        <InventarioContent />
      </Suspense>
    </AppShell>
  )
}
