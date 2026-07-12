// Ponte dashboard ↔ extensão — configura sync secret automaticamente

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== 'VINTED_HUB_CONFIG') return

  chrome.storage.local.set({
    syncSecret: data.syncSecret || '',
    configuredAt: new Date().toISOString(),
  })

  chrome.runtime.sendMessage({ action: 'configUpdated' }).catch(() => {})
})

// Pedir config ao dashboard se a página expuser
window.postMessage({ type: 'VINTED_HUB_REQUEST_CONFIG' }, '*')
