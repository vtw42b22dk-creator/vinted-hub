'use client'

import type { Conversa, MensagemConversa } from '@/lib/types'
import { formatEuro, formatRelativeTime } from '@/lib/utils'

interface ConversaThreadModalProps {
  conversa: Conversa | null
  onClose: () => void
  onOpenVinted?: (conversa: Conversa) => void
}

function getMensagens(conversa: Conversa): MensagemConversa[] {
  const stored = conversa.mensagens_json
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.slice(-8)
  }

  if (conversa.ultimo_texto) {
    return [
      {
        texto: conversa.ultimo_texto,
        de: conversa.ultima_mensagem_de,
        tipo: 'mensagem',
      },
    ]
  }

  return []
}

export default function ConversaThreadModal({
  conversa,
  onClose,
  onOpenVinted,
}: ConversaThreadModalProps) {
  if (!conversa) return null

  const mensagens = getMensagens(conversa)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
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

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {conversa.id_artigo_vinted && (
            <p className="text-sm text-slate-500">Artigo #{conversa.id_artigo_vinted}</p>
          )}

          {mensagens.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">Ainda sem mensagens sincronizadas.</p>
              <p className="mt-1 text-xs text-slate-500">
                Mantém a Vinted aberta — a extensão vai buscar as últimas 5 mensagens no próximo sync.
              </p>
            </div>
          ) : (
            mensagens.map((msg, i) => {
              if (msg.tipo === 'sistema' || msg.de === 'sistema') {
                return (
                  <div key={i} className="flex justify-center px-2">
                    <p className="rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs text-slate-600">
                      {msg.texto}
                    </p>
                  </div>
                )
              }

              const isVendedor = msg.de === 'vendedor'

              return (
                <div key={i} className={`flex ${isVendedor ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isVendedor
                        ? 'rounded-br-md bg-sky-600 text-white'
                        : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.texto}</p>
                    {msg.data && (
                      <p
                        className={`mt-1 text-[10px] ${isVendedor ? 'text-sky-100' : 'text-slate-400'}`}
                      >
                        {formatRelativeTime(msg.data)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {conversa.valor_proposta != null && (
            <p className="text-center text-xs text-amber-700">
              Proposta: {formatEuro(Number(conversa.valor_proposta))}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 p-4">
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
              Responder na Vinted ↗
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
