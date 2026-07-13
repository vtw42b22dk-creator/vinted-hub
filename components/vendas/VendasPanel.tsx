'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Compra } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'
import { isHoje } from '@/lib/vendas-queries'
import { eliminarCompra, somarLucro, somarVendaPreco, vendidosHoje } from '@/lib/investimento-queries'

function VendaFoto({ fotoUrl, titulo }: { fotoUrl: string | null; titulo: string }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={titulo}
        className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
      Sem foto
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-medium opacity-80 sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold sm:text-2xl">{value}</p>
    </div>
  )
}

export default function VendasPanel({
  vendas,
  onRefresh,
}: {
  vendas: Compra[]
  onRefresh?: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const totalGeral = useMemo(() => somarVendaPreco(vendas), [vendas])
  const totalDeHoje = useMemo(() => vendidosHoje(vendas), [vendas])
  const lucroTotal = useMemo(() => somarLucro(vendas), [vendas])
  const selecionadas = useMemo(() => vendas.filter((v) => selected.has(v.id)), [vendas, selected])
  const totalSelecionado = useMemo(() => somarVendaPreco(selecionadas), [selecionadas])
  const lucroSelecionado = useMemo(() => somarLucro(selecionadas), [selecionadas])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarTudo() {
    setSelected(new Set(vendas.map((v) => v.id)))
  }

  function limpar() {
    setSelected(new Set())
  }

  async function eliminar(ids: string[], label: string) {
    if (ids.length === 0) return
    if (!confirm(`Eliminar ${label}? Isto remove-a das vendas.`)) return
    setBusy(true)
    const supabase = createClient()
    for (const id of ids) {
      await eliminarCompra(supabase, id)
    }
    setBusy(false)
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    onRefresh?.()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total ganho"
          value={formatEuro(totalGeral)}
          accent="border-emerald-200 bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          label="Ganho hoje"
          value={formatEuro(totalDeHoje)}
          accent="border-sky-200 bg-sky-50 text-sky-700"
        />
        <MetricCard
          label="Lucro realizado"
          value={formatEuro(lucroTotal)}
          accent="border-violet-200 bg-violet-50 text-violet-700"
        />
        <MetricCard
          label={`Vendas (${vendas.length})`}
          value={String(vendas.length)}
          accent="border-slate-200 bg-slate-50 text-slate-700"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong>{selected.size}</strong> selecionadas ={' '}
            <strong>{formatEuro(totalSelecionado)}</strong>
            <span className="ml-2 text-amber-700">
              (lucro {lucroSelecionado >= 0 ? '+' : ''}
              {formatEuro(lucroSelecionado)})
            </span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => eliminar(Array.from(selected), `${selected.size} venda(s)`)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Eliminar selecionadas
            </button>
            <button
              type="button"
              onClick={limpar}
              className="text-xs font-medium text-amber-800 hover:underline"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {vendas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Ainda não há vendas registadas.</p>
          <p className="mt-1 text-sm text-slate-500">
            Vai a <strong>Investimento</strong>, carrega em &quot;Mover p/ vendidos&quot; e indica o
            preço de venda — a peça aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <button type="button" onClick={selecionarTudo} className="hover:text-slate-800">
              Selecionar tudo
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={limpar} className="hover:text-slate-800">
                  Limpar
                </button>
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {vendas.map((venda) => {
              const checked = selected.has(venda.id)
              const preco = Number(venda.preco_venda ?? 0)
              const lucro = preco - Number(venda.preco_compra)
              return (
                <label
                  key={venda.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${
                    checked ? 'bg-sky-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(venda.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <VendaFoto fotoUrl={venda.foto_url} titulo={venda.titulo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{venda.titulo}</p>
                    <p className="text-xs text-slate-500">
                      Comprado {formatEuro(Number(venda.preco_compra))}
                      {venda.data_venda && (
                        <>
                          {' · '}
                          {formatRelativeTime(venda.data_venda)}
                          {isHoje(venda.data_venda) && (
                            <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                              hoje
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-emerald-700">{formatEuro(preco)}</p>
                    <p
                      className={`text-xs font-medium ${lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {lucro >= 0 ? '+' : ''}
                      {formatEuro(lucro)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      eliminar([venda.id], `"${venda.titulo}"`)
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Eliminar venda"
                  >
                    ✕
                  </button>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
