// Content script — botão "Adicionar ao dashboard" fixo no canto do ecrã
// + sync automático do inventário (silencioso, em segundo plano)

let syncTimer = null
let lastUrl = location.href
let syncing = false

// ---------- Sync automático (inventário, silencioso) ----------

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

// ---------- Botão fixo no canto ----------

const WRAPPER_ID = 'vinted-hub-add-wrapper'

function extractConversationId(href) {
  const match = String(href || '').match(/\/inbox\/(\d+)/)
  return match ? match[1] : null
}

function currentConversationId() {
  return extractConversationId(location.pathname)
}

function ensureCornerButton() {
  const onInbox = location.pathname.includes('/inbox')
  let wrapper = document.getElementById(WRAPPER_ID)

  if (!onInbox) {
    wrapper?.remove()
    return
  }

  if (wrapper) return

  wrapper = document.createElement('div')
  wrapper.id = WRAPPER_ID
  wrapper.style.cssText =
    'position:fixed;bottom:20px;left:20px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-family:system-ui,sans-serif'

  const menu = document.createElement('div')
  menu.id = 'vinted-hub-pasta-menu'
  menu.style.cssText =
    'display:none;flex-direction:column;gap:2px;min-width:220px;max-height:280px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:6px'

  const btn = document.createElement('button')
  btn.id = 'vinted-hub-add-btn'
  btn.type = 'button'
  btn.style.cssText =
    'padding:12px 18px;background:#0f172a;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3)'
  setCornerState(btn, 'idle')

  btn.addEventListener('click', () => onCornerClick(btn, menu))

  wrapper.appendChild(menu)
  wrapper.appendChild(btn)
  document.body.appendChild(wrapper)
}

function setCornerState(btn, state, label) {
  btn.dataset.state = state
  btn.disabled = state === 'loading'
  btn.textContent =
    label ||
    (state === 'loading' ? 'A adicionar…' : '＋ Adicionar conversa ao dashboard')
  btn.style.background =
    state === 'ok' ? '#059669' : state === 'erro' ? '#dc2626' : '#0f172a'
}

async function onCornerClick(btn, menu) {
  // fecha o menu se já estiver aberto
  if (menu.style.display === 'flex') {
    menu.style.display = 'none'
    return
  }

  const conversationId = currentConversationId()
  if (!conversationId) {
    setCornerState(btn, 'erro', 'Abre uma conversa primeiro')
    setTimeout(() => setCornerState(btn, 'idle'), 3000)
    return
  }

  setCornerState(btn, 'loading', 'A carregar pastas…')
  let pastas = []
  try {
    const result = await chrome.runtime.sendMessage({ action: 'getPastas' })
    if (result?.ok) pastas = result.pastas || []
  } catch {
    // sem pastas — mostra só "Sem pasta"
  }
  setCornerState(btn, 'idle')

  renderPastaMenu(menu, pastas, (pastaId) => {
    menu.style.display = 'none'
    addConversa(btn, conversationId, pastaId)
  })
  menu.style.display = 'flex'
}

function renderPastaMenu(menu, pastas, onPick) {
  menu.innerHTML = ''

  const title = document.createElement('p')
  title.textContent = 'Guardar em que pasta?'
  title.style.cssText =
    'margin:4px 8px 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#64748b'
  menu.appendChild(title)

  const options = [{ id: null, nome: '📥 Sem pasta' }].concat(
    pastas.map((p) => ({ id: p.id, nome: `📁 ${p.nome}` }))
  )

  for (const opt of options) {
    const item = document.createElement('button')
    item.type = 'button'
    item.textContent = opt.nome
    item.style.cssText =
      'text-align:left;padding:8px 10px;background:none;border:none;border-radius:8px;font-size:13px;color:#0f172a;cursor:pointer'
    item.addEventListener('mouseenter', () => (item.style.background = '#f1f5f9'))
    item.addEventListener('mouseleave', () => (item.style.background = 'none'))
    item.addEventListener('click', () => onPick(opt.id))
    menu.appendChild(item)
  }

  if (!pastas.length) {
    const hint = document.createElement('p')
    hint.textContent = 'Cria pastas no dashboard → Mensagens'
    hint.style.cssText = 'margin:4px 8px 4px;font-size:11px;color:#94a3b8'
    menu.appendChild(hint)
  }
}

async function addConversa(btn, conversationId, pastaId) {
  if (!window.__vintedHub?.buildConversaManual) {
    setCornerState(btn, 'erro', '✗ Recarrega a página (F5)')
    setTimeout(() => setCornerState(btn, 'idle'), 4000)
    return
  }

  setCornerState(btn, 'loading')
  try {
    const conversa = await window.__vintedHub.buildConversaManual(conversationId)
    if (pastaId) conversa.pasta_id = pastaId

    const result = await chrome.runtime.sendMessage({ action: 'addConversa', conversa })
    if (result?.ok) {
      setCornerState(btn, 'ok', '✓ Adicionada ao dashboard')
    } else {
      setCornerState(btn, 'erro', `✗ ${result?.error || 'Erro'}`)
    }
  } catch (err) {
    setCornerState(btn, 'erro', `✗ ${err.message || 'Erro'}`)
  }

  setTimeout(() => setCornerState(btn, 'idle'), 4000)
}

// ---------- Init ----------

function watchNavigation() {
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      ensureCornerButton()
    }
  }, 800)

  const observer = new MutationObserver(() => ensureCornerButton())
  observer.observe(document.body, { childList: true })
}

function init() {
  ensureCornerButton()
  watchNavigation()
  scheduleAutoSync(4000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
