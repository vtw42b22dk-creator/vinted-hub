import type {
  ArtigoVinted,
  StatusArtigo,
  StatusArtigoVinted,
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

export function ordenarConversas(conversas: { fixada_em?: string | null; data_atualizacao: string }[]) {
  return [...conversas].sort((a, b) => {
    const fa = a.fixada_em ? new Date(a.fixada_em).getTime() : 0
    const fb = b.fixada_em ? new Date(b.fixada_em).getTime() : 0
    if (fa !== fb) return fb - fa
    return new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
  })
}

export function statusVintedLabel(status: StatusArtigoVinted): string {
  switch (status) {
    case 'ativo':
      return 'À venda'
    case 'reservado':
      return 'Reservado'
    case 'vendido':
      return 'Vendido'
    case 'rascunho':
      return 'Rascunho'
    case 'oculto':
      return 'Oculto'
    default:
      return status
  }
}

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
  if (filtro === 'vendidos') {
    return artigos
      .filter((a) => a.status_artigo === 'vendido')
      .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime())
  }
  if (filtro === 'a_venda') {
    return artigos
      .filter((a) => a.status_artigo === 'ativo' || a.status_artigo === 'reservado')
      .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime())
  }
  return [...artigos].sort(
    (a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime()
  )
}
