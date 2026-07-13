'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import { InventarioMetricsCards, InventarioTable } from '@/components/inventario/InventarioPanel'
import { createClient } from '@/lib/supabase/client'
import type { ArtigoVinted } from '@/lib/types'
import { calcularMetricasVinted } from '@/lib/utils'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'

// Só mostra o que está atualmente à venda
function apenasAVenda(artigos: ArtigoVinted[]): ArtigoVinted[] {
  return artigos
    .filter((a) => a.status_artigo === 'ativo' || a.status_artigo === 'reservado')
    .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime())
}

export default function InventarioPageClient() {
  const [todos, setTodos] = useState<ArtigoVinted[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('artigos_vinted_com_lucro')
      .select('*')
      .order('atualizado_em', { ascending: false })

    setTodos((data ?? []) as ArtigoVinted[])
    setError(
      fetchError ? 'Não foi possível carregar o inventário. Executa o SQL no Supabase.' : null
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useSupabaseRealtime(load, ['artigos_vinted'])

  const artigos = apenasAVenda(todos)
  const metrics = calcularMetricasVinted(artigos)

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
              <h2 className="text-2xl font-bold text-slate-900">Inventário</h2>
              <p className="mt-1 text-sm text-slate-500">
                Artigos atualmente à venda — atualiza sozinho quando adicionas ou vendes algo. Clica
                num anúncio para ver os detalhes.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <InventarioMetricsCards metrics={metrics} />
            <InventarioTable artigos={artigos} onRefresh={load} />
          </div>
        </>
      )}
    </AppShell>
  )
}
