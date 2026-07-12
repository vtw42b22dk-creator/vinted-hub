export type StatusInbox =
  | 'por_responder'
  | 'proposta_recebida'
  | 'proposta_enviada'
  | 'em_negociacao'
  | 'arquivada'

export type StatusNegocio =
  | 'sem_proposta'
  | 'proposta_pendente'
  | 'aceite'
  | 'recusada'
  | 'expirada'

export interface ConversaSyncInput {
  id_vinted: string
  user_comprador: string
  avatar_comprador?: string | null
  ultimo_texto?: string | null
  ultima_mensagem_de: 'comprador' | 'vendedor'
  valor_proposta?: number | null
  id_artigo_vinted?: string | null
  url_conversa?: string | null
  item_fechado?: boolean
  vinted_unread?: boolean
}

export interface ConversaExisting {
  status_inbox: StatusInbox
  aberta_em: string | null
  ultima_mensagem_de: string
}

export function classificarConversa(
  input: ConversaSyncInput,
  existing?: ConversaExisting | null,
  artigoStatus?: string | null
): StatusInbox {
  if (input.item_fechado || artigoStatus === 'vendido' || artigoStatus === 'oculto') {
    return 'arquivada'
  }

  const texto = (input.ultimo_texto || '').toLowerCase()
  const unread = Boolean(input.vinted_unread)
  const msgComprador = input.ultima_mensagem_de === 'comprador'

  const propostaRecebida =
    /fez uma proposta|proposta de|nova proposta|offer|oferta de|proposta recebida/i.test(texto)
  const propostaEnviada =
    /enviaste uma proposta|enviaste uma oferta|oferta enviada|proposta enviada/i.test(texto)
  const emNegociacaoAtiva =
    /aceit|recus|negoci|contra|counter|combin|enviar|envio|embal/i.test(texto)

  if (propostaRecebida && unread && msgComprador) return 'proposta_recebida'
  if (propostaEnviada || (!msgComprador && /proposta|oferta/i.test(texto))) return 'proposta_enviada'

  if (existing?.status_inbox === 'proposta_recebida' && !unread) return 'em_negociacao'
  if (propostaRecebida && !unread) return 'em_negociacao'
  if (emNegociacaoAtiva) return 'em_negociacao'

  if (existing?.aberta_em && existing.status_inbox === 'por_responder') {
    if (unread && msgComprador) return 'por_responder'
    return 'em_negociacao'
  }

  if (unread && msgComprador) return 'por_responder'

  if (existing?.status_inbox === 'por_responder' && existing.aberta_em) {
    return 'em_negociacao'
  }

  if (existing?.status_inbox && existing.status_inbox !== 'arquivada') {
    return existing.status_inbox
  }

  return unread ? 'por_responder' : 'em_negociacao'
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

export async function arquivarConversasDeArtigosFechados(
  supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { in: (col: string, ids: string[]) => Promise<unknown> } } },
  artigosFechados: string[]
) {
  if (artigosFechados.length === 0) return
  await supabase
    .from('conversas')
    .update({ status_inbox: 'arquivada', item_fechado: true })
    .in('id_artigo_vinted', artigosFechados)
}
