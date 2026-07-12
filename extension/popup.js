const apiUrlInput = document.getElementById('apiUrl')
const syncSecretInput = document.getElementById('syncSecret')
const syncBtn = document.getElementById('syncBtn')
const clearBtn = document.getElementById('clearBtn')
const statusEl = document.getElementById('status')

chrome.storage.local.get(['apiUrl', 'syncSecret'], (stored) => {
  apiUrlInput.value = stored.apiUrl || 'http://localhost:3000'
  syncSecretInput.value = stored.syncSecret || 'revenda-sync-2026-secreto'
})

async function saveConfig() {
  const apiUrl = apiUrlInput.value.replace(/\/$/, '')
  const syncSecret = syncSecretInput.value
  await chrome.storage.local.set({ apiUrl, syncSecret })
  return { apiUrl, syncSecret }
}

function showStatus(text, type) {
  statusEl.textContent = text
  statusEl.className = type
  statusEl.style.display = 'block'
}

syncBtn.addEventListener('click', async () => {
  await saveConfig()
  syncBtn.disabled = true
  showStatus('A sincronizar…', 'ok')

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    const result = await chrome.runtime.sendMessage({
      action: 'syncFromPage',
      tabId: tab?.url?.includes('vinted.') ? tab.id : undefined,
    })

    if (!result) {
      throw new Error('Extensão não respondeu. Vai a chrome://extensions e clica Recarregar na extensão.')
    }
    if (!result.ok) throw new Error(result.error || 'Sync falhou')

    showStatus(`✓ ${result.message}`, 'ok')
  } catch (err) {
    const msg = err.message?.includes('Receiving end')
      ? 'Extensão desatualizada. Vai a chrome://extensions → Recarregar → recarrega vinted.pt (F5) → tenta outra vez.'
      : err.message
    showStatus(`✗ ${msg}`, 'err')
  } finally {
    syncBtn.disabled = false
  }
})

clearBtn.addEventListener('click', async () => {
  const { apiUrl } = await saveConfig()
  clearBtn.disabled = true

  try {
    const res = await fetch(`${apiUrl}/api/dev/clear-demo`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Dashboard offline? Corre npm run dev')
    showStatus('✓ Dados demo apagados', 'ok')
  } catch (err) {
    showStatus(`✗ ${err.message}`, 'err')
  } finally {
    clearBtn.disabled = false
  }
})
