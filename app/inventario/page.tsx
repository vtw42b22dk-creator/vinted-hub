import { Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import {
  InventarioFilters,
  InventarioMetricsCards,
  InventarioTable,
} from '@/components/inventario/InventarioPanel'
import { createClient } from '@/lib/supabase/server'
import type { ArtigoVinted } from '@/lib/types'
import { calcularMetricasVinted, filtrarArtigosInventario } from '@/lib/utils'

type FiltroInventario = 'a_venda' | 'vendidos' | 'todos'

interface InventarioPageProps {
  searchParams: Promise<{ filtro?: string }>
}

export default async function InventarioPage({ searchParams }: InventarioPageProps) {
  const params = await searchParams
  const filtroRaw = params.filtro ?? 'a_venda'
  const filtro: FiltroInventario = ['a_venda', 'vendidos', 'todos'].includes(filtroRaw)
    ? (filtroRaw as FiltroInventario)
    : 'a_venda'

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('artigos_vinted_com_lucro')
    .select('*')
    .order('sincronizado_em', { ascending: false })

  const todos = (data ?? []) as ArtigoVinted[]
  const artigos = filtrarArtigosInventario(todos, filtro)
  const metrics = calcularMetricasVinted(todos)

  const errorMessage = error
    ? 'Não foi possível carregar o inventário Vinted. Executa o schema-vinted.sql no Supabase.'
    : null

  return (
    <AppShell>
      <AutoRefresh intervalMs={30000} />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventário Auto-Sync</h2>
          <p className="mt-1 text-sm text-slate-500">
            Valor potencial = soma dos preços dos artigos ainda à venda
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        )}

        <InventarioMetricsCards metrics={metrics} />

        <Suspense fallback={null}>
          <InventarioFilters filtroAtivo={filtro} />
        </Suspense>

        <InventarioTable artigos={artigos} />
      </div>
    </AppShell>
  )
}
