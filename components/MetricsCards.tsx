import type { DashboardMetrics } from '@/lib/types'
import { formatEuro } from '@/lib/utils'

interface MetricsCardsProps {
  metrics: DashboardMetrics
}

const cards = [
  {
    key: 'totalEmStock' as const,
    label: 'Em Stock',
    format: (v: number) => String(v),
    accent: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    key: 'investimentoTotal' as const,
    label: 'Investimento Total',
    format: formatEuro,
    accent: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    key: 'lucroPotencial' as const,
    label: 'Lucro Potencial',
    format: formatEuro,
    accent: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    key: 'lucroRealLiquido' as const,
    label: 'Lucro Real Líquido',
    format: formatEuro,
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
]

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`rounded-xl border p-4 shadow-sm ${card.accent}`}
        >
          <p className="text-xs font-medium opacity-80 sm:text-sm">{card.label}</p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {card.format(metrics[card.key])}
          </p>
        </div>
      ))}
    </div>
  )
}
