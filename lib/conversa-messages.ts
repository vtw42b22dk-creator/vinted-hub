import type { MensagemConversa } from '@/lib/types'

export type { MensagemConversa }

const SYSTEM_PATTERNS = [
  /item (was )?(sold|deleted|removed|eliminado|vendido|apagado)/i,
  /artigo (foi )?(vendido|eliminado|apagado)/i,
  /preparar o pedido|a preparar o envio|preparing (the )?order|getting (the )?order ready/i,
  /pedido (foi )?(enviado|confirmado|conclu[íi]do)/i,
  /shipment (has been )?(sent|confirmed|label)/i,
  /transa[çc][ãa]o (conclu[íi]da|finalizada|cancelada)/i,
  /transaction (completed|cancelled)/i,
  /proposta (expirou|expired)/i,
  /offer (expired|cancelled)/i,
  /left the chat|saiu da conversa/i,
]

export function isMensagemSistema(texto: string, entityType?: string): boolean {
  const type = (entityType || '').toLowerCase()
  if (type.includes('action') || type.includes('status') || type.includes('system')) return true
  const t = (texto || '').trim()
  if (!t) return true
  return SYSTEM_PATTERNS.some((re) => re.test(t))
}

export function parseMensagensVinted(
  rawMessages: unknown[],
  currentUserId: string | number,
  limit = 5
): MensagemConversa[] {
  const mensagens: MensagemConversa[] = []
  const sistemas: MensagemConversa[] = []

  for (const raw of rawMessages) {
    const m = raw as Record<string, unknown>
    const entity = (m.entity || m) as Record<string, unknown>
    const entityType = String(m.entity_type || m.type || entity.type || '')
    const texto = String(
      entity.body || entity.title || entity.message || entity.text || entity.content || m.body || ''
    ).trim()

    if (!texto) continue

    const userId = entity.user_id ?? entity.sender_id ?? m.user_id
    const isSystem = isMensagemSistema(texto, entityType)

    const item: MensagemConversa = {
      texto,
      de: isSystem ? 'sistema' : String(userId) === String(currentUserId) ? 'vendedor' : 'comprador',
      data: String(m.created_at || entity.created_at || entity.created_at_ts || '') || null,
      tipo: isSystem ? 'sistema' : 'mensagem',
    }

    if (isSystem) sistemas.push(item)
    else mensagens.push(item)
  }

  const ultimas = mensagens.slice(-limit)
  const ultimoSistema = sistemas.length ? sistemas[sistemas.length - 1] : null

  if (ultimoSistema && ultimas.length < limit) {
    return [...ultimas.slice(0, -1), ultimoSistema, ultimas[ultimas.length - 1]].filter(Boolean).slice(-limit)
  }

  return ultimas
}
