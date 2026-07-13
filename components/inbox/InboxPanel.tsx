'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import ConversaThreadModal from '@/components/inbox/ConversaThreadModal'
import { arquivarConversas, marcarComoVista } from '@/lib/inbox-queries'
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

export function LiveIndicator({ status }: { status: 'connecting' | 'live' | 'polling' }) {
  const label =
    status === 'live' ? 'Ao vivo' : status === 'polling' ? 'Atualiza a cada 5s' : 'A ligar…'
  const color =
    status === 'live' ? 'bg-emerald-500' : status === 'polling' ? 'bg-amber-400' : 'bg-slate-300'

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

interface InboxToolbarProps {
  filtro: StatusInbox
  selectMode: boolean
  selectedCount: number
  totalCount: number
  onToggleSelect: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onBulkSelected: () => void
  onBulkAll: () => void
  busy: boolean
}

export function InboxToolbar({
  filtro,
  selectMode,
  selectedCount,
  totalCount,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSelected,
  onBulkAll,
  busy,
}: InboxToolbarProps) {
  const isPorResponder = filtro === 'por_responder'
  const bulkAllLabel = isPorResponder ? 'Marcar todas como vistas' : 'Arquivar todas'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <button
        type="button"
        onClick={onToggleSelect}
        disabled={busy}
        className="hover:text-slate-800 disabled:opacity-50"
      >
        {selectMode ? 'Cancelar' : 'Selecionar'}
      </button>

      {selectMode && (
        <>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={onSelectAll} className="hover:text-slate-800">
            Todas ({totalCount})
          </button>
          {selectedCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={onClearSelection} className="hover:text-slate-800">
                Limpar
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                disabled={busy}
                onClick={onBulkSelected}
                className="hover:text-slate-800 disabled:opacity-50"
              >
                {isPorResponder ? `Marcar ${selectedCount} como vistas` : `Arquivar ${selectedCount}`}
              </button>
            </>
          )}
        </>
      )}

      {!selectMode && totalCount > 0 && (
        <>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            disabled={busy}
            onClick={onBulkAll}
            className="hover:text-slate-800 disabled:opacity-50"
          >
            {bulkAllLabel}
          </button>
        </>
      )}
    </div>
  )
}

interface ConversaCardProps {
  conversa: Conversa
  filtro: StatusInbox
  selectMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onViewThread: (conversa: Conversa) => void
  onOpenVinted: (conversa: Conversa) => void
  onTogglePin: (conversa: Conversa) => void
}

export function ConversaCard({
  conversa,
  filtro,
  selectMode,
  selected,
  onToggleSelect,
  onViewThread,
  onOpenVinted,
  onTogglePin,
}: ConversaCardProps) {
  const needsReply = conversa.precisa_responder && !conversa.oculta_por_responder
  const pinned = Boolean(conversa.fixada_em)
  const canPin = filtro !== 'por_responder'

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow ${
        selected ? 'border-sky-400 ring-2 ring-sky-100' : pinned ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(conversa.id)}
            className="mt-3 h-4 w-4 rounded border-slate-300"
            aria-label={`Selecionar conversa com ${conversa.user_comprador}`}
          />
        )}

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
                {pinned && <span className="mr-1 text-amber-500" title="Fixada">📌</span>}
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
            <button
              type="button"
              onClick={() => onViewThread(conversa)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Ver conversa
            </button>
            {canPin && (
              <button
                type="button"
                onClick={() => onTogglePin(conversa)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                title={pinned ? 'Desafixar' : 'Fixar no topo'}
              >
                {pinned ? 'Desafixar' : 'Fixar'}
              </button>
            )}
            {conversa.url_conversa && (
              <button
                type="button"
                onClick={() => onOpenVinted(conversa)}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                Abrir Vinted ↗
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

interface InboxListProps {
  conversas: Conversa[]
  filtro: StatusInbox
  onRefresh?: () => void
}

async function markConversasViewed(items: Conversa[]) {
  if (items.length === 0) return
  const supabase = createClient()
  await marcarComoVista(
    supabase,
    items.map((c) => c.id)
  )
}

async function archiveConversasById(ids: string[]) {
  if (ids.length === 0) return
  const supabase = createClient()
  await arquivarConversas(supabase, ids)
}

export function InboxList({ conversas, filtro, onRefresh }: InboxListProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [thread, setThread] = useState<Conversa | null>(null)
  const [busy, setBusy] = useState(false)

  const isPorResponder = filtro === 'por_responder'

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(conversas.map((c) => c.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function runBulk(items: Conversa[], all: boolean) {
    if (items.length === 0) return

    if (isPorResponder) {
      const msg = all
        ? `Marcar todas as ${items.length} conversas como vistas?`
        : `Marcar ${items.length} conversa(s) como vistas?`
      if (!confirm(msg)) return
      setBusy(true)
      await markConversasViewed(items)
    } else {
      const msg = all
        ? `Arquivar todas as ${items.length} conversas deste filtro?`
        : `Arquivar ${items.length} conversa(s)?`
      if (!confirm(msg)) return
      setBusy(true)
      await archiveConversasById(items.map((c) => c.id))
    }

    setSelectedIds(new Set())
    setSelectMode(false)
    setBusy(false)
    onRefresh?.()
  }

  async function handleBulkSelected() {
    const items = conversas.filter((c) => selectedIds.has(c.id))
    await runBulk(items, false)
  }

  async function handleBulkAll() {
    await runBulk(conversas, true)
  }

  async function markViewed(conversa: Conversa) {
    if (!conversa.precisa_responder || conversa.oculta_por_responder) return conversa

    const supabase = createClient()
    await marcarComoVista(supabase, [conversa.id])

    onRefresh?.()
    return {
      ...conversa,
      precisa_responder: false,
      oculta_por_responder: true,
      vista_em: new Date().toISOString(),
    }
  }

  async function handleViewThread(conversa: Conversa) {
    const updated = await markViewed(conversa)
    setThread(updated)
  }

  async function handleOpenVinted(conversa: Conversa) {
    if (conversa.precisa_responder) {
      const supabase = createClient()
      await marcarComoVista(supabase, [conversa.id])
      onRefresh?.()
    }

    setThread(null)
    if (conversa.url_conversa) {
      window.open(conversa.url_conversa, '_blank', 'noopener,noreferrer')
    }
  }

  async function handleTogglePin(conversa: Conversa) {
    const supabase = createClient()
    const fixada_em = conversa.fixada_em ? null : new Date().toISOString()
    await supabase.from('conversas').update({ fixada_em }).eq('id', conversa.id)
    onRefresh?.()
  }

  if (conversas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhuma conversa neste filtro.</p>
        <p className="mt-1 text-sm text-slate-500">Mantém a Vinted aberta — sync automático a cada 15s.</p>
      </div>
    )
  }

  return (
    <>
      <InboxToolbar
        filtro={filtro}
        selectMode={selectMode}
        selectedCount={selectedIds.size}
        totalCount={conversas.length}
        onToggleSelect={() => {
          setSelectMode((v) => !v)
          clearSelection()
        }}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onBulkSelected={handleBulkSelected}
        onBulkAll={handleBulkAll}
        busy={busy}
      />

      <div className="mt-2 grid gap-3">
        {conversas.map((conversa) => (
          <ConversaCard
            key={conversa.id}
            conversa={conversa}
            filtro={filtro}
            selectMode={selectMode}
            selected={selectedIds.has(conversa.id)}
            onToggleSelect={toggleSelect}
            onViewThread={handleViewThread}
            onOpenVinted={handleOpenVinted}
            onTogglePin={handleTogglePin}
          />
        ))}
      </div>

      <ConversaThreadModal
        conversa={thread}
        onClose={() => setThread(null)}
        onOpenVinted={handleOpenVinted}
      />
    </>
  )
}
