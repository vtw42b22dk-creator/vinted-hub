// Content script — botões "Adicionar ao dashboard" na inbox da Vinted
// + sync automático do inventário

let syncTimer = null
let lastUrl = location.href
let syncing = false

// ---------- Sync automático (inventário) ----------

function scheduleAutoSync(delayMs = 5000) {
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
    extractAll()
      .then((data) => sendResponse({ data, ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }
})

async function extractAll() {
  if (!window.__vintedHub) {
    throw new Error('API Vinted não carregada. Recarrega a página.')
  }
  return window.__vintedHub.syncAllFromVinted()
}

// ---------- Adicionar conversa ao dashboard ----------

const BTN_CLASS = 'vinted-hub-add-btn'

async function addConversaToDashboard(conversationId, btn) {
  if (!window.__vintedHub?.buildConversaManual) {
    setBtnState(btn, 'erro', '✗ Recarrega (F5)')
    return
  }

  setBtnState(btn, 'loading', '…')
  try {
    const conversa = await window.__vintedHub.buildConversaManual(conversationId)
    const result = await chrome.runtime.sendMessage({ action: 'addConversa', conversa })
    if (result?.ok) {
      setBtnState(btn, 'ok', '✓ No dashboard')
    } else {
      setBtnState(btn, 'erro', `✗ ${result?.error || 'Erro'}`)
    }
  } catch (err) {
    setBtnState(btn, 'erro', `✗ ${err.message || 'Erro'}`)
  }

  setTimeout(() => setBtnState(btn, 'idle'), 4000)
}

function setBtnState(btn, state, label) {
  btn.dataset.state = state
  btn.textContent = label || '＋ Dashboard'
  btn.disabled = state === 'loading'
  btn.style.background =
    state === 'ok' ? '#059669' : state === 'erro' ? '#dc2626' : '#0f172a'
}

function makeAddButton(conversationId, small) {
  const btn = document.createElement('button')
  btn.className = BTN_CLASS
  btn.type = 'button'
  btn.textContent = '＋ Dashboard'
  btn.title = 'Adicionar esta conversa ao dashboard'
  btn.style.cssText = small
    ? 'flex-shrink:0;margin:4px 6px;padding:3px 8px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;z-index:9999'
    : 'padding:8px 14px;background:#0f172a;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif'

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    addConversaToDashboard(conversationId, btn)
  })

  return btn
}

function extractConversationId(href) {
  const match = String(href || '').match(/\/inbox\/(\d+)/)
  return match ? match[1] : null
}

// Botão pequeno ao lado de cada conversa na lista da inbox
function injectListButtons() {
  const links = document.querySelectorAll('a[href*="/inbox/"]')

  for (const link of links) {
    const id = extractConversationId(link.getAttribute('href'))
    if (!id) continue
    if (link.querySelector(`.${BTN_CLASS}`) || link.dataset.vintedHubBtn) continue

    link.dataset.vintedHubBtn = '1'
    link.style.position = link.style.position || 'relative'

    const btn = makeAddButton(id, true)
    btn.style.position = 'absolute'
    btn.style.right = '8px'
    btn.style.bottom = '6px'
    link.appendChild(btn)
  }
}

// Botão fixo quando estás dentro de uma conversa
function injectConversationButton() {
  const id = extractConversationId(location.pathname)
  const existing = document.getElementById('vinted-hub-conv-btn')

  if (!id) {
    existing?.remove()
    return
  }

  if (existing) {
    if (existing.dataset.convId === id) return
    existing.remove()
  }

  const wrapper = document.createElement('div')
  wrapper.id = 'vinted-hub-conv-btn'
  wrapper.dataset.convId = id
  wrapper.style.cssText =
    'position:fixed;top:70px;right:24px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.25);border-radius:10px'

  const btn = makeAddButton(id, false)
  btn.textContent = '＋ Adicionar ao dashboard'
  wrapper.appendChild(btn)
  document.body.appendChild(wrapper)
}

function watchDom() {
  const observer = new MutationObserver(() => {
    if (!location.pathname.includes('/inbox')) return
    injectListButtons()
    injectConversationButton()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  injectListButtons()
  injectConversationButton()
}

// ---------- Botão de sync do inventário ----------

function injectSyncButton() {
  if (document.getElementById('vinted-hub-sync-btn')) return

  const btn = document.createElement('button')
  btn.id = 'vinted-hub-sync-btn'
  btn.textContent = '⟳ Sync inventário'
  btn.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:99999;padding:12px 18px;background:#0f172a;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);font-family:system-ui,sans-serif'

  btn.addEventListener('click', async () => {
    btn.textContent = 'A sincronizar…'
    btn.disabled = true
    try {
      const result = await chrome.runtime.sendMessage({ action: 'syncFromPage', manual: true })
      btn.textContent = result?.ok ? `✓ ${result.message}` : '✗ Erro'
    } catch {
      btn.textContent = '✗ Recarrega extensão'
    }
    setTimeout(() => {
      btn.textContent = '⟳ Sync inventário'
      btn.disabled = false
    }, 4000)
  })

  document.body.appendChild(btn)
}

function watchNavigation() {
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      injectConversationButton()
    }
  }, 800)
}

function init() {
  injectSyncButton()
  watchDom()
  watchNavigation()
  scheduleAutoSync(4000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
