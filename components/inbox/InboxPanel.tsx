'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Conversa, InboxCounts, StatusInbox } from '@/lib/types'
import { formatEuro, formatRelativeTime, INBOX_FILTERS, inboxFilterClasses } from '@/lib/utils'

interface InboxFiltersProps {
  counts: InboxCounts
}

export default function InboxFilters({ counts }: InboxFiltersProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = (searchParams.get('filtro') as StatusInbox) || 'por_responder'

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {INBOX_FILTERS.map((filter) => {
        const count = counts[filter.key as keyof InboxCounts] ?? 0
        const href = `${pathname}?filtro=${filter.key}`

        return (
          <Link
            key={filter.key}
            href={href}
            className={`shrink-0 ${inboxFilterClasses(active === filter.key)}`}
          >
            {filter.label}
            {count > 0 && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  active === filter.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export function InboxAutoCleanup() {
  const router = useRouter()
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/conversas/arquivar-auto', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.totalArquivadas > 0) {
          setMsg(`${d.totalArquivadas} conversas arquivadas (artigos vendidos/eliminados)`)
          router.refresh()
        }
      })
      .catch(() => {})
  }, [router])

  if (!msg) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
      {msg}
    </div>
  )
}

interface ConversaCardProps {
  conversa: Conversa
}

export function ConversaCard({ conversa }: ConversaCardProps) {
  const router = useRouter()
  const needsReply = conversa.ultima_mensagem_de === 'comprador' && conversa.status_inbox === 'por_responder'

  async function handleOpen() {
    await fetch(`/api/conversas/${conversa.id_vinted}/abrir`, { method: 'POST' })
    router.refresh()
    if (conversa.url_conversa) {
      window.open(conversa.url_conversa, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-sky-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {conversa.avatar_comprador ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversa.avatar_comprador} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            conversa.user_comprador.charAt(0).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {needsReply && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />}
                @{conversa.user_comprador}
              </p>
              {conversa.id_artigo_vinted && (
                <p className="truncate text-xs text-slate-500">Artigo #{conversa.id_artigo_vinted}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {formatRelativeTime(conversa.data_atualizacao)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{conversa.ultimo_texto || 'Sem mensagens'}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {conversa.valor_proposta != null && (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                Proposta: {formatEuro(Number(conversa.valor_proposta))}
              </span>
            )}
            <span className="text-xs font-medium text-sky-600">Clicar para abrir na Vinted ↗</span>
          </div>
        </div>
      </div>
    </article>
  )
}

interface InboxListProps {
  conversas: Conversa[]
}

export function InboxList({ conversas }: InboxListProps) {
  if (conversas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhuma conversa neste filtro.</p>
        <p className="mt-1 text-sm text-slate-500">Sincroniza a Vinted — a página atualiza automaticamente.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {conversas.map((conversa) => (
        <ConversaCard key={conversa.id} conversa={conversa} />
      ))}
    </div>
  )
}
