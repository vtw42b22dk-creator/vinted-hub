// Cliente da API interna Vinted (usa cookies da sessão do browser)

const MESSAGE_FETCH_MAX = 30

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

// ---------- Inventário (sync automático) ----------

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

// ---------- Mensagens de uma conversa ----------

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

function isOfferEntity(entityType) {
  const t = String(entityType || '').toLowerCase()
  return t.includes('offer') || t.includes('proposta') || t.includes('price_suggestion')
}

function isSystemMessage(texto, entityType) {
  const type = String(entityType || '').toLowerCase()
  if (type.includes('action') || type.includes('status') || type.includes('system')) return true
  const t = String(texto || '').trim()
  if (!t) return true
  return SYSTEM_PATTERNS.some((re) => re.test(t))
}

function extractMessageText(entity, m) {
  return String(
    entity.body ||
      entity.title ||
      entity.message ||
      entity.text ||
      entity.content ||
      entity.offer?.price ||
      m.body ||
      m.text ||
      ''
  ).trim()
}

function extractUserId(entity, m) {
  return entity.user_id ?? entity.sender_id ?? entity.member_id ?? m.user_id ?? m.sender_id ?? null
}

function mapMessagesAll(rawMessages, currentUserId) {
  const out = []

  for (const m of rawMessages) {
    const entity = m.entity || m
    const entityType = m.entity_type || entity.type || m.type || ''
    const texto = extractMessageText(entity, m)
    if (!texto) continue

    const userId = extractUserId(entity, m)
    const isSystem = isSystemMessage(texto, entityType) && !isOfferEntity(entityType)

    out.push({
      texto,
      de: isSystem ? 'sistema' : String(userId) === String(currentUserId) ? 'vendedor' : 'comprador',
      data: m.created_at || entity.created_at || entity.created_at_ts || m.created_at_ts || null,
      tipo: isSystem ? 'sistema' : isOfferEntity(entityType) ? 'oferta' : 'mensagem',
    })
  }

  out.sort((a, b) => {
    const ta = a.data ? new Date(a.data).getTime() : 0
    const tb = b.data ? new Date(b.data).getTime() : 0
    return ta - tb
  })

  return out
}

function extractRawMessages(data) {
  return (
    data.messages ||
    data.conversation?.messages ||
    data.conversation_thread?.messages ||
    data.thread?.messages ||
    []
  )
}

async function fetchConversationDetail(conversationId) {
  const paths = [
    `/api/v2/conversations/${conversationId}`,
    `/api/v2/inbox/${conversationId}`,
  ]
  for (const path of paths) {
    try {
      const data = await vintedFetch(path)
      return data.conversation || data
    } catch {
      // tentar próximo
    }
  }
  return null
}

async function fetchConversationMessages(conversationId, currentUserId) {
  const collected = []
  const seen = new Set()

  function addRaw(batch) {
    for (const m of batch) {
      const id = m.id || m.entity?.id || JSON.stringify(m).slice(0, 80)
      if (!seen.has(id)) {
        seen.add(id)
        collected.push(m)
      }
    }
  }

  const detail = await fetchConversationDetail(conversationId)
  if (detail) addRaw(extractRawMessages(detail))

  const pagePaths = [
    (p) => `/api/v2/conversations/${conversationId}/messages?page=${p}&per_page=100`,
    (p) => `/api/v2/inbox/${conversationId}/messages?page=${p}&per_page=100`,
  ]

  for (let page = 1; page <= 3; page++) {
    let pageMessages = []
    for (const buildPath of pagePaths) {
      try {
        const data = await vintedFetch(buildPath(page))
        pageMessages = extractRawMessages(data)
        if (pageMessages.length) break
      } catch {
        // tentar próximo
      }
    }

    if (!pageMessages.length) break
    addRaw(pageMessages)
    if (pageMessages.length < 100) break
  }

  if (!collected.length) return []
  return mapMessagesAll(collected, currentUserId).slice(-MESSAGE_FETCH_MAX)
}

// ---------- Adicionar conversa manualmente ao dashboard ----------

async function buildConversaManual(conversationId) {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted.')
  }

  const detail = (await fetchConversationDetail(conversationId)) || {}
  const mensagens = await fetchConversationMessages(conversationId, user.id)

  const opposite = detail.opposite_user || detail.member || {}
  const transaction = detail.transaction || detail.active_transaction || {}
  const lastReal = mensagens.filter((m) => m.tipo !== 'sistema').slice(-1)[0]

  const valorProposta =
    transaction.offer?.price != null ? parsePrice(transaction.offer.price) : null

  return {
    id_vinted: String(conversationId),
    user_comprador: opposite.login || opposite.username || 'desconhecido',
    avatar_comprador: opposite.photo?.url || opposite.photo?.full_size_url || null,
    ultimo_texto: lastReal?.texto || detail.description || detail.subtitle || null,
    ultima_mensagem_de: lastReal?.de === 'vendedor' ? 'vendedor' : 'comprador',
    status_negocio: transaction.offer ? 'proposta_pendente' : 'sem_proposta',
    valor_proposta: valorProposta,
    id_artigo_vinted: detail.item_id
      ? String(detail.item_id)
      : transaction.item_id
        ? String(transaction.item_id)
        : null,
    url_conversa: `${window.location.origin}/inbox/${conversationId}`,
    item_fechado: transaction.status === 'completed' || transaction.status === 'cancelled',
    data_atualizacao:
      detail.updated_at || lastReal?.data || new Date().toISOString(),
    mensagens,
  }
}

// ---------- Sync automático (só inventário) ----------

async function syncAllFromVinted() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  const artigos = await fetchAllUserItems(user.id)
  return { artigos, conversas: [], user: user.login || user.username }
}

window.__vintedHub = {
  syncAllFromVinted,
  fetchAllUserItems,
  fetchCurrentUser,
  fetchConversationMessages,
  buildConversaManual,
}
