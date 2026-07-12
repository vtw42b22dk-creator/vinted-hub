import type { StatusInbox, StatusNegocio } from '@/lib/types'
import {
  classificarConversaFromMensagens,
  type IniciadaPor,
} from '@/lib/inbox-classify'
import type { MensagemConversa } from '@/lib/types'

export interface ConversaSyncInput {
  id_vinted: string
  user_comprador: string
  avatar_comprador?: string | null
  ultimo_texto?: string | null
  ultima_mensagem_de: 'comprador' | 'vendedor'
  status_inbox?: StatusInbox
  status_negocio?: StatusNegocio
  valor_proposta?: number | null
  id_artigo_vinted?: string | null
  url_conversa?: string | null
  item_fechado?: boolean
  vinted_unread?: boolean
  iniciada_por?: IniciadaPor | null
  mensagens?: MensagemConversa[]
}

export interface ConversaExisting {
  status_inbox: StatusInbox
  aberta_em: string | null
  ultima_mensagem_de: string
  iniciada_por?: IniciadaPor | null
}

export function classificarConversa(
  input: ConversaSyncInput,
  existing?: ConversaExisting | null,
  artigoStatus?: string | null
): StatusInbox {
  if (input.item_fechado || artigoStatus === 'vendido' || artigoStatus === 'oculto') {
    return 'arquivada'
  }

  const mensagens = input.mensagens ?? []
  const result = classificarConversaFromMensagens({
    mensagens,
    vinted_unread: input.vinted_unread,
    item_fechado: false,
    aberta_em: existing?.aberta_em,
    iniciada_por: input.iniciada_por ?? existing?.iniciada_por ?? null,
  })

  if (existing?.aberta_em && result.status_inbox === 'por_responder' && !input.vinted_unread) {
    return result.iniciada_por === 'vendedor' ? 'proposta_enviada' : 'proposta_recebida'
  }

  return result.status_inbox
}

export function classificarNegocio(texto: string, statusInbox: StatusInbox): StatusNegocio {
  const t = texto.toLowerCase()
  if (/aceit/i.test(t)) return 'aceite'
  if (/recus/i.test(t)) return 'recusada'
  if (/expir/i.test(t)) return 'expirada'
  if (statusInbox === 'proposta_recebida' || statusInbox === 'proposta_enviada') {
    return 'proposta_pendente'
  }
  return 'sem_proposta'
}
