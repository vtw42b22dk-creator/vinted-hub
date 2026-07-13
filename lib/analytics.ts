import type { Compra } from '@/lib/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface AnalyticsResumo {
  lucroTotal: number
  receitaVendas: number
  investidoEmVendas: number
  investidoEmStock: number
  investidoTotal: number
  roiPercent: number
  margemMediaPercent: number
  numVendidos: number
  numStock: number
  vendasPorSemana: number
  comprasPorSemana: number
  diasMedioParaVender: number | null
  melhorFlip: { titulo: string; lucro: number } | null
  valorStock: number
}

export interface SemanaBucket {
  label: string
  inicio: Date
  vendas: number
  compras: number
  lucro: number
}

function weeksSpan(dates: number[]): number {
  if (dates.length < 2) return 1
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  return Math.max(1, Math.ceil((max - min) / WEEK_MS))
}

export function calcularAnalytics(compras: Compra[]): AnalyticsResumo {
  const vendidos = compras.filter((c) => c.estado === 'vendido' && c.preco_venda != null)
  const stock = compras.filter((c) => c.estado === 'comprado')

  const receitaVendas = vendidos.reduce((s, c) => s + Number(c.preco_venda ?? 0), 0)
  const investidoEmVendas = vendidos.reduce((s, c) => s + Number(c.preco_compra), 0)
  const investidoEmStock = stock.reduce((s, c) => s + Number(c.preco_compra), 0)
  const lucroTotal = receitaVendas - investidoEmVendas

  const roiPercent = investidoEmVendas > 0 ? (lucroTotal / investidoEmVendas) * 100 : 0

  const margens = vendidos
    .filter((c) => Number(c.preco_venda) > 0)
    .map((c) => ((Number(c.preco_venda) - Number(c.preco_compra)) / Number(c.preco_venda)) * 100)
  const margemMediaPercent = margens.length
    ? margens.reduce((s, m) => s + m, 0) / margens.length
    : 0

  const vendasPorSemana =
    vendidos.length / weeksSpan(vendidos.map((c) => new Date(c.data_venda ?? c.data_compra).getTime()))
  const comprasPorSemana =
    compras.length / weeksSpan(compras.map((c) => new Date(c.data_compra).getTime()))

  const diasParaVender = vendidos
    .filter((c) => c.data_venda)
    .map((c) => (new Date(c.data_venda as string).getTime() - new Date(c.data_compra).getTime()) / 86400000)
    .filter((d) => d >= 0)
  const diasMedioParaVender = diasParaVender.length
    ? diasParaVender.reduce((s, d) => s + d, 0) / diasParaVender.length
    : null

  let melhorFlip: { titulo: string; lucro: number } | null = null
  for (const c of vendidos) {
    const lucro = Number(c.preco_venda) - Number(c.preco_compra)
    if (!melhorFlip || lucro > melhorFlip.lucro) {
      melhorFlip = { titulo: c.titulo, lucro }
    }
  }

  return {
    lucroTotal,
    receitaVendas,
    investidoEmVendas,
    investidoEmStock,
    investidoTotal: investidoEmVendas + investidoEmStock,
    roiPercent,
    margemMediaPercent,
    numVendidos: vendidos.length,
    numStock: stock.length,
    vendasPorSemana,
    comprasPorSemana,
    diasMedioParaVender,
    melhorFlip,
    valorStock: investidoEmStock,
  }
}

// Últimas N semanas (mais antiga → mais recente)
export function calcularSemanas(compras: Compra[], n = 8): SemanaBucket[] {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const inicioSemanaAtual = new Date(now)
  inicioSemanaAtual.setHours(0, 0, 0, 0)
  inicioSemanaAtual.setDate(inicioSemanaAtual.getDate() - day)

  const buckets: SemanaBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const inicio = new Date(inicioSemanaAtual)
    inicio.setDate(inicio.getDate() - i * 7)
    buckets.push({
      label: inicio.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }),
      inicio,
      vendas: 0,
      compras: 0,
      lucro: 0,
    })
  }

  function bucketFor(date: Date): SemanaBucket | null {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (date.getTime() >= buckets[i].inicio.getTime()) return buckets[i]
    }
    return null
  }

  for (const c of compras) {
    const bCompra = bucketFor(new Date(c.data_compra))
    if (bCompra) bCompra.compras += 1

    if (c.estado === 'vendido' && c.data_venda) {
      const bVenda = bucketFor(new Date(c.data_venda))
      if (bVenda) {
        bVenda.vendas += 1
        bVenda.lucro += Number(c.preco_venda ?? 0) - Number(c.preco_compra)
      }
    }
  }

  return buckets
}
