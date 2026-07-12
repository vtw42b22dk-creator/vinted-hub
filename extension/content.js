// Content script — sync automático quando a Vinted atualiza

let syncTimer = null
let lastUrl = location.href
let syncing = false

function scheduleAutoSync(delayMs = 4000) {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(runAutoSync, delayMs)
}

async function runAutoSync() {
  if (syncing) return
  syncing = true
  try {
    await chrome.runtime.sendMessage({ action: 'syncFromPage' })
  } catch {
    // extensão ou background indisponível
  } finally {
    syncing = false
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'extract') {
    syncAllFromVinted()
      .then((data) => sendResponse({ data, ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }
})

async function syncAllFromVinted() {
  if (!window.__vintedHub) {
    throw new Error('API Vinted não carregada. Recarrega a página.')
  }
  return window.__vintedHub.syncAllFromVinted()
}

function injectSyncButton() {
  if (document.getElementById('vinted-hub-sync-btn')) return

  const btn = document.createElement('button')
  btn.id = 'vinted-hub-sync-btn'
  btn.textContent = '⟳ Sync Hub'
  btn.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:99999;padding:12px 18px;background:#0f172a;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);font-family:system-ui,sans-serif'

  btn.addEventListener('click', async () => {
    btn.textContent = 'A sincronizar…'
    btn.disabled = true
    try {
      const result = await chrome.runtime.sendMessage({ action: 'syncFromPage' })
      btn.textContent = result?.ok ? `✓ ${result.message}` : '✗ Erro'
    } catch {
      btn.textContent = '✗ Recarrega extensão'
    }
    setTimeout(() => {
      btn.textContent = '⟳ Sync Hub'
      btn.disabled = false
    }, 4000)
  })

  document.body.appendChild(btn)
}

function watchNavigation() {
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      scheduleAutoSync(2000)
    }
  }, 1000)
}

function init() {
  injectSyncButton()
  watchNavigation()
  scheduleAutoSync(3000)
  setInterval(() => scheduleAutoSync(1000), 10000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
