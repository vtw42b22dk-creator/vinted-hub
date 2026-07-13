// Classificação de conversas Vinted — regras do dashboard

function detectUnread(raw) {
  return Boolean(
    raw.unread ||
      raw.is_unread ||
      raw.has_unread_messages ||
      (raw.unread_count != null && Number(raw.unread_count) > 0) ||
      (raw.unread_messages_count != null && Number(raw.unread_messages_count) > 0)
  )
}

function extractDescription(raw) {
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

function extractLastMessageUserId(raw) {
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

function extractOfferSenderId(raw) {
  const transaction = raw.transaction || raw.active_transaction || {}
  const offer =
    transaction.offer ||
    transaction.current_offer ||
    transaction.pending_offer ||
    raw.offer ||
    {}
  return offer.sender_id ?? offer.user_id ?? null
}

const ENVIADA_PATTERNS = [
  /enviaste (uma )?(proposta|oferta|mensagem)/i,
  /you sent (an )?(offer|message)/i,
  /fizeste uma proposta/i,
  /proposta enviada/i,
  /oferta enviada/i,
  /mensagem enviada/i,
]

const RECEBIDA_PATTERNS = [
  /fez(-te)? (uma )?(proposta|oferta)/i,
  /fez uma proposta de/i,
  /made (you )?an offer/i,
  /nova proposta/i,
  /recebeste uma proposta/i,
]

function inferPropostaPorFromText(texto) {
  const t = String(texto || '')
  if (ENVIADA_PATTERNS.some((re) => re.test(t))) return 'vendedor'
  if (RECEBIDA_PATTERNS.some((re) => re.test(t))) return 'comprador'
  return null
}

function inferPropostaPor(raw, userId, desc) {
  const offerSender = extractOfferSenderId(raw)
  if (offerSender != null) {
    return String(offerSender) === String(userId) ? 'vendedor' : 'comprador'
  }
  return inferPropostaPorFromText(desc)
}

function inferUltimaDe(raw, userId, desc) {
  const lastUserId = extractLastMessageUserId(raw)
  if (lastUserId != null) {
    return String(lastUserId) === String(userId) ? 'vendedor' : 'comprador'
  }
  const fromText = inferPropostaPorFromText(desc)
  if (fromText === 'vendedor') return 'vendedor'
  if (fromText === 'comprador') return 'comprador'
  return null
}

function inferIniciadaPor(raw, userId, desc) {
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

  const ultimaDe = inferUltimaDe(raw, userId, desc)
  if (ultimaDe === 'vendedor') return 'vendedor'

  return 'comprador'
}

function isProposta(raw, userId, desc) {
  const transaction = raw.transaction || {}
  if (transaction.offer || raw.offer) return true
  if (/\d+[,.]?\d*\s*€/.test(desc) && /proposta|oferta|offer/i.test(desc)) return true
  if (inferPropostaPorFromText(desc)) return true
  if (inferPropostaPor(raw, userId, desc)) return true
  return false
}

/**
 * Regras:
 * - Por responder: não vista + comprador falou por último (ou tu iniciaste mas comprador respondeu)
 * - Propostas enviadas: tu iniciaste (primeira msg/proposta) — vai direto, não fica em por responder
 * - Propostas recebidas: proposta do comprador (aparece também em por responder se não vista)
 */
function classifyFromInboxMeta(raw, userId) {
  const desc = extractDescription(raw)
  const unread = detectUnread(raw)
  const transaction = raw.transaction || {}
  const itemClosed =
    transaction.status === 'completed' || transaction.status === 'cancelled'

  const iniciada_por = inferIniciadaPor(raw, userId, desc)
  const ultima_mensagem_de = inferUltimaDe(raw, userId, desc) || 'comprador'
  const eh_proposta = isProposta(raw, userId, desc)

  let precisa_responder = false

  if (!itemClosed && unread && ultima_mensagem_de === 'comprador') {
    precisa_responder = true
  }

  // Tu iniciaste e ainda estás à espera → só propostas enviadas, não por responder
  if (iniciada_por === 'vendedor' && ultima_mensagem_de === 'vendedor') {
    precisa_responder = false
  }

  let status_inbox = 'proposta_recebida'
  if (itemClosed) status_inbox = 'arquivada'
  else if (precisa_responder) status_inbox = 'por_responder'
  else if (iniciada_por === 'vendedor') status_inbox = 'proposta_enviada'
  else status_inbox = 'proposta_recebida'

  return {
    desc,
    unread,
    itemClosed,
    iniciada_por,
    ultima_mensagem_de,
    precisa_responder,
    eh_proposta,
    status_inbox,
  }
}

function inferPropostaPorFromMessages(mensagens, userId, previewIniciada) {
  for (const m of mensagens) {
    if (m.tipo === 'oferta') {
      return m.de === 'vendedor' ? 'vendedor' : 'comprador'
    }
  }
  const first = mensagens.find((m) => m.tipo !== 'sistema' && m.de !== 'sistema')
  if (first) return first.de === 'vendedor' ? 'vendedor' : 'comprador'
  return previewIniciada
}

function refineClassification(conversa, raw, userId) {
  const meta = classifyFromInboxMeta(raw, userId)
  const fromMessages = inferPropostaPorFromMessages(conversa.mensagens || [], userId, meta.iniciada_por)
  const iniciada_por = fromMessages || meta.iniciada_por

  const lastMsg = (conversa.mensagens || []).filter((m) => m.tipo !== 'sistema').slice(-1)[0]
  let ultima_mensagem_de = meta.ultima_mensagem_de
  if (lastMsg) ultima_mensagem_de = lastMsg.de === 'vendedor' ? 'vendedor' : 'comprador'

  let precisa_responder = meta.precisa_responder
  if (!meta.itemClosed && meta.unread && ultima_mensagem_de === 'comprador') {
    precisa_responder = true
  }
  if (iniciada_por === 'vendedor' && ultima_mensagem_de === 'vendedor') {
    precisa_responder = false
  }

  let status_inbox = meta.status_inbox
  if (meta.itemClosed) status_inbox = 'arquivada'
  else if (precisa_responder) status_inbox = 'por_responder'
  else if (iniciada_por === 'vendedor') status_inbox = 'proposta_enviada'
  else status_inbox = 'proposta_recebida'

  return {
    iniciada_por,
    ultima_mensagem_de,
    status_inbox,
    vinted_unread: meta.unread,
    precisa_responder,
    eh_proposta: meta.eh_proposta,
  }
}

function isOfferEntity(entityType) {
  const t = String(entityType || '').toLowerCase()
  return t.includes('offer') || t.includes('proposta') || t.includes('price_suggestion')
}
