import type { MensagemConversa, StatusInbox } from '@/lib/types'

export type IniciadaPor = 'comprador' | 'vendedor'

export function isMensagemReal(msg: MensagemConversa): boolean {
  return msg.tipo !== 'sistema' && msg.de !== 'sistema'
}

export function primeiraMensagemReal(mensagens: MensagemConversa[]): MensagemConversa | null {
  return mensagens.find(isMensagemReal) ?? null
}

export function ultimaMensagemReal(mensagens: MensagemConversa[]): MensagemConversa | null {
  const real = mensagens.filter(isMensagemReal)
  return real.length ? real[real.length - 1] : null
}

export function inferirIniciadaPor(mensagens: MensagemConversa[]): IniciadaPor | null {
  const first = primeiraMensagemReal(mensagens)
  if (!first) return null
  return first.de === 'vendedor' ? 'vendedor' : 'comprador'
}

export function statusPorIniciada(iniciadaPor: IniciadaPor | null | undefined): StatusInbox {
  return iniciadaPor === 'vendedor' ? 'proposta_enviada' : 'proposta_recebida'
}

export function statusAposVista(iniciadaPor: IniciadaPor | null | undefined): StatusInbox {
  return statusPorIniciada(iniciadaPor)
}

export function classificarConversaFromMensagens(input: {
  mensagens: MensagemConversa[]
  vinted_unread?: boolean
  item_fechado?: boolean
  aberta_em?: string | null
  iniciada_por?: IniciadaPor | null
}): { status_inbox: StatusInbox; iniciada_por: IniciadaPor | null; ultima_mensagem_de: 'comprador' | 'vendedor' } {
  if (input.item_fechado) {
    return { status_inbox: 'arquivada', iniciada_por: input.iniciada_por ?? null, ultima_mensagem_de: 'comprador' }
  }

  const mensagens = input.mensagens ?? []
  const iniciada_por = inferirIniciadaPor(mensagens) ?? input.iniciada_por ?? null
  const last = ultimaMensagemReal(mensagens)
  const ultima_mensagem_de: 'comprador' | 'vendedor' =
    last?.de === 'vendedor' ? 'vendedor' : 'comprador'

  const unread = Boolean(input.vinted_unread)
  const precisaResponder = unread && ultima_mensagem_de === 'comprador'

  if (precisaResponder) {
    return { status_inbox: 'por_responder', iniciada_por, ultima_mensagem_de }
  }

  if (input.aberta_em && unread) {
    return { status_inbox: statusPorIniciada(iniciada_por), iniciada_por, ultima_mensagem_de }
  }

  return {
    status_inbox: statusPorIniciada(iniciada_por),
    iniciada_por,
    ultima_mensagem_de,
  }
}
