'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversaThreadModal from '@/components/inbox/ConversaThreadModal'
import {
  criarPasta,
  eliminarPasta,
  guardarNotas,
  moverConversaParaPasta,
  removerConversas,
} from '@/lib/inbox-queries'
import type { Conversa, PastaConversas } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

// ---------- Pastas ----------

interface PastasBarProps {
  pastas: PastaConversas[]
  conversas: Conversa[]
  activePasta: string | null | 'todas'
  onSelect: (pastaId: string | null | 'todas') => void
  onRefresh?: () => void
}

export function PastasBar({ pastas, conversas, activePasta, onSelect, onRefresh }: PastasBarProps) {
  function countFor(pastaId: string | null) {
    return conversas.filter((c) => (c.pasta_id ?? null) === pastaId).length
  }

  async function handleCriar() {
    const nome = prompt('Nome da nova pasta:')?.trim()
    if (!nome) return
    const supabase = createClient()
    await criarPasta(supabase, nome)
    onRefresh?.()
  }

  async function handleEliminar(pasta: PastaConversas) {
    if (
      !confirm(
        `Eliminar a pasta "${pasta.nome}"? As conversas não são apagadas — ficam sem pasta.`
      )
    )
      return
    const supabase = createClient()
    await eliminarPasta(supabase, pasta.id)
    if (activePasta === pasta.id) onSelect('todas')
    onRefresh?.()
  }

  const chipBase = 'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
  const chipActive = 'bg-slate-900 text-white shadow-sm'
  const chipIdle = 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect('todas')}
        className={`${chipBase} ${activePasta === 'todas' ? chipActive : chipIdle}`}
      >
        Todas ({conversas.length})
      </button>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`${chipBase} ${activePasta === null ? chipActive : chipIdle}`}
      >
        Sem pasta ({countFor(null)})
      </button>

      {pastas.map((pasta) => (
        <span
          key={pasta.id}
          className={`inline-flex shrink-0 items-center overflow-hidden rounded-lg ${
            activePasta === pasta.id ? chipActive : chipIdle
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect(pasta.id)}
            className="px-3 py-2 text-sm font-medium"
          >
            📁 {pasta.nome} ({countFor(pasta.id)})
          </button>
          <button
            type="button"
            onClick={() => handleEliminar(pasta)}
            title={`Eliminar pasta ${pasta.nome}`}
            className={`px-2 py-2 text-xs ${
              activePasta === pasta.id
                ? 'text-white/60 hover:text-white'
                : 'text-slate-400 hover:text-red-600'
            }`}
          >
            ✕
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={handleCriar}
        className="shrink-0 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        + Nova pasta
      </button>
    </div>
  )
}

// ---------- Apontamentos ----------

function NotasEditor({ conversa }: { conversa: Conversa }) {
  const [notas, setNotas] = useState(conversa.notas ?? '')
  const [estado, setEstado] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(conversa.notas ?? '')

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

// ---------- Cartão de conversa ----------

interface ConversaCardProps {
  conversa: Conversa
  pastas: PastaConversas[]
  onViewThread: (conversa: Conversa) => void
  onOpenVinted: (conversa: Conversa) => void
  onTogglePin: (conversa: Conversa) => void
  onRemove: (conversa: Conversa) => void
  onRefresh?: () => void
}

export function ConversaCard({
  conversa,
  pastas,
  onViewThread,
  onOpenVinted,
  onTogglePin,
  onRemove,
  onRefresh,
}: ConversaCardProps) {
  const pinned = Boolean(conversa.fixada_em)

  async function handleMove(pastaId: string) {
    const supabase = createClient()
    await moverConversaParaPasta(supabase, conversa.id, pastaId || null)
    onRefresh?.()
  }

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
            <select
              value={conversa.pasta_id ?? ''}
              onChange={(e) => handleMove(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
              title="Mover para pasta"
            >
              <option value="">Sem pasta</option>
              {pastas.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.nome}
                </option>
              ))}
            </select>
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

// ---------- Lista ----------

interface InboxListProps {
  conversas: Conversa[]
  pastas: PastaConversas[]
  onRefresh?: () => void
}

export function InboxList({ conversas, pastas, onRefresh }: InboxListProps) {
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
        <p className="text-sm font-medium text-slate-700">Nenhuma conversa aqui.</p>
        <p className="mt-2 text-sm text-slate-500">
          Abre uma conversa na Vinted e clica no botão{' '}
          <strong>＋ Adicionar conversa ao dashboard</strong> no canto inferior esquerdo do ecrã.
          Podes escolher logo a pasta onde guardar.
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
            pastas={pastas}
            onViewThread={setThread}
            onOpenVinted={handleOpenVinted}
            onTogglePin={handleTogglePin}
            onRemove={handleRemove}
            onRefresh={onRefresh}
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
