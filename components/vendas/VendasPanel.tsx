'use client'

import { useMemo, useState } from 'react'
import type { Venda } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'
import { isHoje, somarVendas, totalHoje } from '@/lib/vendas-queries'

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

export default function VendasPanel({ vendas }: { vendas: Venda[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalGeral = useMemo(() => somarVendas(vendas), [vendas])
  const totalDeHoje = useMemo(() => totalHoje(vendas), [vendas])
  const totalSelecionado = useMemo(
    () => somarVendas(vendas.filter((v) => selected.has(v.id))),
    [vendas, selected]
  )

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
          label={`Vendas (${vendas.length})`}
          value={String(vendas.length)}
          accent="border-violet-200 bg-violet-50 text-violet-700"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong>{selected.size}</strong> selecionadas ={' '}
            <strong>{formatEuro(totalSelecionado)}</strong>
          </p>
          <button
            type="button"
            onClick={limpar}
            className="text-xs font-medium text-amber-800 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {vendas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Ainda não há vendas sincronizadas.</p>
          <p className="mt-1 text-sm text-slate-500">
            Mantém a Vinted aberta com a extensão activa — as vendas são lidas automaticamente.
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
                      {venda.comprador ? `@${venda.comprador} · ` : ''}
                      {formatRelativeTime(venda.data_venda)}
                      {isHoje(venda.data_venda) && (
                        <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                          hoje
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-700">
                    {formatEuro(Number(venda.preco))}
                  </span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
