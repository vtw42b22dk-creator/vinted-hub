// Cliente da API interna Vinted (usa cookies da sessão do browser)

const MESSAGE_FETCH_MAX = 30
const ITEM_DETAIL_CONCURRENCY = 5
const ITEM_DETAIL_MAX = 200

async function runPool(items, worker, concurrency = ITEM_DETAIL_CONCURRENCY) {
  let cursor = 0
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  await Promise.all(workers)
}

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
    descricao: item.description ? String(item.description).trim() : null,
    categoria: extractCategoria(item),
    foto_url:
      item.photo?.url ||
      item.photo?.full_size_url ||
      item.photos?.[0]?.url ||
      item.photos?.[0]?.full_size_url ||
      null,
    url_vinted: item.url || `${domain}/items/${id}`,
  }
}

function extractCategoria(item) {
  const branch = item.catalog_branch_title || item.catalog_branch || item.breadcrumbs
  if (Array.isArray(branch)) {
    return branch.map((b) => (typeof b === 'string' ? b : b?.title)).filter(Boolean).join(' / ') || null
  }
  return (
    item.catalog_branch_title ||
    item.category_title ||
    item.catalog_title ||
    item.category?.title ||
    item.catalog?.title ||
    null
  )
}

async function fetchItemDetail(itemId) {
  try {
    const data = await vintedFetch(`/api/v2/items/${itemId}`)
    return data.item || data
  } catch {
    return null
  }
}

// Enriquece os artigos à venda com descrição/categoria (detalhe de cada anúncio)
async function enrichActiveItems(artigos) {
  const active = artigos
    .filter((a) => a.status_artigo === 'ativo' || a.status_artigo === 'reservado')
    .slice(0, ITEM_DETAIL_MAX)

  await runPool(active, async (a) => {
    const detail = await fetchItemDetail(a.id_artigo)
    if (!detail) return
    const desc = String(detail.description || detail.body || '').trim()
    if (desc) a.descricao = desc
    const cat = extractCategoria(detail)
    if (cat) a.categoria = cat
    if (!a.preco_venda) a.preco_venda = parsePrice(detail.price || detail.total_item_price)
    if (!a.marca) a.marca = detail.brand_title || detail.brand?.title || a.marca
    if (!a.tamanho) a.tamanho = detail.size_title || detail.size?.title || a.tamanho
  })

  return artigos
}

// ---------- Vendas (my_orders?order_type=sold) ----------

function mapVenda(order) {
  const id =
    order.id ?? order.transaction_id ?? order.transaction?.id ?? order.order_id ?? order.item_id
  if (id == null) return null

  const buyer = order.buyer || order.user || order.opposite_user || order.transaction?.buyer || {}
  const item = order.item || order.transaction?.item || {}
  const itemId = order.item_id ?? item.id ?? order.transaction?.item_id ?? null

  const foto =
    order.photo?.url ||
    order.image_url ||
    order.thumbnail_url ||
    item.photo?.url ||
    (Array.isArray(order.item_photos) ? order.item_photos[0]?.url : null) ||
    null

  const preco = parsePrice(
    order.price ??
      order.item_price ??
      order.total_item_price ??
      order.transaction?.item_price ??
      order.amount ??
      item.price
  )

  let data =
    order.date ||
    order.completed_at ||
    order.sold_at ||
    order.updated_at ||
    order.transaction?.updated_at ||
    order.created_at ||
    new Date().toISOString()
  if (typeof data === 'number') {
    data = new Date(data * (data < 1e12 ? 1000 : 1)).toISOString()
  }

  return {
    id_venda: String(id),
    titulo: order.title || order.item_title || item.title || 'Venda',
    preco,
    comprador: buyer.login || buyer.username || null,
    foto_url: foto,
    url_venda: itemId != null ? `${window.location.origin}/items/${itemId}` : null,
    id_artigo: itemId != null ? String(itemId) : null,
    data_venda: data,
  }
}

async function fetchOrders(orderType, mapper) {
  const collected = []
  const seen = new Set()

  const builders = [
    (p) => `/api/v2/my_orders?type=${orderType}&page=${p}&per_page=20`,
    (p) => `/api/v2/my_orders?order_type=${orderType}&page=${p}&per_page=20`,
  ]

  for (const build of builders) {
    try {
      let page = 1
      while (page <= 25) {
        const data = await vintedFetch(build(page))
        const orders =
          data.my_orders || data.orders || data.items || data.transactions || []
        if (!orders.length) break

        for (const o of orders) {
          const mapped = mapper(o)
          if (mapped && !seen.has(mapped._key)) {
            seen.add(mapped._key)
            collected.push(mapped.value)
          }
        }

        const totalPages = data.pagination?.total_pages || 1
        if (page >= totalPages) break
        page++
      }
      if (collected.length) break
    } catch {
      // tentar próximo endpoint
    }
  }

  return collected
}

async function fetchSoldOrders() {
  return fetchOrders('sold', (o) => {
    const v = mapVenda(o)
    return v ? { _key: v.id_venda, value: v } : null
  })
}

function mapCompra(order) {
  const id =
    order.id ?? order.transaction_id ?? order.transaction?.id ?? order.order_id ?? order.item_id
  if (id == null) return null

  const seller = order.seller || order.user || order.opposite_user || order.transaction?.seller || {}
  const item = order.item || order.transaction?.item || {}
  const itemId = order.item_id ?? item.id ?? order.transaction?.item_id ?? null

  const foto =
    order.photo?.url ||
    order.image_url ||
    order.thumbnail_url ||
    item.photo?.url ||
    (Array.isArray(order.item_photos) ? order.item_photos[0]?.url : null) ||
    null

  const preco = parsePrice(
    order.price ??
      order.item_price ??
      order.total_item_price ??
      order.transaction?.item_price ??
      order.amount ??
      item.price
  )

  let data =
    order.date ||
    order.completed_at ||
    order.purchased_at ||
    order.updated_at ||
    order.transaction?.updated_at ||
    order.created_at ||
    new Date().toISOString()
  if (typeof data === 'number') {
    data = new Date(data * (data < 1e12 ? 1000 : 1)).toISOString()
  }

  return {
    id_compra: String(id),
    titulo: order.title || order.item_title || item.title || 'Compra',
    preco_compra: preco,
    vendedor: seller.login || seller.username || null,
    foto_url: foto,
    url_compra: itemId != null ? `${window.location.origin}/items/${itemId}` : null,
    id_artigo: itemId != null ? String(itemId) : null,
    data_compra: data,
  }
}

async function fetchPurchasedOrders() {
  return fetchOrders('purchased', (o) => {
    const c = mapCompra(o)
    return c ? { _key: c.id_compra, value: c } : null
  })
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
  // A Vinted devolve muitas vezes { amount: "12.5", currency_code: "EUR" }
  if (typeof value === 'object') {
    return parsePrice(value.amount ?? value.value ?? value.price ?? null)
  }
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
  await enrichActiveItems(artigos)
  const compras = await fetchPurchasedOrders()
  const synced_ids = artigos.map((a) => a.id_artigo)

  // Vendas já não são lidas automaticamente — são registadas ao mover
  // uma compra para "vendidos" no dashboard.
  return { artigos, vendas: [], compras, synced_ids, user: user.login || user.username }
}

window.__vintedHub = {
  syncAllFromVinted,
  fetchAllUserItems,
  fetchSoldOrders,
  fetchPurchasedOrders,
  fetchCurrentUser,
  fetchConversationMessages,
  buildConversaManual,
}
