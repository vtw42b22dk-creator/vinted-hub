'use client'

import { useMemo } from 'react'
import type { Compra, Venda } from '@/lib/types'
import { calcularAnalytics, calcularSemanas } from '@/lib/analytics'
import { formatEuro } from '@/lib/utils'
import { somarVendas, totalHoje } from '@/lib/vendas-queries'

function Metric({
  label,
  value,
  sub,
  accent = 'border-slate-200 bg-white text-slate-900',
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPanel({
  compras,
  vendas,
}: {
  compras: Compra[]
  vendas: Venda[]
}) {
  const a = useMemo(() => calcularAnalytics(compras), [compras])
  const semanas = useMemo(() => calcularSemanas(compras, 8), [compras])

  const receitaVinted = somarVendas(vendas)
  const receitaVintedHoje = totalHoje(vendas)

  const maxLucro = Math.max(1, ...semanas.map((s) => Math.abs(s.lucro)))
  const semDados = compras.length === 0 && vendas.length === 0

  if (semDados) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Ainda não há dados para analisar.</p>
        <p className="mt-1 text-sm text-slate-500">
          Sincroniza as tuas compras (Investimento) e marca vendas para veres a análise do teu lucro.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          label="Lucro realizado"
          value={formatEuro(a.lucroTotal)}
          sub={`ROI ${a.roiPercent.toFixed(0)}%`}
          accent="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <Metric
          label="Margem média"
          value={`${a.margemMediaPercent.toFixed(0)}%`}
          sub={`${a.numVendidos} vendas registadas`}
        />
        <Metric
          label="Investido em stock"
          value={formatEuro(a.investidoEmStock)}
          sub={`${a.numStock} peças`}
          accent="border-violet-200 bg-violet-50 text-violet-800"
        />
        <Metric
          label="Receita vendas Vinted"
          value={formatEuro(receitaVinted)}
          sub={`Hoje: ${formatEuro(receitaVintedHoje)}`}
          accent="border-sky-200 bg-sky-50 text-sky-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric label="Vendas / semana" value={a.vendasPorSemana.toFixed(1)} />
        <Metric label="Compras / semana" value={a.comprasPorSemana.toFixed(1)} />
        <Metric
          label="Dias médios p/ vender"
          value={a.diasMedioParaVender != null ? Math.round(a.diasMedioParaVender).toString() : '—'}
        />
        <Metric
          label="Melhor flip"
          value={a.melhorFlip ? formatEuro(a.melhorFlip.lucro) : '—'}
          sub={a.melhorFlip?.titulo}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Últimas 8 semanas</h3>
        <p className="mt-0.5 text-xs text-slate-500">Compras, vendas e lucro por semana</p>

        <div className="mt-4 space-y-3">
          {semanas.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-slate-500">{s.label}</span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 rounded-full bg-emerald-400"
                    style={{ width: `${(Math.max(0, s.lucro) / maxLucro) * 100}%` }}
                  />
                  <span className="text-xs font-medium text-slate-600">
                    {s.vendas} vd · {s.compras} cp ·{' '}
                    <span className={s.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {formatEuro(s.lucro)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Investido (vendas)" value={formatEuro(a.investidoEmVendas)} />
        <Metric label="Receita (revenda)" value={formatEuro(a.receitaVendas)} />
        <Metric label="Investimento total" value={formatEuro(a.investidoTotal)} />
      </div>
    </div>
  )
}
