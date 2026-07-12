'use client'

import { useState } from 'react'
import type { Artigo, DashboardMetrics } from '@/lib/types'
import AddArtigoModal from '@/components/AddArtigoModal'
import ArtigosList from '@/components/ArtigosList'
import MetricsCards from '@/components/MetricsCards'

interface DashboardClientProps {
  artigos: Artigo[]
  metrics: DashboardMetrics
  error?: string | null
}

export default function DashboardClient({ artigos, metrics, error }: DashboardClientProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          + Adicionar Artigo Manual
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <MetricsCards metrics={metrics} />

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Inventário Manual</h3>
        <ArtigosList artigos={artigos} />
      </section>

      <AddArtigoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
