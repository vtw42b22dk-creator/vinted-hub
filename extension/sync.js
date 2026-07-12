import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'

export async function syncToSupabase(data, syncSecret) {
  if (!syncSecret) {
    throw new Error('Sync secret em falta. Abre o dashboard → /setup (liga automaticamente).')
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
      p_conversas: data.conversas || [],
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
  if (json.conversas) parts.push(`${json.conversas} conversas`)

  return {
    ok: true,
    message: parts.join(', ') || 'Sync OK',
    artigos: json.artigos || 0,
    conversas: json.conversas || 0,
  }
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
