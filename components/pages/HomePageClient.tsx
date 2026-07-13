'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import type { InboxCounts } from '@/lib/types'
import { useSupabaseRealtime } from '@/lib/useSupabaseRealtime'
import { calcularMetricasVinted, formatEuro } from '@/lib/utils'

import { getInboxCounts } from '@/lib/inbox-queries'

export default function HomePageClient() {
  const [inboxCounts, setInboxCounts] = useState<InboxCounts>({ total: 0 })
  const [vintedMetrics, setVintedMetrics] = useState(calcularMetricasVinted([]))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [vintedResult, counts] = await Promise.all([
      supabase.from('artigos_vinted_com_lucro').select('*'),
      getInboxCounts(supabase),
    ])

    setInboxCounts(counts)
    setVintedMetrics(calcularMetricasVinted(vintedResult.data ?? []))

    if (vintedResult.error) {
      setError('Verifica o Supabase — corre supabase/sync-rpc.sql no SQL Editor.')
    } else {
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useSupabaseRealtime(load, ['conversas', 'artigos_vinted'])

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

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/inbox"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-slate-500">Conversas guardadas</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{inboxCounts.total}</p>
            <p className="mt-2 text-xs text-sky-600">Ver mensagens e apontamentos →</p>
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Artigos à venda</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{vintedMetrics.totalAtivos}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Investimento total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatEuro(vintedMetrics.investimentoTotal)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Lucro realizado</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {formatEuro(vintedMetrics.lucroRealizado)}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
