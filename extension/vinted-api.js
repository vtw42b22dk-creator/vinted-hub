// Cliente da API interna Vinted (usa cookies da sessão do browser)
// Depende de vinted-inbox.js (carregado antes no manifest)

const MESSAGE_FETCH_CONCURRENCY = 4
const MESSAGE_FETCH_MAX = 12
const MESSAGE_FETCH_BATCH_UNREAD = 50

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

function mergeConversation(existing, incoming) {
  if (!existing) return incoming

  const unread = existing.vinted_unread || incoming.vinted_unread
  const precisa = existing.precisa_responder || incoming.precisa_responder
  const existingTs = new Date(existing.data_atualizacao || 0).getTime()
  const incomingTs = new Date(incoming.data_atualizacao || 0).getTime()
  const base = incomingTs >= existingTs ? incoming : existing

  return {
    ...base,
    vinted_unread: unread,
    precisa_responder: precisa,
    status_inbox:
      unread || precisa
        ? 'por_responder'
        : base.status_inbox === 'por_responder'
          ? incoming.status_inbox
          : base.status_inbox,
  }
}

function dedupeConversations(conversas) {
  const map = new Map()
  for (const c of conversas) {
    const existing = map.get(c.id_vinted)
    map.set(c.id_vinted, mergeConversation(existing, c))
  }
  return [...map.values()]
}

async function fetchInboxPage(page, perPage, extraQuery = '') {
  const data = await vintedFetch(`/api/v2/inbox?page=${page}&per_page=${perPage}${extraQuery}`)
  return {
    conversations: data.conversations || data.inbox_conversations || [],
    totalPages: data.pagination?.total_pages || 1,
  }
}

async function fetchAllInbox(currentUserId) {
  const perPage = 50
  const maxPages = 15
  const collected = []

  const queries = [
    '',
    '&filter=unread',
    '&unread=1',
    '&folder=unread',
    '&status=unread',
  ]

  for (const extra of queries) {
    try {
      let page = 1
      while (page <= maxPages) {
        const { conversations, totalPages } = await fetchInboxPage(page, perPage, extra)
        for (const raw of conversations) {
          collected.push(mapConversation(raw, currentUserId))
        }
        if (page >= totalPages || conversations.length === 0) break
        page++
      }
    } catch {
      // endpoint alternativo pode não existir
    }
  }

  return dedupeConversations(collected).sort(
    (a, b) => new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
  )
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

function mapConversation(raw, currentUserId) {
  const meta = classifyFromInboxMeta(raw, currentUserId)
  const domain = window.location.origin
  const transaction = raw.transaction || {}

  const offerMatch = meta.desc.match(/(\d+[,.]\d{2}|\d+)\s*€/)
  const valor_proposta =
    transaction.offer?.price != null
      ? parsePrice(transaction.offer.price)
      : offerMatch
        ? parseFloat(offerMatch[1].replace(',', '.'))
        : null

  const updatedAt =
    raw.updated_at ||
    raw.last_message_at ||
    raw.last_message?.created_at ||
    transaction.updated_at ||
    new Date().toISOString()

  return {
    id_vinted: String(raw.id),
    user_comprador: raw.opposite_user?.login || raw.member?.login || 'desconhecido',
    avatar_comprador:
      raw.opposite_user?.photo?.url ||
      raw.opposite_user?.photo?.full_size_url ||
      raw.member?.photo?.url ||
      raw.item_photos?.[0]?.url ||
      null,
    ultimo_texto: meta.desc,
    ultima_mensagem_de: meta.ultima_mensagem_de,
    status_inbox: meta.status_inbox,
    status_negocio: /proposta|oferta|offer/i.test(meta.desc) ? 'proposta_pendente' : 'sem_proposta',
    valor_proposta,
    id_artigo_vinted: raw.item_id
      ? String(raw.item_id)
      : transaction.item_id
        ? String(transaction.item_id)
        : null,
    url_conversa: `${domain}/inbox/${raw.id}`,
    item_fechado: meta.itemClosed,
    vinted_unread: meta.unread,
    precisa_responder: meta.precisa_responder,
    iniciada_por: meta.iniciada_por,
    eh_proposta: meta.eh_proposta,
    data_atualizacao: updatedAt,
    mensagens: [],
    _raw: raw,
  }
}

function finalizeConversation(c) {
  const refined = refineClassification(c, c._raw || {}, c._userId)
  const lastReal = (c.mensagens || []).filter((m) => m.tipo !== 'sistema').slice(-1)[0]

  const out = {
    ...c,
    ...refined,
    mensagens: (c.mensagens || []).slice(-8).map(({ _entity, _entityType, ...rest }) => rest),
    ultimo_texto: lastReal?.texto || c.ultimo_texto,
  }

  delete out._raw
  delete out._userId
  return out
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
      data:
        m.created_at || entity.created_at || entity.created_at_ts || m.created_at_ts || null,
      tipo: isSystem ? 'sistema' : isOfferEntity(entityType) ? 'oferta' : 'mensagem',
      _entity: entity,
      _entityType: entityType,
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

  const detailPaths = [
    `/api/v2/conversations/${conversationId}?mark_as_read=false`,
    `/api/v2/inbox/${conversationId}?mark_as_read=false`,
    `/api/v2/conversations/${conversationId}/messages?per_page=100`,
  ]

  for (const path of detailPaths) {
    try {
      const data = await vintedFetch(path)
      addRaw(extractRawMessages(data))
    } catch {
      // tentar próximo
    }
  }

  for (let page = 1; page <= 5; page++) {
    const paths = [
      `/api/v2/conversations/${conversationId}/messages?page=${page}&per_page=100`,
      `/api/v2/inbox/${conversationId}/messages?page=${page}&per_page=100`,
    ]

    let pageMessages = []
    for (const path of paths) {
      try {
        const data = await vintedFetch(path)
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

async function runPool(items, worker, concurrency = MESSAGE_FETCH_CONCURRENCY) {
  const results = new Array(items.length)
  let cursor = 0

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

async function enrichConversasWithMessages(conversas, userId) {
  const withMeta = conversas.map((c) => ({ ...c, _userId: userId }))

  const toEnrich = withMeta
    .filter((c) => c.precisa_responder && c.vinted_unread)
    .slice(0, MESSAGE_FETCH_BATCH_UNREAD)

  const finalized = new Map()

  await runPool(toEnrich, async (conversa) => {
    try {
      conversa.mensagens = await fetchConversationMessages(conversa.id_vinted, userId)
    } catch {
      conversa.mensagens = []
    }
    finalized.set(conversa.id_vinted, finalizeConversation(conversa))
  })

  return withMeta.map((c) => finalized.get(c.id_vinted) || finalizeConversation(c))
}

async function syncInboxFast() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  const conversas = (await fetchAllInbox(user.id)).map((c) => {
    const fin = finalizeConversation({ ...c, _userId: user.id })
    return fin
  })

  return { artigos: [], conversas, user: user.login || user.username, fast: true }
}

async function syncAllFromVinted() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  const conversasRaw = await fetchAllInbox(user.id)
  const [conversas, artigos] = await Promise.all([
    enrichConversasWithMessages(conversasRaw, user.id),
    fetchAllUserItems(user.id),
  ])

  return { artigos, conversas, user: user.login || user.username }
}

window.__vintedHub = {
  syncAllFromVinted,
  syncInboxFast,
  fetchAllInbox,
  fetchAllUserItems,
  fetchCurrentUser,
  fetchConversationMessages,
}
