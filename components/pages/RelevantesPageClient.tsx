'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import { InventarioTable } from '@/components/inventario/InventarioPanel'
import { createClient } from '@/lib/supabase/client'
import type { ArtigoVinted } from '@/lib/types'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'

export default function RelevantesPageClient() {
  const [artigos, setArtigos] = useState<ArtigoVinted[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('artigos_vinted_com_lucro')
      .select('*')
      .eq('relevante', true)
      .order('atualizado_em', { ascending: false })

    setArtigos((data ?? []) as ArtigoVinted[])
    setError(
      fetchError
        ? 'Executa supabase/sync-rpc.sql no Supabase para ativar os anúncios relevantes.'
        : null
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useSupabaseRealtime(load, ['artigos_vinted'])

  return (
    <AppShell>
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">A carregar…</p>
        </div>
      ) : (
        <>
          <AutoRefresh intervalMs={15000} onRefresh={load} />
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Anúncios relevantes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Os anúncios que marcaste com a estrela ⭐ no Inventário. Carrega na estrela para
                adicionar ou remover.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            {artigos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-medium text-slate-700">Ainda não marcaste anúncios.</p>
                <p className="mt-1 text-sm text-slate-500">
                  No Inventário, carrega na estrela no canto de um anúncio para o trazer para aqui.
                </p>
              </div>
            ) : (
              <InventarioTable artigos={artigos} onRefresh={load} />
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}
