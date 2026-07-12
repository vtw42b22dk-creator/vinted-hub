import type {
  ArtigoVinted,
  StatusArtigo,
  StatusArtigoVinted,
  StatusInbox,
} from '@/lib/types'

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `há ${diffD}d`
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export const INBOX_FILTERS: { key: StatusInbox; label: string }[] = [
  { key: 'por_responder', label: 'Por Responder' },
  { key: 'proposta_recebida', label: 'Propostas Recebidas' },
  { key: 'proposta_enviada', label: 'Propostas Enviadas' },
  { key: 'em_negociacao', label: 'Em Negociação' },
]

export function statusBadgeClasses(status: StatusArtigo): string {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'

  switch (status) {
    case 'Vendido':
      return `${base} bg-emerald-100 text-emerald-800`
    case 'Para Embalar':
      return `${base} bg-amber-100 text-amber-800`
    case 'Em Stock':
      return `${base} bg-sky-100 text-sky-800`
    case 'Reservado':
      return `${base} bg-violet-100 text-violet-800`
    case 'Enviado':
      return `${base} bg-slate-100 text-slate-700`
    default:
      return `${base} bg-gray-100 text-gray-700`
  }
}

export function statusVintedBadgeClasses(status: StatusArtigoVinted): string {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize'

  switch (status) {
    case 'ativo':
      return `${base} bg-sky-100 text-sky-800`
    case 'reservado':
      return `${base} bg-violet-100 text-violet-800`
    case 'vendido':
      return `${base} bg-emerald-100 text-emerald-800`
    case 'rascunho':
      return `${base} bg-amber-100 text-amber-800`
    case 'oculto':
      return `${base} bg-slate-100 text-slate-600`
    default:
      return `${base} bg-gray-100 text-gray-700`
  }
}

export function inboxFilterClasses(active: boolean): string {
  return active
    ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm'
    : 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
}

export function calcularMetricas(
  artigos: {
    status: StatusArtigo
    preco_custo: number
    preco_venda_previsto: number
    preco_venda_real: number | null
  }[]
) {
  const emStock = artigos.filter((a) => a.status === 'Em Stock')

  const investimentoTotal = artigos.reduce((sum, a) => sum + Number(a.preco_custo), 0)

  const lucroPotencial = emStock.reduce(
    (sum, a) => sum + (Number(a.preco_venda_previsto) - Number(a.preco_custo)),
    0
  )

  const lucroRealLiquido = artigos
    .filter((a) => a.status === 'Vendido' && a.preco_venda_real != null)
    .reduce(
      (sum, a) => sum + (Number(a.preco_venda_real) - Number(a.preco_custo)),
      0
    )

  return {
    totalEmStock: emStock.length,
    investimentoTotal,
    lucroPotencial,
    lucroRealLiquido,
  }
}

export function calcularMetricasVinted(artigos: ArtigoVinted[]) {
  const aVenda = artigos.filter(
    (a) => a.status_artigo === 'ativo' || a.status_artigo === 'reservado'
  )
  const vendidos = artigos.filter((a) => a.status_artigo === 'vendido')

  const investimentoTotal = aVenda.reduce((sum, a) => sum + Number(a.preco_custo), 0)

  const valorPotencial = aVenda.reduce((sum, a) => sum + Number(a.preco_venda), 0)

  const lucroRealizado = vendidos.reduce(
    (sum, a) => sum + (Number(a.preco_venda) - Number(a.preco_custo)),
    0
  )

  return {
    totalAtivos: aVenda.length,
    investimentoTotal,
    valorPotencial,
    lucroRealizado,
  }
}

export function filtrarArtigosInventario(
  artigos: ArtigoVinted[],
  filtro: 'a_venda' | 'vendidos' | 'todos'
) {
  if (filtro === 'vendidos') return artigos.filter((a) => a.status_artigo === 'vendido')
  if (filtro === 'a_venda') {
    return artigos.filter((a) => a.status_artigo === 'ativo' || a.status_artigo === 'reservado')
  }
  return artigos
}
