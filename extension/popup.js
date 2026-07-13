const syncBtn = document.getElementById('syncBtn')
const statusEl = document.getElementById('status')
const setupLink = document.getElementById('setupLink')

function showStatus(text, type, dotClass) {
  statusEl.className = type
  statusEl.innerHTML = `<span class="dot ${dotClass}"></span>${text}`
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ action: 'getSyncStatus' })
  if (!status) {
    showStatus('Extensão não respondeu — recarrega em chrome://extensions', 'err', 'err')
    return
  }

  if (!status.syncSecret) {
    showStatus('Não ligada. Abre o dashboard e faz login.', 'err', 'err')
    return
  }

  if (status.lastSyncOk === false && status.lastSyncError) {
    showStatus(`Erro: ${status.lastSyncError}`, 'err', 'err')
    return
  }

  if (status.lastSyncAt) {
    const when = new Date(status.lastSyncAt).toLocaleTimeString('pt-PT')
    showStatus(`✓ ${status.lastSyncMessage || 'Sync OK'} (${when})`, 'ok', 'ok')
    return
  }

  showStatus('Ligada. Abre vinted.pt para sync automático.', 'wait', 'wait')
}

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true
  showStatus('A sincronizar…', 'wait', 'wait')

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const result = await chrome.runtime.sendMessage({
      action: 'syncFromPage',
      tabId: tab?.url?.includes('vinted.') ? tab.id : undefined,
      manual: true,
    })

    if (!result?.ok) throw new Error(result?.error || 'Sync falhou')
    showStatus(`✓ ${result.message}`, 'ok', 'ok')
  } catch (err) {
    showStatus(`✗ ${err.message}`, 'err', 'err')
  } finally {
    syncBtn.disabled = false
    setTimeout(refreshStatus, 500)
  }
})

refreshStatus()
setInterval(refreshStatus, 3000)
