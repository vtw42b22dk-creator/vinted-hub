// Cliente da API interna Vinted (usa cookies da sessão do browser)

function getCsrfToken() {
  return (
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
    document.querySelector('meta[name="csrf_token"]')?.getAttribute('content') ||
    ''
  )
}

async function vintedFetch(path) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': getCsrfToken(),
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Vinted API ${res.status}: ${text.slice(0, 120)}`)
  }

  return res.json()
}

async function fetchCurrentUser() {
  const data = await vintedFetch('/api/v2/users/current')
  return data.user || data
}

async function fetchAllInbox(currentUserId) {
  const conversas = []
  let page = 1
  const perPage = 50
  const maxPages = 5

  while (page <= maxPages) {
    const data = await vintedFetch(`/api/v2/inbox?page=${page}&per_page=${perPage}`)
    const batch = data.conversations || []

    for (const c of batch) {
      conversas.push(mapConversation(c, currentUserId))
    }

    const totalPages = data.pagination?.total_pages || 1
    if (page >= totalPages || batch.length === 0) break
    page++
  }

  return conversas
}

async function fetchAllUserItems(userId) {
  const artigos = []
  const seen = new Set()
  const endpoints = [
    (p) => `/api/v2/wardrobe/${userId}/items?page=${p}&per_page=96`,
    (p) => `/api/v2/users/${userId}/items?page=${p}&per_page=96`,
    (p) => `/api/v2/users/${userId}/items?page=${p}&per_page=96&status=active`,
    (p) => `/api/v2/wardrobe/${userId}/items?page=${p}&per_page=96&cond=active`,
    (p) => `/api/v2/users/${userId}/items?page=${p}&per_page=96&status=sold`,
    (p) => `/api/v2/wardrobe/${userId}/items?page=${p}&per_page=96&cond=sold`,
    (p) => `/api/v2/users/${userId}/items?page=${p}&per_page=96&status=hidden`,
    (p) => `/api/v2/wardrobe/${userId}/items?page=${p}&per_page=96&cond=hidden`,
    (p) => `/api/v2/users/${userId}/items?page=${p}&per_page=96&status=reserved`,
  ]

  for (const buildUrl of endpoints) {
    try {
      let page = 1
      while (page <= 10) {
        const url = buildUrl(page)
        const data = await vintedFetch(url)
        const items = data.items || data.wardrobe_items || data.user_items || []

        for (const item of items) {
          const mapped = mapItem(item, url)
          if (!seen.has(mapped.id_artigo)) {
            seen.add(mapped.id_artigo)
            artigos.push(mapped)
          }
        }

        const totalPages = data.pagination?.total_pages || 1
        if (page >= totalPages || items.length === 0) break
        page++
      }
    } catch {
      // tentar próximo endpoint
    }
  }

  return artigos
}

function mapConversation(c, currentUserId) {
  const desc = c.description || c.subtitle || ''
  const texto = desc.toLowerCase()
  const unread = Boolean(c.unread)
  const domain = window.location.origin

  const transaction = c.transaction || {}
  const itemClosed =
    transaction.status === 'completed' ||
    transaction.status === 'cancelled' ||
    /vendido|sold|eliminado|deleted|conclu/i.test(texto)

  const propostaRecebida =
    /fez uma proposta|proposta de|nova proposta|offer|oferta de/i.test(texto) ||
    (transaction.offer?.status === 'pending' && transaction.offer?.sender_id !== currentUserId)

  const propostaEnviada =
    /enviaste uma proposta|enviaste uma oferta|oferta enviada|proposta enviada/i.test(texto) ||
    (transaction.offer?.status === 'pending' && transaction.offer?.sender_id === currentUserId)

  let status_inbox = 'por_responder'

  if (itemClosed) {
    status_inbox = 'arquivada'
  } else if (propostaRecebida && unread) {
    status_inbox = 'proposta_recebida'
  } else if (propostaEnviada) {
    status_inbox = 'proposta_enviada'
  } else if (propostaRecebida && !unread) {
    status_inbox = 'em_negociacao'
  } else if (unread) {
    status_inbox = 'por_responder'
  } else if (/aceit|recus|negoci|enviar|envio/i.test(texto)) {
    status_inbox = 'em_negociacao'
  } else {
    status_inbox = 'em_negociacao'
  }

  const offerMatch = desc.match(/(\d+[,.]\d{2}|\d+)\s*€/)
  const valor_proposta =
    transaction.offer?.price != null
      ? parsePrice(transaction.offer.price)
      : offerMatch
        ? parseFloat(offerMatch[1].replace(',', '.'))
        : null

  const msgComprador = unread || /fez uma proposta|aceita|interess/i.test(texto)

  return {
    id_vinted: String(c.id),
    user_comprador: c.opposite_user?.login || 'desconhecido',
    avatar_comprador:
      c.opposite_user?.photo?.url ||
      c.opposite_user?.photo?.full_size_url ||
      c.item_photos?.[0]?.url ||
      null,
    ultimo_texto: desc,
    ultima_mensagem_de: msgComprador ? 'comprador' : 'vendedor',
    status_inbox,
    status_negocio: propostaRecebida || propostaEnviada ? 'proposta_pendente' : 'sem_proposta',
    valor_proposta,
    id_artigo_vinted: c.item_id ? String(c.item_id) : transaction.item_id ? String(transaction.item_id) : null,
    url_conversa: `${domain}/inbox/${c.id}`,
    item_fechado: itemClosed,
    vinted_unread: unread,
  }
}

function mapItem(item, sourceUrl) {
  const id = String(item.id)
  const domain = window.location.origin
  const urlHint = String(sourceUrl || '')

  return {
    id_artigo: id,
    nome: item.title || item.name || `Artigo ${id}`,
    marca: item.brand_title || item.brand?.title || null,
    tamanho: item.size_title || item.size?.title || null,
    preco_venda: parsePrice(item.price || item.total_item_price || item.price_amount),
    status_artigo: mapItemStatus(item, urlHint),
    foto_url:
      item.photo?.url ||
      item.photo?.full_size_url ||
      item.photos?.[0]?.url ||
      item.photos?.[0]?.full_size_url ||
      null,
    url_vinted: item.url || `${domain}/items/${id}`,
  }
}

function mapItemStatus(item, urlHint) {
  const hint = urlHint.toLowerCase()

  if (hint.includes('sold') || hint.includes('vendido')) return 'vendido'
  if (hint.includes('hidden') || hint.includes('oculto')) return 'oculto'
  if (hint.includes('reserved') || hint.includes('reserv')) return 'reservado'

  if (item.is_sold === true || item.sold === true || item.item_closing_action === 'sold') return 'vendido'
  if (item.is_hidden === true || item.is_visible === false || item.is_hidden === 1) return 'oculto'
  if (item.is_reserved === true || item.reserved === true) return 'reservado'

  const transaction = item.transaction || item.active_transaction || {}
  if (transaction.status === 'completed' || transaction.status === 'sold') return 'vendido'
  if (transaction.status === 'cancelled') return 'oculto'

  if (item.status === true || item.status === 1) return 'vendido'
  if (item.status === false || item.status === 0) return 'ativo'

  const s = String(item.status || item.state || item.item_status || item.status_title || 'active').toLowerCase()
  if (s.includes('sold') || s.includes('vendido') || s.includes('closed') || s.includes('completed')) return 'vendido'
  if (s.includes('reserv')) return 'reservado'
  if (s.includes('hidden') || s.includes('oculto') || s.includes('deleted') || s.includes('eliminado')) return 'oculto'
  if (s.includes('draft') || s.includes('rascunho')) return 'rascunho'
  return 'ativo'
}

function parsePrice(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const match = String(value).replace(',', '.').match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

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

function isSystemMessage(texto, entityType) {
  const type = String(entityType || '').toLowerCase()
  if (type.includes('action') || type.includes('status') || type.includes('system')) return true
  const t = String(texto || '').trim()
  if (!t) return true
  return SYSTEM_PATTERNS.some((re) => re.test(t))
}

function mapMessages(rawMessages, currentUserId, limit = 5) {
  const out = []

  for (const m of rawMessages) {
    const entity = m.entity || m
    const entityType = m.entity_type || entity.type || ''
    const texto = String(
      entity.body || entity.title || entity.message || entity.text || entity.content || m.body || ''
    ).trim()

    if (!texto) continue

    const userId = entity.user_id ?? entity.sender_id ?? m.user_id
    const isSystem = isSystemMessage(texto, entityType)

    out.push({
      texto,
      de: isSystem ? 'sistema' : String(userId) === String(currentUserId) ? 'vendedor' : 'comprador',
      data: m.created_at || entity.created_at || entity.created_at_ts || null,
      tipo: isSystem ? 'sistema' : 'mensagem',
    })
  }

  return out.slice(-limit)
}

async function fetchConversationMessages(conversationId, currentUserId, limit = 5) {
  const endpoints = [
    `/api/v2/conversations/${conversationId}/messages?per_page=30`,
    `/api/v2/inbox/${conversationId}/messages?per_page=30`,
    `/api/v2/conversations/${conversationId}?mark_as_read=false`,
  ]

  for (const path of endpoints) {
    try {
      const data = await vintedFetch(path)
      const raw =
        data.messages ||
        data.conversation?.messages ||
        data.conversation_thread?.messages ||
        []

      if (raw.length > 0) {
        return mapMessages(raw, currentUserId, limit)
      }
    } catch {
      // tentar próximo endpoint
    }
  }

  return []
}

async function enrichConversasWithMessages(conversas, userId) {
  const max = Math.min(conversas.length, 35)

  for (let i = 0; i < max; i++) {
    try {
      conversas[i].mensagens = await fetchConversationMessages(conversas[i].id_vinted, userId, 5)
      if (i > 0 && i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 200))
      }
    } catch {
      conversas[i].mensagens = []
    }
  }

  return conversas
}

async function syncAllFromVinted() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  let conversas = await fetchAllInbox(user.id)
  conversas = await enrichConversasWithMessages(conversas, user.id)

  const artigos = await fetchAllUserItems(user.id)

  return { artigos, conversas, user: user.login || user.username }
}

window.__vintedHub = {
  syncAllFromVinted,
  fetchAllInbox,
  fetchAllUserItems,
  fetchCurrentUser,
  fetchConversationMessages,
}
