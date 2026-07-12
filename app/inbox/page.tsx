import { Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import AutoRefresh from '@/components/layout/AutoRefresh'
import InboxFilters, { InboxAutoCleanup, InboxList } from '@/components/inbox/InboxPanel'
import { createClient } from '@/lib/supabase/server'
import type { Conversa, InboxCounts, StatusInbox } from '@/lib/types'

const VALID_FILTERS: StatusInbox[] = [
  'por_responder',
  'proposta_recebida',
  'proposta_enviada',
  'em_negociacao',
]

async function getInboxCounts(supabase: Awaited<ReturnType<typeof createClient>>): Promise<InboxCounts> {
  const { data } = await supabase
    .from('conversas')
    .select('status_inbox')
    .neq('status_inbox', 'arquivada')

  const counts: InboxCounts = {
    por_responder: 0,
    proposta_recebida: 0,
    proposta_enviada: 0,
    em_negociacao: 0,
  }

  for (const row of data ?? []) {
    const key = row.status_inbox as keyof InboxCounts
    if (key in counts) counts[key]++
  }

  return counts
}

interface InboxPageProps {
  searchParams: Promise<{ filtro?: string }>
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams
  const filtroRaw = params.filtro ?? 'por_responder'
  const filtro: StatusInbox = VALID_FILTERS.includes(filtroRaw as StatusInbox)
    ? (filtroRaw as StatusInbox)
    : 'por_responder'

  const supabase = await createClient()

  const [conversasResult, counts] = await Promise.all([
    supabase
      .from('conversas')
      .select('*')
      .eq('status_inbox', filtro)
      .order('data_atualizacao', { ascending: false }),
    getInboxCounts(supabase),
  ])

  const conversas = (conversasResult.data ?? []) as Conversa[]
  const error = conversasResult.error
    ? 'Não foi possível carregar conversas. Executa o schema-vinted.sql no Supabase.'
    : null

  return (
    <AppShell>
      <AutoRefresh intervalMs={30000} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mensagens & Negociações</h2>
          <p className="mt-1 text-sm text-slate-500">
            Atualiza automaticamente quando a Vinted sincroniza
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <InboxAutoCleanup />

        <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-slate-200" />}>
          <InboxFilters counts={counts} />
        </Suspense>

        <InboxList conversas={conversas} />
      </div>
    </AppShell>
  )
}
