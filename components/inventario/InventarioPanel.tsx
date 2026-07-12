'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ArtigoVinted, InventarioMetrics } from '@/lib/types'
import { formatEuro, statusVintedBadgeClasses } from '@/lib/utils'

interface InventarioMetricsCardsProps {
  metrics: InventarioMetrics
}

export function InventarioMetricsCards({ metrics }: InventarioMetricsCardsProps) {
  const cards = [
    { label: 'À Venda', value: String(metrics.totalAtivos), accent: 'border-sky-200 bg-sky-50 text-sky-700' },
    { label: 'Investimento (stock)', value: formatEuro(metrics.investimentoTotal), accent: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: 'Valor Potencial', value: formatEuro(metrics.valorPotencial), accent: 'border-amber-200 bg-amber-50 text-amber-700' },
    { label: 'Lucro Realizado', value: formatEuro(metrics.lucroRealizado), accent: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.accent}`}>
          <p className="text-xs font-medium opacity-80 sm:text-sm">{card.label}</p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

const FILTROS = [
  { key: 'a_venda', label: 'À Venda' },
  { key: 'vendidos', label: 'Vendidos' },
  { key: 'todos', label: 'Todos' },
] as const

export function InventarioFilters({ filtroAtivo }: { filtroAtivo: string }) {
  const pathname = usePathname()

  return (
    <div className="flex gap-2">
      {FILTROS.map((f) => (
        <Link
          key={f.key}
          href={`${pathname}?filtro=${f.key}`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            filtroAtivo === f.key
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {f.label}
        </Link>
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
      onBlur={save}
      disabled={saving}
      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      title="Preço de custo (editável)"
    />
  )
}

interface InventarioTableProps {
  artigos: ArtigoVinted[]
  onRefresh?: () => void
}

function ArtigoThumbnail({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  if (fotoUrl) {
    return (
      <Image
        src={fotoUrl}
        alt={nome}
        width={48}
        height={48}
        className="h-12 w-12 rounded-lg object-cover"
        unoptimized
      />
    )
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
      Sem foto
    </div>
  )
}

export function InventarioTable({ artigos, onRefresh }: InventarioTableProps) {
  if (artigos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhum artigo neste filtro.</p>
        <p className="mt-1 text-sm text-slate-500">Sincroniza a Vinted para atualizar o inventário.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Artigo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Venda</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Custo ✏️</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Lucro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {artigos.map((artigo) => {
              const lucro = Number(artigo.lucro_bruto ?? artigo.preco_venda - artigo.preco_custo)
              return (
                <tr key={artigo.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ArtigoThumbnail fotoUrl={artigo.foto_url} nome={artigo.nome} />
                      <div>
                        <p className="font-medium text-slate-900">{artigo.nome}</p>
                        <p className="text-xs text-slate-500">#{artigo.id_artigo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatEuro(Number(artigo.preco_venda))}</td>
                  <td className="px-4 py-3">
                    <CustoEditor artigoId={artigo.id} initialCusto={Number(artigo.preco_custo)} onSaved={onRefresh} />
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{formatEuro(lucro)}</td>
                  <td className="px-4 py-3">
                    <span className={statusVintedBadgeClasses(artigo.status_artigo)}>{artigo.status_artigo}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {artigos.map((artigo) => {
          const lucro = Number(artigo.lucro_bruto ?? artigo.preco_venda - artigo.preco_custo)
          return (
            <article key={artigo.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <ArtigoThumbnail fotoUrl={artigo.foto_url} nome={artigo.nome} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{artigo.nome}</p>
                    <span className={statusVintedBadgeClasses(artigo.status_artigo)}>{artigo.status_artigo}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Venda</p>
                      <p className="font-medium">{formatEuro(Number(artigo.preco_venda))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Custo</p>
                      <CustoEditor artigoId={artigo.id} initialCusto={Number(artigo.preco_custo)} onSaved={onRefresh} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Lucro</p>
                      <p className="font-semibold text-emerald-700">{formatEuro(lucro)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
