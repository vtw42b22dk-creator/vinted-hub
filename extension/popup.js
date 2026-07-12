const functionsUrlInput = document.getElementById('functionsUrl')
const syncSecretInput = document.getElementById('syncSecret')
const syncBtn = document.getElementById('syncBtn')
const statusEl = document.getElementById('status')

const DEFAULT_FUNCTIONS_URL = 'https://varmqpsxxmwtuxwltppn.supabase.co/functions/v1'

chrome.storage.local.get(['functionsUrl', 'syncSecret'], (stored) => {
  functionsUrlInput.value = stored.functionsUrl || DEFAULT_FUNCTIONS_URL
  syncSecretInput.value = stored.syncSecret || ''
})

async function saveConfig() {
  const functionsUrl = functionsUrlInput.value.replace(/\/$/, '')
  const syncSecret = syncSecretInput.value.trim()
  await chrome.storage.local.set({ functionsUrl, syncSecret })
  return { functionsUrl, syncSecret }
}

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = type
  statusEl.style.display = 'block'
}

syncBtn.addEventListener('click', async () => {
  const { syncSecret } = await saveConfig()
  if (!syncSecret) {
    showStatus('✗ Sync Secret em falta — copia de /setup no dashboard', 'err')
    return
  }

  syncBtn.disabled = true
  showStatus('A sincronizar…', 'ok')

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    const result = await chrome.runtime.sendMessage({
      action: 'syncFromPage',
      tabId: tab?.url?.includes('vinted.') ? tab.id : undefined,
    })

    if (!result) {
      throw new Error('Extensão não respondeu. Vai a chrome://extensions e clica Recarregar.')
    }
    if (!result.ok) throw new Error(result.error || 'Sync falhou')

    showStatus(`✓ ${result.message}`, 'ok')
  } catch (err) {
    const msg = err.message?.includes('Receiving end')
      ? 'Extensão desatualizada. Recarrega em chrome://extensions → F5 na Vinted → tenta outra vez.'
      : err.message
    showStatus(`✗ ${msg}`, 'err')
  } finally {
    syncBtn.disabled = false
  }
})
