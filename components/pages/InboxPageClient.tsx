'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import InboxFilters, { InboxList, LiveIndicator } from '@/components/inbox/InboxPanel'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import type { Conversa, InboxCounts, StatusInbox } from '@/lib/types'
import { ordenarConversas } from '@/lib/utils'

const VALID_FILTERS: StatusInbox[] = ['por_responder', 'proposta_recebida', 'proposta_enviada']

async function getInboxCounts(supabase: ReturnType<typeof createClient>): Promise<InboxCounts> {
  const { data } = await supabase
    .from('conversas')
    .select('status_inbox')
    .neq('status_inbox', 'arquivada')
    .eq('suprimida', false)

  const counts: InboxCounts = {
    por_responder: 0,
    proposta_recebida: 0,
    proposta_enviada: 0,
  }

  for (const row of data ?? []) {
    const key = row.status_inbox as keyof InboxCounts
    if (key in counts) counts[key]++
  }

  return counts
}

function InboxContent() {
  const searchParams = useSearchParams()
  const filtroRaw = searchParams.get('filtro') ?? 'por_responder'
  const filtro: StatusInbox = VALID_FILTERS.includes(filtroRaw as StatusInbox)
    ? (filtroRaw as StatusInbox)
    : 'por_responder'

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [counts, setCounts] = useState<InboxCounts>({
    por_responder: 0,
    proposta_recebida: 0,
    proposta_enviada: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [conversasResult, newCounts] = await Promise.all([
      supabase
        .from('conversas')
        .select('*')
        .eq('status_inbox', filtro)
        .eq('suprimida', false)
        .order('data_atualizacao', { ascending: false }),
      getInboxCounts(supabase),
    ])

    setConversas(ordenarConversas((conversasResult.data ?? []) as Conversa[]) as Conversa[])
    setCounts(newCounts)
    setError(
      conversasResult.error
        ? 'Não foi possível carregar conversas. Executa o SQL no Supabase.'
        : null
    )
    setLoading(false)
  }, [filtro])

  const liveStatus = useSupabaseRealtime(load, ['conversas', 'artigos_vinted'])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    )
  }

  return (
    <>
      <AutoRefresh intervalMs={5000} onRefresh={load} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Mensagens & Negociações</h2>
            <p className="mt-1 text-sm text-slate-500">
              Atualiza em tempo real quando a extensão sincroniza a Vinted
            </p>
          </div>
          <LiveIndicator status={liveStatus} />
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <InboxFilters counts={counts} />

        <InboxList conversas={conversas} filtro={filtro} onRefresh={load} />
      </div>
    </>
  )
}

export default function InboxPageClient() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-slate-500">A carregar…</p>
          </div>
        }
      >
        <InboxContent />
      </Suspense>
    </AppShell>
  )
}
