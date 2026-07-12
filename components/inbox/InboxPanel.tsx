'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import ConversaPreviewModal from '@/components/inbox/ConversaPreviewModal'
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

export function InboxAutoCleanup({ onDone }: { onDone?: () => void }) {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    async function arquivar() {
      const supabase = createClient()

      const { data: fechados } = await supabase
        .from('artigos_vinted')
        .select('id_artigo')
        .in('status_artigo', ['vendido', 'oculto'])

      const ids = (fechados ?? []).map((a) => a.id_artigo)
      if (ids.length > 0) {
        await supabase
          .from('conversas')
          .update({ status_inbox: 'arquivada', item_fechado: true })
          .in('id_artigo_vinted', ids)
      }

      const { count } = await supabase
        .from('conversas')
        .select('*', { count: 'exact', head: true })
        .eq('status_inbox', 'arquivada')

      if ((count ?? 0) > 0) {
        setMsg(`${count} conversas arquivadas (artigos vendidos/eliminados)`)
        onDone?.()
      }
    }

    arquivar().catch(() => {})
  }, [onDone])

  if (!msg) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
      {msg}
    </div>
  )
}

interface InboxToolbarProps {
  selectMode: boolean
  selectedCount: number
  totalCount: number
  onToggleSelect: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onDeleteAll: () => void
  deleting: boolean
}

export function InboxToolbar({
  selectMode,
  selectedCount,
  totalCount,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onDeleteAll,
  deleting,
}: InboxToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleSelect}
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          selectMode
            ? 'bg-slate-900 text-white'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {selectMode ? 'Cancelar seleção' : 'Selecionar'}
      </button>

      {selectMode && (
        <>
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Selecionar todas ({totalCount})
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            disabled={selectedCount === 0 || deleting}
            onClick={onDeleteSelected}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'A apagar…' : `Apagar selecionadas (${selectedCount})`}
          </button>
        </>
      )}

      {!selectMode && totalCount > 0 && (
        <button
          type="button"
          disabled={deleting}
          onClick={onDeleteAll}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Apagar todas neste filtro
        </button>
      )}
    </div>
  )
}

interface ConversaCardProps {
  conversa: Conversa
  selectMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onPreview: (conversa: Conversa) => void
  onOpenVinted: (conversa: Conversa) => void
}

export function ConversaCard({
  conversa,
  selectMode,
  selected,
  onToggleSelect,
  onPreview,
  onOpenVinted,
}: ConversaCardProps) {
  const needsReply = conversa.ultima_mensagem_de === 'comprador' && conversa.status_inbox === 'por_responder'

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow ${
        selected ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'
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
              onClick={() => onPreview(conversa)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Ver mensagem
            </button>
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
  onRefresh?: () => void
}

export function InboxList({ conversas, onRefresh }: InboxListProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Conversa | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function deleteByIds(ids: string[]) {
    if (ids.length === 0) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('conversas').delete().in('id', ids)
    setSelectedIds(new Set())
    setSelectMode(false)
    setDeleting(false)
    onRefresh?.()
  }

  async function handleDeleteSelected() {
    if (!confirm(`Apagar ${selectedIds.size} conversa(s) do dashboard?`)) return
    await deleteByIds([...selectedIds])
  }

  async function handleDeleteAll() {
    if (!confirm(`Apagar todas as ${conversas.length} conversas deste filtro?`)) return
    await deleteByIds(conversas.map((c) => c.id))
  }

  async function handleOpenVinted(conversa: Conversa) {
    const supabase = createClient()
    let novoStatus = conversa.status_inbox

    if (conversa.status_inbox === 'por_responder' || conversa.status_inbox === 'proposta_recebida') {
      novoStatus = 'em_negociacao'
    }

    await supabase
      .from('conversas')
      .update({
        aberta_em: new Date().toISOString(),
        status_inbox: novoStatus,
      })
      .eq('id_vinted', conversa.id_vinted)

    onRefresh?.()
    setPreview(null)
    if (conversa.url_conversa) {
      window.open(conversa.url_conversa, '_blank', 'noopener,noreferrer')
    }
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
        selectMode={selectMode}
        selectedCount={selectedIds.size}
        totalCount={conversas.length}
        onToggleSelect={() => {
          setSelectMode((v) => !v)
          clearSelection()
        }}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDeleteSelected={handleDeleteSelected}
        onDeleteAll={handleDeleteAll}
        deleting={deleting}
      />

      <div className="mt-3 grid gap-3">
        {conversas.map((conversa) => (
          <ConversaCard
            key={conversa.id}
            conversa={conversa}
            selectMode={selectMode}
            selected={selectedIds.has(conversa.id)}
            onToggleSelect={toggleSelect}
            onPreview={setPreview}
            onOpenVinted={handleOpenVinted}
          />
        ))}
      </div>

      <ConversaPreviewModal
        conversa={preview}
        onClose={() => setPreview(null)}
        onOpenVinted={handleOpenVinted}
      />
    </>
  )
}
