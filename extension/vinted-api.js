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
  ]

  for (const buildUrl of endpoints) {
    try {
      let page = 1
      while (page <= 10) {
        const data = await vintedFetch(buildUrl(page))
        const items = data.items || data.wardrobe_items || data.user_items || []

        for (const item of items) {
          const mapped = mapItem(item)
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

function mapItem(item) {
  const id = String(item.id)
  const domain = window.location.origin

  return {
    id_artigo: id,
    nome: item.title || item.name || `Artigo ${id}`,
    marca: item.brand_title || item.brand?.title || null,
    tamanho: item.size_title || item.size?.title || null,
    preco_venda: parsePrice(item.price || item.total_item_price || item.price_amount),
    status_artigo: mapItemStatus(item.status || item.state || item.is_closed),
    foto_url:
      item.photo?.url ||
      item.photo?.full_size_url ||
      item.photos?.[0]?.url ||
      item.photos?.[0]?.full_size_url ||
      null,
    url_vinted: item.url || `${domain}/items/${id}`,
  }
}

function mapItemStatus(status) {
  if (status === true || status === 1) return 'vendido'
  const s = String(status || 'active').toLowerCase()
  if (s.includes('sold') || s.includes('vendido') || s.includes('closed')) return 'vendido'
  if (s.includes('reserv')) return 'reservado'
  if (s.includes('hidden') || s.includes('oculto')) return 'oculto'
  if (s.includes('draft') || s.includes('rascunho')) return 'rascunho'
  return 'ativo'
}

function parsePrice(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const match = String(value).replace(',', '.').match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

async function syncAllFromVinted() {
  const user = await fetchCurrentUser()
  if (!user?.id) {
    throw new Error('Não estás logado na Vinted. Faz login em vinted.pt primeiro.')
  }

  const [conversas, artigos] = await Promise.all([
    fetchAllInbox(user.id),
    fetchAllUserItems(user.id),
  ])

  return { artigos, conversas, user: user.login || user.username }
}

window.__vintedHub = { syncAllFromVinted, fetchAllInbox, fetchAllUserItems, fetchCurrentUser }
