'use client'

import type { Conversa } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

interface ConversaPreviewModalProps {
  conversa: Conversa | null
  onClose: () => void
  onOpenVinted?: (conversa: Conversa) => void
}

export default function ConversaPreviewModal({
  conversa,
  onClose,
  onOpenVinted,
}: ConversaPreviewModalProps) {
  if (!conversa) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="font-semibold text-slate-900">@{conversa.user_comprador}</p>
            <p className="text-xs text-slate-500">{formatRelativeTime(conversa.data_atualizacao)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {conversa.id_artigo_vinted && (
            <p className="text-sm text-slate-500">Artigo #{conversa.id_artigo_vinted}</p>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Última mensagem</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {conversa.ultimo_texto || 'Sem texto disponível — sincroniza a Vinted.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
              De: {conversa.ultima_mensagem_de === 'comprador' ? 'Comprador' : 'Tu'}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
              Estado: {conversa.status_inbox.replace(/_/g, ' ')}
            </span>
            {conversa.valor_proposta != null && (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">
                Proposta: {formatEuro(Number(conversa.valor_proposta))}
              </span>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            {conversa.url_conversa && onOpenVinted && (
              <button
                type="button"
                onClick={() => onOpenVinted(conversa)}
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                Abrir na Vinted ↗
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
