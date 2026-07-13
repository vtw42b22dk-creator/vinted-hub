// Classificação de conversas Vinted — sinais da API + mensagens

export function detectUnread(raw) {
  return Boolean(
    raw.unread ||
      raw.is_unread ||
      raw.has_unread_messages ||
      (raw.unread_count != null && Number(raw.unread_count) > 0) ||
      (raw.unread_messages_count != null && Number(raw.unread_messages_count) > 0)
  )
}

export function extractDescription(raw) {
  const lm = raw.last_message || raw.latest_message || raw.last_message_preview || {}
  return String(
    raw.description ||
      raw.subtitle ||
      lm.body ||
      lm.text ||
      lm.message ||
      lm.title ||
      ''
  ).trim()
}

export function extractLastMessageUserId(raw) {
  const lm = raw.last_message || raw.latest_message || raw.last_message_preview || {}
  const entity = lm.entity || lm
  return (
    lm.user_id ??
    lm.sender_id ??
    lm.member_id ??
    entity.user_id ??
    entity.sender_id ??
    entity.member_id ??
    raw.last_message_user_id ??
    null
  )
}

export function extractOfferSenderId(raw) {
  const transaction = raw.transaction || raw.active_transaction || {}
  const offer =
    transaction.offer ||
    transaction.current_offer ||
    transaction.pending_offer ||
    raw.offer ||
    {}

  return offer.sender_id ?? offer.user_id ?? offer.buyer_id ?? offer.seller_id ?? null
}

const ENVIADA_PATTERNS = [
  /enviaste (uma )?(proposta|oferta)/i,
  /you sent (an )?offer/i,
  /fizeste uma proposta/i,
  /a tua proposta/i,
  /your offer/i,
  /proposta enviada/i,
  /oferta enviada/i,
]

const RECEBIDA_PATTERNS = [
  /fez(-te)? (uma )?(proposta|oferta)/i,
  /fez uma proposta de/i,
  /made (you )?an offer/i,
  /nova proposta/i,
  /new offer/i,
  /proposta de \d/i,
  /oferta de \d/i,
  /recebeste uma proposta/i,
]

export function inferPropostaPorFromText(texto) {
  const t = String(texto || '')
  if (ENVIADA_PATTERNS.some((re) => re.test(t))) return 'vendedor'
  if (RECEBIDA_PATTERNS.some((re) => re.test(t))) return 'comprador'
  return null
}

export function inferPropostaPor(raw, userId, desc) {
  const offerSender = extractOfferSenderId(raw)
  if (offerSender != null) {
    return String(offerSender) === String(userId) ? 'vendedor' : 'comprador'
  }

  const fromText = inferPropostaPorFromText(desc)
  if (fromText) return fromText

  return null
}

export function inferUltimaDe(raw, userId, desc) {
  const lastUserId = extractLastMessageUserId(raw)
  if (lastUserId != null) {
    return String(lastUserId) === String(userId) ? 'vendedor' : 'comprador'
  }

  const fromText = inferPropostaPorFromText(desc)
  if (fromText === 'vendedor') return 'vendedor'
  if (fromText === 'comprador') return 'comprador'

  return null
}

export function inferIniciadaPor(raw, userId, desc) {
  const propostaPor = inferPropostaPor(raw, userId, desc)
  if (propostaPor) return propostaPor

  const starterId =
    raw.initiator_id ??
    raw.conversation?.initiator_id ??
    raw.message_thread?.initiator_id ??
    null

  if (starterId != null) {
    return String(starterId) === String(userId) ? 'vendedor' : 'comprador'
  }

  return null
}

export function needsReply(raw, userId, desc, unread) {
  if (unread) return true
  const ultimaDe = inferUltimaDe(raw, userId, desc)
  if (ultimaDe === 'comprador') return true

  // Preview típico de mensagem nova do comprador
  if (/nova mensagem|new message|mensagem de @|wants to know|perguntou/i.test(desc)) return true

  return false
}

export function classifyFromInboxMeta(raw, userId) {
  const desc = extractDescription(raw)
  const unread = detectUnread(raw)
  const transaction = raw.transaction || {}
  const itemClosed =
    transaction.status === 'completed' || transaction.status === 'cancelled'

  const iniciada_por = inferIniciadaPor(raw, userId, desc) || 'comprador'
  const ultima_mensagem_de = inferUltimaDe(raw, userId, desc) || (unread ? 'comprador' : 'vendedor')
  const precisa_responder = needsReply(raw, userId, desc, unread)

  let status_inbox = 'proposta_recebida'
  if (itemClosed) {
    status_inbox = 'arquivada'
  } else if (precisa_responder) {
    status_inbox = 'por_responder'
  } else if (iniciada_por === 'vendedor') {
    status_inbox = 'proposta_enviada'
  } else {
    status_inbox = 'proposta_recebida'
  }

  return {
    desc,
    unread,
    itemClosed,
    iniciada_por,
    ultima_mensagem_de,
    precisa_responder,
    status_inbox,
    proposta_por: inferPropostaPor(raw, userId, desc),
  }
}

export function isOfferEntity(entityType) {
  const t = String(entityType || '').toLowerCase()
  return t.includes('offer') || t.includes('proposta') || t.includes('price_suggestion')
}

export function inferPropostaPorFromMessages(mensagens, userId) {
  for (const m of mensagens) {
    const entity = m._entity || {}
    const entityType = m._entityType || ''
    if (!isOfferEntity(entityType)) continue

    const senderId =
      entity.user_id ??
      entity.sender_id ??
      entity.offer?.sender_id ??
      entity.offer_request?.user_id ??
      m.de === 'vendedor'
        ? userId
        : null

    if (senderId != null) {
      return String(senderId) === String(userId) ? 'vendedor' : 'comprador'
    }
    if (m.de === 'vendedor') return 'vendedor'
    if (m.de === 'comprador') return 'comprador'
  }

  const firstReal = mensagens.find((m) => m.tipo !== 'sistema' && m.de !== 'sistema')
  if (firstReal) {
    return firstReal.de === 'vendedor' ? 'vendedor' : 'comprador'
  }

  return null
}

export function refineClassification(conversa, raw, userId) {
  const meta = classifyFromInboxMeta(raw, userId)
  const fromMessages = inferPropostaPorFromMessages(conversa.mensagens || [], userId)

  // Texto/preview da inbox e ofertas têm prioridade sobre histórico incompleto
  const iniciada_por = meta.proposta_por || fromMessages || meta.iniciada_por

  let status_inbox = meta.status_inbox
  let ultima_mensagem_de = meta.ultima_mensagem_de

  const lastMsg = (conversa.mensagens || []).filter((m) => m.tipo !== 'sistema').slice(-1)[0]
  if (lastMsg) {
    ultima_mensagem_de = lastMsg.de === 'vendedor' ? 'vendedor' : 'comprador'
    if (!meta.unread && ultima_mensagem_de === 'comprador' && !meta.itemClosed) {
      status_inbox = 'por_responder'
    }
  }

  if (meta.precisa_responder && !meta.itemClosed) {
    status_inbox = 'por_responder'
  } else if (!meta.precisa_responder && status_inbox === 'por_responder') {
    status_inbox = iniciada_por === 'vendedor' ? 'proposta_enviada' : 'proposta_recebida'
  } else if (status_inbox !== 'arquivada' && status_inbox !== 'por_responder') {
    status_inbox = iniciada_por === 'vendedor' ? 'proposta_enviada' : 'proposta_recebida'
  }

  return {
    iniciada_por,
    ultima_mensagem_de,
    status_inbox,
    vinted_unread: meta.unread,
    precisa_responder: meta.precisa_responder || status_inbox === 'por_responder',
  }
}
