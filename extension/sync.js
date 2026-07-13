import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'

export async function syncToSupabase(data, syncSecret) {
  if (!syncSecret) {
    throw new Error('Sync secret em falta. Abre o dashboard com login (liga automaticamente).')
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_from_vinted`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      p_sync_secret: syncSecret,
      p_artigos: data.artigos || [],
      p_vendas: data.vendas || [],
      p_compras: data.compras || [],
      p_synced_ids: data.synced_ids || [],
    }),
  })

  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }

  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      json.hint ||
      (res.status === 404
        ? 'Função sync não encontrada — corre supabase/sync-rpc.sql no Supabase'
        : `Erro ${res.status} ao sincronizar`)
    throw new Error(msg)
  }

  const parts = []
  if (json.artigos) parts.push(`${json.artigos} artigos`)
  if (json.vendas) parts.push(`${json.vendas} vendas`)
  if (json.compras) parts.push(`${json.compras} compras`)

  return {
    ok: true,
    message: parts.join(', ') || 'Sync OK',
    artigos: json.artigos || 0,
    vendas: json.vendas || 0,
    compras: json.compras || 0,
  }
}

export async function getPastasFromSupabase(syncSecret) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_pastas_ext`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_sync_secret: syncSecret }),
  })

  if (!res.ok) return []
  try {
    const json = await res.json()
    return Array.isArray(json) ? json : []
  } catch {
    return []
  }
}

export async function addConversaToSupabase(conversa, syncSecret) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_conversa_manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      p_sync_secret: syncSecret,
      p_conversa: conversa,
    }),
  })

  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }

  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      json.hint ||
      (res.status === 404
        ? 'Corre supabase/sync-rpc.sql no Supabase'
        : `Erro ${res.status}`)
    throw new Error(msg)
  }

  return { ok: true }
}

export async function addRelevanteToSupabase(item, syncSecret) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_relevante`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      p_sync_secret: syncSecret,
      p_item: item,
    }),
  })

  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }

  if (!res.ok) {
    const msg =
      json.message ||
      json.error ||
      json.hint ||
      (res.status === 404 ? 'Corre supabase/sync-rpc.sql no Supabase' : `Erro ${res.status}`)
    throw new Error(msg)
  }

  return { ok: true }
}

export async function saveSyncState(state) {
  await chrome.storage.local.set({
    lastSyncAt: state.at || new Date().toISOString(),
    lastSyncOk: state.ok,
    lastSyncMessage: state.message || '',
    lastSyncError: state.error || '',
  })
}

export async function getSyncSecret() {
  const stored = await chrome.storage.local.get(['syncSecret'])
  return (stored.syncSecret || '').trim()
}
