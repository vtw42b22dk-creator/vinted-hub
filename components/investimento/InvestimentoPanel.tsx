'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  eliminarCompra,
  moverParaVendido,
  reverterParaComprado,
} from '@/lib/investimento-queries'
import type { Compra } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

function CompraFoto({ fotoUrl, titulo }: { fotoUrl: string | null; titulo: string }) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={titulo}
        className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
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

export default function InvestimentoPanel({
  compras,
  onRefresh,
}: {
  compras: Compra[]
  onRefresh?: () => void
}) {
  const [aba, setAba] = useState<'stock' | 'vendidos'>('stock')
  const [busyId, setBusyId] = useState<string | null>(null)

  const stock = useMemo(() => compras.filter((c) => c.estado === 'comprado'), [compras])
  const vendidos = useMemo(() => compras.filter((c) => c.estado === 'vendido'), [compras])

  const investidoStock = stock.reduce((s, c) => s + Number(c.preco_compra), 0)
  const investidoTotal = compras.reduce((s, c) => s + Number(c.preco_compra), 0)
  const lucroRealizado = vendidos.reduce(
    (s, c) => s + (Number(c.preco_venda ?? 0) - Number(c.preco_compra)),
    0
  )

  async function handleMover(compra: Compra) {
    const input = prompt(
      `Por quanto vendeste "${compra.titulo}"?\n(Compraste por ${formatEuro(Number(compra.preco_compra))})`
    )
    if (input == null) return
    const preco = parseFloat(input.replace(',', '.'))
    if (isNaN(preco) || preco < 0) {
      alert('Preço inválido.')
      return
    }
    setBusyId(compra.id)
    const supabase = createClient()
    await moverParaVendido(supabase, compra.id, preco)
    setBusyId(null)
    onRefresh?.()
  }

  async function handleReverter(compra: Compra) {
    setBusyId(compra.id)
    const supabase = createClient()
    await reverterParaComprado(supabase, compra.id)
    setBusyId(null)
    onRefresh?.()
  }

  async function handleEliminar(compra: Compra) {
    if (!confirm(`Eliminar "${compra.titulo}" do investimento?`)) return
    setBusyId(compra.id)
    const supabase = createClient()
    await eliminarCompra(supabase, compra.id)
    setBusyId(null)
    onRefresh?.()
  }

  const lista = aba === 'stock' ? stock : vendidos

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Investido em stock"
          value={formatEuro(investidoStock)}
          accent="border-violet-200 bg-violet-50 text-violet-700"
        />
        <MetricCard
          label="Peças em stock"
          value={String(stock.length)}
          accent="border-sky-200 bg-sky-50 text-sky-700"
        />
        <MetricCard
          label="Investido total"
          value={formatEuro(investidoTotal)}
          accent="border-slate-200 bg-slate-50 text-slate-700"
        />
        <MetricCard
          label="Lucro realizado"
          value={formatEuro(lucroRealizado)}
          accent="border-emerald-200 bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba('stock')}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            aba === 'stock'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Em stock ({stock.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('vendidos')}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            aba === 'vendidos'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Vendidos ({vendidos.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {aba === 'stock' ? 'Sem peças em stock.' : 'Ainda não marcaste nenhuma peça como vendida.'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {aba === 'stock'
              ? 'As tuas compras na Vinted aparecem aqui automaticamente.'
              : 'Em "Em stock", carrega em "Mover p/ vendidos" e indica o preço de venda.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lista.map((compra) => {
            const lucro = Number(compra.preco_venda ?? 0) - Number(compra.preco_compra)
            const busy = busyId === compra.id
            return (
              <article
                key={compra.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <CompraFoto fotoUrl={compra.foto_url} titulo={compra.titulo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{compra.titulo}</p>
                  <p className="text-xs text-slate-500">
                    Comprado {formatRelativeTime(compra.data_compra)} ·{' '}
                    {formatEuro(Number(compra.preco_compra))}
                  </p>
                  {compra.estado === 'vendido' && (
                    <p className="mt-0.5 text-xs">
                      <span className="text-slate-500">Vendido por </span>
                      <span className="font-medium text-slate-800">
                        {formatEuro(Number(compra.preco_venda ?? 0))}
                      </span>
                      <span className={`ml-1.5 font-semibold ${lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        ({lucro >= 0 ? '+' : ''}
                        {formatEuro(lucro)})
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  {compra.estado === 'comprado' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleMover(compra)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Mover p/ vendidos
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReverter(compra)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Repor em stock
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleEliminar(compra)}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
