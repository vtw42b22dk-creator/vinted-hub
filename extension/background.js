import { SYNC_INTERVAL_MS } from './config.js'
import { getSyncSecret, saveSyncState, syncToSupabase } from './sync.js'

let syncTick = 0

chrome.runtime.onInstalled.addListener(() => {
  console.log('Vinted Hub Sync v1.1 instalada')
  chrome.storage.local.set({ autoSyncEnabled: true })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'syncFromPage') {
    handleSync(message.tabId, message.manual === true)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (message.action === 'configUpdated') {
    handleSync(undefined, false).then(() => {}).catch(() => {})
    sendResponse({ ok: true })
    return true
  }

  if (message.action === 'getSyncStatus') {
    chrome.storage.local
      .get(['lastSyncAt', 'lastSyncOk', 'lastSyncMessage', 'lastSyncError', 'syncSecret', 'autoSyncEnabled'])
      .then(sendResponse)
    return true
  }
})

async function handleSync(explicitTabId, manual) {
  const syncSecret = await getSyncSecret()
  if (!syncSecret) {
    const err = 'Abre o dashboard → /setup para ligar a extensão automaticamente.'
    await saveSyncState({ ok: false, error: err })
    throw new Error(err)
  }

  const tab = await getVintedTab(explicitTabId)
  syncTick += 1
  const fullSync = manual || syncTick % 8 === 0
  const data = await extractFromTab(tab.id, fullSync)

  if (!data.conversas?.length && !data.artigos?.length) {
    const err = 'Nada encontrado na Vinted. Confirma login em vinted.pt.'
    if (manual) await saveSyncState({ ok: false, error: err })
    throw new Error(err)
  }

  const result = await syncToSupabase(data, syncSecret)
  await saveSyncState({
    ok: true,
    message: `${fullSync ? 'Completo' : 'Rápido'}: ${result.message}`,
    at: new Date().toISOString(),
  })

  return result
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

async function injectVintedScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['vinted-inbox.js', 'vinted-api.js'],
  })
}

async function extractFromTab(tabId, fullSync) {
  try {
    await injectVintedScripts(tabId)
  } catch {
    // já injectado
  }

  const method = fullSync ? 'syncAllFromVinted' : 'syncInboxFast'

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (syncMethod) => {
      if (!window.__vintedHub?.[syncMethod]) {
        throw new Error('Recarrega a Vinted (F5) e tenta outra vez.')
      }
      return window.__vintedHub[syncMethod]()
    },
    args: [method],
  })

  if (injection?.result) return injection.result
  throw new Error('Não foi possível ler a Vinted. Recarrega a página (F5).')
}

chrome.alarms.create('autoSync', { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'autoSync') return
  const secret = await getSyncSecret()
  if (!secret) return
  const tabs = await chrome.tabs.query({ url: ['*://*.vinted.pt/*', '*://*.vinted.com/*'] })
  if (!tabs.length) return
  try {
    await handleSync(tabs[0].id, false)
  } catch (err) {
    await saveSyncState({ ok: false, error: err.message, at: new Date().toISOString() })
  }
})

setInterval(async () => {
  const { autoSyncEnabled } = await chrome.storage.local.get(['autoSyncEnabled'])
  if (autoSyncEnabled === false) return

  const secret = await getSyncSecret()
  if (!secret) return

  const tabs = await chrome.tabs.query({ url: ['*://*.vinted.pt/*', '*://*.vinted.com/*'] })
  if (!tabs.length) return

  try {
    await handleSync(tabs[0].id, false)
  } catch (err) {
    await saveSyncState({ ok: false, error: err.message, at: new Date().toISOString() })
  }
}, SYNC_INTERVAL_MS)
