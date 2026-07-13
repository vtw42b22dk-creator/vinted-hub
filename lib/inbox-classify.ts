import type { MensagemConversa, StatusInbox } from '@/lib/types'

export type IniciadaPor = 'comprador' | 'vendedor'

const ENVIADA_PATTERNS = [
  /enviaste (uma )?(proposta|oferta)/i,
  /you sent (an )?offer/i,
  /fizeste uma proposta/i,
  /proposta enviada/i,
  /oferta enviada/i,
]

const RECEBIDA_PATTERNS = [
  /fez(-te)? (uma )?(proposta|oferta)/i,
  /fez uma proposta de/i,
  /made (you )?an offer/i,
  /nova proposta/i,
  /recebeste uma proposta/i,
]

export function inferPropostaPorFromText(texto: string): IniciadaPor | null {
  if (ENVIADA_PATTERNS.some((re) => re.test(texto))) return 'vendedor'
  if (RECEBIDA_PATTERNS.some((re) => re.test(texto))) return 'comprador'
  return null
}

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

export function inferirIniciadaPor(
  mensagens: MensagemConversa[],
  ultimoTexto?: string | null
): IniciadaPor | null {
  const fromText = ultimoTexto ? inferPropostaPorFromText(ultimoTexto) : null
  if (fromText) return fromText

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
  iniciada_por?: IniciadaPor | null
  ultimo_texto?: string | null
  precisa_responder?: boolean
}): { status_inbox: StatusInbox; iniciada_por: IniciadaPor | null; ultima_mensagem_de: 'comprador' | 'vendedor' } {
  if (input.item_fechado) {
    return { status_inbox: 'arquivada', iniciada_por: input.iniciada_por ?? null, ultima_mensagem_de: 'comprador' }
  }

  const mensagens = input.mensagens ?? []
  const fromText = inferPropostaPorFromText(input.ultimo_texto || '')
  const iniciada_por =
    fromText ?? inferirIniciadaPor(mensagens, input.ultimo_texto) ?? input.iniciada_por ?? 'comprador'

  const last = ultimaMensagemReal(mensagens)
  const ultima_mensagem_de: 'comprador' | 'vendedor' =
    last?.de === 'vendedor' ? 'vendedor' : 'comprador'

  const precisaResponder =
    Boolean(input.precisa_responder) ||
    Boolean(input.vinted_unread) ||
    ultima_mensagem_de === 'comprador'

  if (precisaResponder) {
    return { status_inbox: 'por_responder', iniciada_por, ultima_mensagem_de: 'comprador' }
  }

  return {
    status_inbox: statusPorIniciada(iniciada_por),
    iniciada_por,
    ultima_mensagem_de,
  }
}
