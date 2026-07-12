chrome.runtime.onInstalled.addListener(() => {
  console.log('Vinted Hub Sync v0.4 instalada')
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'syncFromPage') {
    handleSync(message.tabId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }
})

const DEFAULT_FUNCTIONS_URL = 'https://varmqpsxxmwtuxwltppn.supabase.co/functions/v1'

async function handleSync(explicitTabId) {
  const tab = await getVintedTab(explicitTabId)
  const tabId = tab.id

  const stored = await chrome.storage.local.get(['functionsUrl', 'syncSecret'])
  const functionsUrl = (stored.functionsUrl || DEFAULT_FUNCTIONS_URL).replace(/\/$/, '')
  const syncSecret = stored.syncSecret || ''

  if (!syncSecret) {
    throw new Error('Sync Secret em falta. Copia de /setup no dashboard.')
  }

  const data = await extractFromTab(tabId)

  const headers = {
    'Content-Type': 'application/json',
    'x-sync-secret': syncSecret,
  }

  const results = []

  if (data.artigos?.length) {
    const res = await fetch(`${functionsUrl}/sync-artigos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ artigos: data.artigos }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Erro ao sync artigos. Edge Functions deployadas?')
    results.push(`${json.synced} artigos`)
  }

  if (data.conversas?.length) {
    const res = await fetch(`${functionsUrl}/sync-conversas`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversas: data.conversas }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Erro ao sync conversas')
    results.push(`${json.synced} conversas`)
  }

  if (!results.length) {
    throw new Error('Nada encontrado. Confirma que estás logado na Vinted.')
  }

  return { ok: true, message: results.join(', ') }
}

async function getVintedTab(explicitTabId) {
  if (explicitTabId) {
    const tab = await chrome.tabs.get(explicitTabId)
    if (tab.url?.includes('vinted.')) return tab
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.url?.includes('vinted.')) return activeTab

  const vintedTabs = await chrome.tabs.query({ url: ['*://*.vinted.pt/*', '*://*.vinted.com/*'] })
  if (vintedTabs.length > 0) return vintedTabs[0]

  throw new Error('Abre vinted.pt numa tab e faz login primeiro.')
}

async function extractFromTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['vinted-api.js'],
    })
  } catch {
    // já injectado
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      if (!window.__vintedHub) {
        throw new Error('API Vinted não disponível. Recarrega a página (F5).')
      }
      return window.__vintedHub.syncAllFromVinted()
    },
  })

  if (injection?.result) return injection.result

  throw new Error('Não foi possível ler dados da Vinted. Recarrega a página (F5) e tenta outra vez.')
}
