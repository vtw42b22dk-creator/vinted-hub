'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { eliminarRelevante, somarRelevantes } from '@/lib/relevantes-queries'
import type { Relevante } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

function Foto({ fotoUrl, titulo }: { fotoUrl: string | null; titulo: string }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={titulo}
        className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
      Sem foto
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-medium opacity-80 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
    </div>
  )
}

export default function RelevantesPanel({
  relevantes,
  onRefresh,
}: {
  relevantes: Relevante[]
  onRefresh?: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const total = useMemo(() => somarRelevantes(relevantes), [relevantes])

  async function handleEliminar(r: Relevante) {
    if (!confirm(`Remover "${r.titulo}" dos relevantes?`)) return
    setBusyId(r.id)
    const supabase = createClient()
    await eliminarRelevante(supabase, r.id)
    setBusyId(null)
    onRefresh?.()
  }

  if (relevantes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Ainda não guardaste anúncios.</p>
        <p className="mt-1 text-sm text-slate-500">
          Na Vinted, carrega na estrela ⭐ no canto de um anúncio para o guardares aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricCard
          label="Anúncios guardados"
          value={String(relevantes.length)}
          accent="border-amber-200 bg-amber-50 text-amber-700"
        />
        <MetricCard
          label="Custo total (se comprar tudo)"
          value={formatEuro(total)}
          accent="border-violet-200 bg-violet-50 text-violet-700"
        />
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {relevantes.map((r) => {
          const meta = [r.marca, r.tamanho].filter(Boolean).join(' · ')
          const busy = busyId === r.id
          return (
            <article
              key={r.id}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <Foto fotoUrl={r.foto_url} titulo={r.titulo} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                  {r.titulo}
                </h3>
                {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
                {r.vendedor && <p className="text-[11px] text-slate-400">@{r.vendedor}</p>}
                <p className="mt-1 text-base font-bold text-emerald-700">
                  {formatEuro(Number(r.preco))}
                </p>
                <p className="text-[11px] text-slate-400">Guardado {formatRelativeTime(r.criado_em)}</p>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  {r.url_item && (
                    <a
                      href={r.url_item}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                    >
                      Ver na Vinted ↗
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleEliminar(r)}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
