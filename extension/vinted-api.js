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
  const unread = Boolean(c.unread)
  const domain = window.location.origin
  const transaction = c.transaction || {}
  const itemClosed =
    transaction.status === 'completed' ||
    transaction.status === 'cancelled' ||
    /vendido|sold|eliminado|deleted|conclu/i.test(desc.toLowerCase())

  const offerMatch = desc.match(/(\d+[,.]\d{2}|\d+)\s*€/)
  const valor_proposta =
    transaction.offer?.price != null
      ? parsePrice(transaction.offer.price)
      : offerMatch
        ? parseFloat(offerMatch[1].replace(',', '.'))
        : null

  return {
    id_vinted: String(c.id),
    user_comprador: c.opposite_user?.login || 'desconhecido',
    avatar_comprador:
      c.opposite_user?.photo?.url ||
      c.opposite_user?.photo?.full_size_url ||
      c.item_photos?.[0]?.url ||
      null,
    ultimo_texto: desc,
    ultima_mensagem_de: unread ? 'comprador' : 'vendedor',
    status_inbox: itemClosed ? 'arquivada' : unread ? 'por_responder' : 'proposta_recebida',
    status_negocio: /proposta|oferta|offer/i.test(desc) ? 'proposta_pendente' : 'sem_proposta',
    valor_proposta,
    id_artigo_vinted: c.item_id ? String(c.item_id) : transaction.item_id ? String(transaction.item_id) : null,
    url_conversa: `${domain}/inbox/${c.id}`,
    item_fechado: itemClosed,
    vinted_unread: unread,
    iniciada_por: null,
    mensagens: [],
  }
}

function isMensagemReal(m) {
  return m.tipo !== 'sistema' && m.de !== 'sistema'
}

function classifyFromMessages(mensagens, unread, itemClosed) {
  if (itemClosed) {
    return { status_inbox: 'arquivada', iniciada_por: null, ultima_mensagem_de: 'comprador' }
  }

  const real = mensagens.filter(isMensagemReal)
  const first = real[0] || null
  const last = real.length ? real[real.length - 1] : null
  const iniciada_por = first ? (first.de === 'vendedor' ? 'vendedor' : 'comprador') : null
  const ultima_mensagem_de = last ? (last.de === 'vendedor' ? 'vendedor' : 'comprador') : 'comprador'

  if (unread && ultima_mensagem_de === 'comprador') {
    return { status_inbox: 'por_responder', iniciada_por, ultima_mensagem_de }
  }

  if (iniciada_por === 'vendedor') {
    return { status_inbox: 'proposta_enviada', iniciada_por, ultima_mensagem_de }
  }

  return {
    status_inbox: 'proposta_recebida',
    iniciada_por: iniciada_por || 'comprador',
    ultima_mensagem_de,
  }
}

function finalizeConversation(c) {
  const all = c.mensagens || []
  const classified = classifyFromMessages(all, c.vinted_unread, c.item_fechado)
  const lastReal = all.filter(isMensagemReal).slice(-1)[0]

  return {
    ...c,
    ...classified,
    mensagens: all.slice(-5),
    ultimo_texto: lastReal?.texto || c.ultimo_texto,
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

function mapMessagesAll(rawMessages, currentUserId) {
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

  out.sort((a, b) => {
    const ta = a.data ? new Date(a.data).getTime() : 0
    const tb = b.data ? new Date(b.data).getTime() : 0
    return ta - tb
  })

  return out
}

async function fetchConversationMessages(conversationId, currentUserId) {
  const endpoints = [
    `/api/v2/conversations/${conversationId}/messages?per_page=50`,
    `/api/v2/inbox/${conversationId}/messages?per_page=50`,
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
        return mapMessagesAll(raw, currentUserId)
      }
    } catch {
      // tentar próximo endpoint
    }
  }

  return []
}

async function enrichConversasWithMessages(conversas, userId) {
  for (let i = 0; i < conversas.length; i++) {
    try {
      conversas[i].mensagens = await fetchConversationMessages(conversas[i].id_vinted, userId)
      conversas[i] = finalizeConversation(conversas[i])
      if (i > 0 && i % 4 === 0) {
        await new Promise((r) => setTimeout(r, 250))
      }
    } catch {
      conversas[i].mensagens = []
      conversas[i] = finalizeConversation(conversas[i])
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
