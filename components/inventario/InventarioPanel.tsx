'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ArtigoVinted, InventarioMetrics } from '@/lib/types'
import { formatEuro, statusVintedBadgeClasses, statusVintedLabel } from '@/lib/utils'

interface InventarioMetricsCardsProps {
  metrics: InventarioMetrics
}

export function InventarioMetricsCards({ metrics }: InventarioMetricsCardsProps) {
  const cards = [
    { label: 'À venda', value: String(metrics.totalAtivos), accent: 'border-sky-200 bg-sky-50 text-sky-700' },
    {
      label: 'Investimento',
      value: formatEuro(metrics.investimentoTotal),
      accent: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    {
      label: 'Valor potencial',
      value: formatEuro(metrics.valorPotencial),
      accent: 'border-amber-200 bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.accent}`}>
          <p className="text-xs font-medium opacity-80 sm:text-sm">{card.label}</p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

interface CustoEditorProps {
  artigoId: string
  initialCusto: number
  onSaved?: () => void
}

export function CustoEditor({ artigoId, initialCusto, onSaved }: CustoEditorProps) {
  const [value, setValue] = useState(String(initialCusto))
  const [saving, setSaving] = useState(false)

  async function save() {
    const preco_custo = parseFloat(value)
    if (isNaN(preco_custo) || preco_custo < 0) return

    setSaving(true)
    const supabase = createClient()
    await supabase.from('artigos_vinted').update({ preco_custo }).eq('id', artigoId)
    setSaving(false)
    onSaved?.()
  }

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={save}
      disabled={saving}
      className="w-full max-w-[5.5rem] rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      title="Preço de custo"
    />
  )
}

function ArtigoFoto({
  fotoUrl,
  nome,
  size = 'h-20 w-20',
}: {
  fotoUrl: string | null
  nome: string
  size?: string
}) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nome}
        className={`${size} shrink-0 rounded-lg bg-slate-100 object-cover`}
        loading="lazy"
      />
    )
  }

  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400`}>
      Sem foto
    </div>
  )
}

function ArtigoDetailModal({
  artigo,
  onClose,
  onRefresh,
}: {
  artigo: ArtigoVinted | null
  onClose: () => void
  onRefresh?: () => void
}) {
  if (!artigo) return null

  const lucro = Number(artigo.lucro_bruto ?? artigo.preco_venda - artigo.preco_custo)
  const margem = Number(artigo.margem_percentual ?? 0)

  const specs: { label: string; value: string | null }[] = [
    { label: 'Preço de venda', value: formatEuro(Number(artigo.preco_venda)) },
    { label: 'Categoria', value: artigo.categoria },
    { label: 'Marca', value: artigo.marca },
    { label: 'Tamanho', value: artigo.tamanho },
    { label: 'Estado', value: statusVintedLabel(artigo.status_artigo) },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold leading-snug text-slate-900">{artigo.nome}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex gap-4">
            <ArtigoFoto fotoUrl={artigo.foto_url} nome={artigo.nome} size="h-28 w-28" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className={statusVintedBadgeClasses(artigo.status_artigo)}>
                {statusVintedLabel(artigo.status_artigo)}
              </span>
              <dl className="space-y-1 text-sm">
                {specs.map(
                  (s) =>
                    s.value && (
                      <div key={s.label} className="flex justify-between gap-3">
                        <dt className="text-slate-500">{s.label}</dt>
                        <dd className="text-right font-medium text-slate-900">{s.value}</dd>
                      </div>
                    )
                )}
              </dl>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Venda</p>
              <p className="font-semibold text-slate-900">{formatEuro(Number(artigo.preco_venda))}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Custo</p>
              <CustoEditor artigoId={artigo.id} initialCusto={Number(artigo.preco_custo)} onSaved={onRefresh} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Lucro</p>
              <p className={`font-semibold ${lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatEuro(lucro)}
              </p>
              {margem > 0 && <p className="text-[10px] text-slate-400">{margem}% margem</p>}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descrição</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {artigo.descricao || 'Sem descrição sincronizada.'}
            </p>
          </div>
        </div>

        {artigo.url_vinted && (
          <div className="shrink-0 border-t border-slate-200 p-4">
            <a
              href={artigo.url_vinted}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-sky-600 py-2.5 text-center text-sm font-medium text-white hover:bg-sky-700"
            >
              Ver anúncio na Vinted ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

interface InventarioTableProps {
  artigos: ArtigoVinted[]
  onRefresh?: () => void
}

export function InventarioTable({ artigos, onRefresh }: InventarioTableProps) {
  const [detalhe, setDetalhe] = useState<ArtigoVinted | null>(null)

  if (artigos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhum artigo à venda.</p>
        <p className="mt-1 text-sm text-slate-500">Abre a Vinted com a extensão activa para sincronizar.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {artigos.map((artigo) => {
          const lucro = Number(artigo.lucro_bruto ?? artigo.preco_venda - artigo.preco_custo)
          const meta = [artigo.marca, artigo.tamanho].filter(Boolean).join(' · ')

          return (
            <button
              key={artigo.id}
              type="button"
              onClick={() => setDetalhe(artigo)}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex gap-3">
                <ArtigoFoto fotoUrl={artigo.foto_url} nome={artigo.nome} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                      {artigo.nome}
                    </h3>
                    <span className={statusVintedBadgeClasses(artigo.status_artigo)}>
                      {statusVintedLabel(artigo.status_artigo)}
                    </span>
                  </div>
                  {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
                  {artigo.categoria && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{artigo.categoria}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Venda</p>
                  <p className="font-semibold text-slate-900">{formatEuro(Number(artigo.preco_venda))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Custo</p>
                  <CustoEditor artigoId={artigo.id} initialCusto={Number(artigo.preco_custo)} onSaved={onRefresh} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Lucro</p>
                  <p className={`font-semibold ${lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatEuro(lucro)}
                  </p>
                </div>
              </div>

              <span className="mt-3 block text-center text-xs font-medium text-sky-600">Ver detalhes →</span>
            </button>
          )
        })}
      </div>

      <ArtigoDetailModal artigo={detalhe} onClose={() => setDetalhe(null)} onRefresh={onRefresh} />
    </>
  )
}
