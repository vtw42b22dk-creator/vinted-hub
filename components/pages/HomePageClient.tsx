'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import DashboardClient from '@/components/DashboardClient'
import { createClient } from '@/lib/supabase/client'
import type { Artigo, InboxCounts } from '@/lib/types'
import { calcularMetricas, calcularMetricasVinted, formatEuro } from '@/lib/utils'

async function getInboxCounts(supabase: ReturnType<typeof createClient>): Promise<InboxCounts> {
  const { data } = await supabase.from('conversas').select('status_inbox').neq('status_inbox', 'arquivada')
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

export default function HomePageClient() {
  const [artigos, setArtigos] = useState<Artigo[]>([])
  const [inboxCounts, setInboxCounts] = useState<InboxCounts>({
    por_responder: 0,
    proposta_recebida: 0,
    proposta_enviada: 0,
    em_negociacao: 0,
  })
  const [vintedMetrics, setVintedMetrics] = useState(calcularMetricasVinted([]))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [artigosResult, vintedResult, counts] = await Promise.all([
      supabase.from('artigos').select('*').order('criado_em', { ascending: false }),
      supabase.from('artigos_vinted_com_lucro').select('*'),
      getInboxCounts(supabase),
    ])

    setArtigos((artigosResult.data ?? []) as Artigo[])
    setInboxCounts(counts)
    setVintedMetrics(calcularMetricasVinted(vintedResult.data ?? []))

    if (artigosResult.error && vintedResult.error) {
      setError('Verifica o Supabase e executa os SQLs em /setup.')
    } else {
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = calcularMetricas(artigos)
  const totalInbox =
    inboxCounts.por_responder +
    inboxCounts.proposta_recebida +
    inboxCounts.proposta_enviada +
    inboxCounts.em_negociacao

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-sm text-slate-500">A carregar…</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell onRefresh={load}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
          <p className="mt-1 text-sm text-slate-500">Hub central do teu negócio Vinted</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/inbox?filtro=por_responder"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-slate-500">Mensagens pendentes</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{inboxCounts.por_responder}</p>
            <p className="mt-2 text-xs text-sky-600">{totalInbox} conversas no total →</p>
          </Link>
          <Link
            href="/inventario"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-slate-500">Valor potencial Vinted</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">
              {formatEuro(vintedMetrics.valorPotencial)}
            </p>
            <p className="mt-2 text-xs text-sky-600">{vintedMetrics.totalAtivos} artigos ativos →</p>
          </Link>
        </div>

        <DashboardClient artigos={artigos} metrics={metrics} error={error} onRefresh={load} />
      </div>
    </AppShell>
  )
}
