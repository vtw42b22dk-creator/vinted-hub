// Cliente da API interna Vinted (usa cookies da sessão do browser)

const MESSAGE_FETCH_CONCURRENCY = 4
const MESSAGE_FETCH_BATCH = 40

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

function dedupeConversations(conversas) {
  const map = new Map()
  for (const c of conversas) {
    const existing = map.get(c.id_vinted)
    if (!existing || c.vinted_unread || c.data_atualizacao > existing.data_atualizacao) {
      map.set(c.id_vinted, c)
    }
  }
  return [...map.values()]
}

async function fetchInboxPage(page, perPage, extraQuery = '') {
  const data = await vintedFetch(`/api/v2/inbox?page=${page}&per_page=${perPage}${extraQuery}`)
  return {
    conversations: data.conversations || [],
    totalPages: data.pagination?.total_pages || 1,
  }
}

async function fetchAllInbox(currentUserId) {
  const perPage = 50
  const maxPages = 12
  const collected = []

  const queries = ['', '&filter=unread', '&unread=1']

  for (const extra of queries) {
    try {
      let page = 1
      while (page <= maxPages) {
        const { conversations, totalPages } = await fetchInboxPage(page, perPage, extra)
        for (const c of conversations) {
          collected.push(mapConversation(c, currentUserId))
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

function isItemClosed(c) {
  const transaction = c.transaction || {}
  return transaction.status === 'completed' || transaction.status === 'cancelled'
}

function inferIniciadaFromPreview(texto) {
  const t = String(texto || '').toLowerCase()
  if (/enviaste|you sent|mensagem enviada|proposta enviada|oferta enviada/i.test(t)) return 'vendedor'
  if (/fez uma proposta|sent you|enviou-te|nova mensagem|new message|interess/i.test(t)) return 'comprador'
  return null
}

function mapConversation(c, currentUserId) {
  const desc = c.description || c.subtitle || c.last_message?.body || ''
  const unread = Boolean(c.unread)
  const domain = window.location.origin
  const transaction = c.transaction || {}
  const itemClosed = isItemClosed(c)

  const offerMatch = desc.match(/(\d+[,.]\d{2}|\d+)\s*€/)
  const valor_proposta =
    transaction.offer?.price != null
      ? parsePrice(transaction.offer.price)
      : offerMatch
        ? parseFloat(offerMatch[1].replace(',', '.'))
        : null

  const updatedAt =
    c.updated_at ||
    c.last_message_at ||
    c.last_message?.created_at ||
    transaction.updated_at ||
    new Date().toISOString()

  const iniciadaPreview = inferIniciadaFromPreview(desc)

  return {
    id_vinted: String(c.id),
    user_comprador: c.opposite_user?.login || c.member?.login || 'desconhecido',
    avatar_comprador:
      c.opposite_user?.photo?.url ||
      c.opposite_user?.photo?.full_size_url ||
      c.member?.photo?.url ||
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
    iniciada_por: iniciadaPreview,
    data_atualizacao: updatedAt,
    mensagens: [],
  }
}

function isMensagemReal(m) {
  return m.tipo !== 'sistema' && m.de !== 'sistema'
}

function classifyConversation(c) {
  if (c.item_fechado) {
    return { status_inbox: 'arquivada', iniciada_por: c.iniciada_por, ultima_mensagem_de: 'comprador' }
  }

  const all = c.mensagens || []
  const real = all.filter(isMensagemReal)
  const first = real[0] || null
  const last = real.length ? real[real.length - 1] : null

  const iniciada_por = first
    ? first.de === 'vendedor'
      ? 'vendedor'
      : 'comprador'
    : c.iniciada_por || 'comprador'

  const ultima_mensagem_de = last ? (last.de === 'vendedor' ? 'vendedor' : 'comprador') : c.ultima_mensagem_de

  // unread da Vinted tem prioridade absoluta
  if (c.vinted_unread) {
    return { status_inbox: 'por_responder', iniciada_por, ultima_mensagem_de: 'comprador' }
  }

  return {
    status_inbox: iniciada_por === 'vendedor' ? 'proposta_enviada' : 'proposta_recebida',
    iniciada_por,
    ultima_mensagem_de,
  }
}

function finalizeConversation(c) {
  const classified = classifyConversation(c)
  const lastReal = (c.mensagens || []).filter(isMensagemReal).slice(-1)[0]

  return {
    ...c,
    ...classified,
    mensagens: (c.mensagens || []).slice(-8),
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

function extractMessageText(entity, m) {
  return String(
    entity.body ||
      entity.title ||
      entity.message ||
      entity.text ||
      entity.content ||
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
    const isSystem = isSystemMessage(texto, entityType)

    out.push({
      texto,
      de: isSystem ? 'sistema' : String(userId) === String(currentUserId) ? 'vendedor' : 'comprador',
      data:
        m.created_at ||
        entity.created_at ||
        entity.created_at_ts ||
        m.created_at_ts ||
        null,
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

  const detailPaths = [
    `/api/v2/conversations/${conversationId}?mark_as_read=false`,
    `/api/v2/inbox/${conversationId}?mark_as_read=false`,
  ]

  for (const path of detailPaths) {
    try {
      const data = await vintedFetch(path)
      const raw = extractRawMessages(data)
      if (raw.length) collected.push(...raw)
    } catch {
      // tentar próximo
    }
  }

  for (let page = 1; page <= 4; page++) {
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
    collected.push(...pageMessages)
    if (pageMessages.length < 100) break
  }

  if (!collected.length) return []
  return mapMessagesAll(collected, currentUserId)
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

function prioritizeForEnrichment(conversas) {
  return [...conversas].sort((a, b) => {
    if (a.vinted_unread !== b.vinted_unread) return a.vinted_unread ? -1 : 1
    return new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
  })
}

async function enrichConversasWithMessages(conversas, userId) {
  const quick = conversas.map((c) => finalizeConversation(c))
  const priority = prioritizeForEnrichment(quick)
  const toEnrich = priority.slice(0, MESSAGE_FETCH_BATCH)
  const rest = priority.slice(MESSAGE_FETCH_BATCH)

  await runPool(toEnrich, async (conversa) => {
    try {
      conversa.mensagens = await fetchConversationMessages(conversa.id_vinted, userId)
    } catch {
      conversa.mensagens = []
    }
    return finalizeConversation(conversa)
  })

  return [...toEnrich, ...rest.map((c) => finalizeConversation(c))]
}

async function syncAllFromVinted() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  const conversasPromise = fetchAllInbox(user.id).then((list) => enrichConversasWithMessages(list, user.id))
  const artigosPromise = fetchAllUserItems(user.id)

  const [conversas, artigos] = await Promise.all([conversasPromise, artigosPromise])

  return { artigos, conversas, user: user.login || user.username }
}

window.__vintedHub = {
  syncAllFromVinted,
  fetchAllInbox,
  fetchAllUserItems,
  fetchCurrentUser,
  fetchConversationMessages,
}
