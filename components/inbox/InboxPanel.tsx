'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversaThreadModal from '@/components/inbox/ConversaThreadModal'
import { guardarNotas, removerConversas } from '@/lib/inbox-queries'
import type { Conversa } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

export function LiveIndicator({ status }: { status: 'connecting' | 'live' | 'polling' }) {
  const label =
    status === 'live' ? 'Ao vivo' : status === 'polling' ? 'Atualização automática' : 'A ligar…'
  const color =
    status === 'live' ? 'bg-emerald-500' : status === 'polling' ? 'bg-amber-400' : 'bg-slate-300'

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

function NotasEditor({ conversa }: { conversa: Conversa }) {
  const [notas, setNotas] = useState(conversa.notas ?? '')
  const [estado, setEstado] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(conversa.notas ?? '')

  // Se chegar valor novo do realtime e não estivermos a editar, sincroniza
  useEffect(() => {
    const incoming = conversa.notas ?? ''
    if (incoming !== lastSavedRef.current && estado === 'idle' && notas === lastSavedRef.current) {
      setNotas(incoming)
      lastSavedRef.current = incoming
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.notas])

  async function save(value: string) {
    if (value === lastSavedRef.current) return
    setEstado('saving')
    try {
      const supabase = createClient()
      await guardarNotas(supabase, conversa.id, value)
      lastSavedRef.current = value
      setEstado('saved')
      setTimeout(() => setEstado('idle'), 2000)
    } catch {
      setEstado('error')
    }
  }

  function handleChange(value: string) {
    setNotas(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 1200)
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Apontamentos
        </p>
        <span className="text-[11px] text-slate-400">
          {estado === 'saving' && 'A guardar…'}
          {estado === 'saved' && '✓ Guardado'}
          {estado === 'error' && '✗ Erro ao guardar'}
        </span>
      </div>
      <textarea
        value={notas}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          save(notas)
        }}
        placeholder="Escreve aqui notas sobre esta conversa (preço mínimo, o que ficou combinado…)"
        rows={2}
        className="mt-1.5 w-full resize-y rounded-md border border-amber-200/60 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none"
      />
    </div>
  )
}

interface ConversaCardProps {
  conversa: Conversa
  onViewThread: (conversa: Conversa) => void
  onOpenVinted: (conversa: Conversa) => void
  onTogglePin: (conversa: Conversa) => void
  onRemove: (conversa: Conversa) => void
}

export function ConversaCard({
  conversa,
  onViewThread,
  onOpenVinted,
  onTogglePin,
  onRemove,
}: ConversaCardProps) {
  const pinned = Boolean(conversa.fixada_em)

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow ${
        pinned ? 'border-amber-200' : 'border-slate-200'
      }`}
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

          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
            {conversa.ultimo_texto || 'Sem mensagens'}
          </p>

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
            {conversa.url_conversa && (
              <button
                type="button"
                onClick={() => onOpenVinted(conversa)}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                Abrir Vinted ↗
              </button>
            )}
            <button
              type="button"
              onClick={() => onTogglePin(conversa)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              title={pinned ? 'Desafixar' : 'Fixar no topo'}
            >
              {pinned ? 'Desafixar' : 'Fixar'}
            </button>
            <button
              type="button"
              onClick={() => onRemove(conversa)}
              className="ml-auto rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              Remover
            </button>
          </div>

          <NotasEditor conversa={conversa} />
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
  const [thread, setThread] = useState<Conversa | null>(null)

  function handleOpenVinted(conversa: Conversa) {
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

  async function handleRemove(conversa: Conversa) {
    if (!confirm(`Remover a conversa com @${conversa.user_comprador} do dashboard?`)) return
    const supabase = createClient()
    await removerConversas(supabase, [conversa.id])
    onRefresh?.()
  }

  if (conversas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Ainda não adicionaste conversas.</p>
        <p className="mt-2 text-sm text-slate-500">
          Abre a tua inbox na Vinted e clica no botão <strong>＋ Dashboard</strong> ao lado de uma
          conversa (ou <strong>＋ Adicionar ao dashboard</strong> dentro da conversa) para a
          guardares aqui com apontamentos.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {conversas.map((conversa) => (
          <ConversaCard
            key={conversa.id}
            conversa={conversa}
            onViewThread={setThread}
            onOpenVinted={handleOpenVinted}
            onTogglePin={handleTogglePin}
            onRemove={handleRemove}
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
