// Visible-page translation. The server does the language work; this module
// decides which text is safe to send and how to put the answer back.
// Tokens, serials, dates of birth, and passwords never go in the payload.

export const TARGET_LANGS = [
  { code: 'he', label: 'Hebrew' },
  { code: 'ru', label: 'Russian' },
  { code: 'it', label: 'Italian' },
  { code: 'fr', label: 'French' },
]

export const LANG_STORAGE_KEY = 'wwtc.lang'
export const TRANSLATE_CHUNK = 30
export const TRANSLATION_UNAVAILABLE = "Translation isn't available right now. The page stays in English."

const TARGET_CODES = TARGET_LANGS.map((item) => item.code)
const ATTRS = ['placeholder', 'aria-label', 'alt', 'title']

const memory = new WeakMap()
const tracked = new Set()

export function readStoredLang(storage) {
  if (!storage) return 'en'
  try {
    const value = storage.getItem(LANG_STORAGE_KEY)
    if (value === 'en' || TARGET_CODES.includes(value)) return value
  } catch { /* private mode */ }
  return 'en'
}

export function writeStoredLang(storage, lang) {
  if (!storage) return
  const next = lang === 'en' || TARGET_CODES.includes(lang) ? lang : 'en'
  try { storage.setItem(LANG_STORAGE_KEY, next) } catch { /* private mode */ }
}

// Hebrew is the only right-to-left language. The others stay left to right,
// with the lang attribute set to the language actually on the page.
export function htmlAttrsFor(lang) {
  if (lang === 'he') return { dir: 'rtl', lang: 'he' }
  if (TARGET_CODES.includes(lang)) return { dir: 'ltr', lang }
  return { dir: 'ltr', lang: 'en' }
}

export function translationCacheKey(lang, text) {
  return `${lang}\u0000${text}`
}

export function splitEdges(text) {
  const match = String(text ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/)
  return { lead: match[1], core: match[2], tail: match[3] }
}

export function looksLikeSecret(text) {
  const value = String(text ?? '').trim()
  if (!value) return false
  if (/^\d{5,}$/.test(value)) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true
  if (/^sk-[A-Za-z0-9_-]{8,}$/.test(value)) return true
  if (/^bearer\s+\S+$/i.test(value)) return true
  if (/^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true
  return false
}

export function mostlyHebrew(text) {
  const letters = String(text ?? '').match(/\p{L}/gu) || []
  if (letters.length < 2) return false
  let hebrew = 0
  for (const ch of letters) {
    if (/\p{Script=Hebrew}/u.test(ch)) hebrew += 1
  }
  return hebrew / letters.length >= 0.6
}

export function shouldTranslateText(text) {
  const core = String(text ?? '').trim()
  if (!core || core.length > 1200) return false
  if (mostlyHebrew(core)) return false
  if (looksLikeSecret(core)) return false
  if (!/[A-Za-z]/.test(core)) return false
  return true
}

export function uniqueMissing(cores, lang, cache) {
  const out = []
  const seen = new Set()
  for (const core of cores) {
    if (!shouldTranslateText(core)) continue
    if (cache.has(translationCacheKey(lang, core))) continue
    if (seen.has(core)) continue
    seen.add(core)
    out.push(core)
  }
  return out
}

function channelsOf(node) {
  let channels = memory.get(node)
  if (!channels) {
    channels = new Map()
    memory.set(node, channels)
  }
  return channels
}

function cell(node, channel) {
  return memory.get(node)?.get(channel) || null
}

function putCell(node, channel, record) {
  channelsOf(node).set(channel, record)
  tracked.add(node)
}

export function restorePage() {
  for (const node of tracked) {
    const channels = memory.get(node)
    if (!channels) continue
    for (const rec of channels.values()) {
      try {
        if (rec.read() !== rec.english) rec.write(rec.english)
      } catch { /* node already gone */ }
    }
    memory.delete(node)
  }
  tracked.clear()
}

function prune() {
  for (const node of tracked) {
    if (!node.isConnected) {
      memory.delete(node)
      tracked.delete(node)
    }
  }
}

function blocked(el) {
  if (!el) return true
  if (el.closest('[data-no-translate]')) return true
  if (el.closest('script,style,noscript,code,textarea,svg')) return true
  return false
}

function consider(node, channel, read, write, lang, cache, pending) {
  const current = read() ?? ''
  const saved = cell(node, channel)
  let english
  if (saved && saved.lang === lang && current === saved.translated) return
  if (saved && (current === saved.translated || current === saved.english)) english = saved.english
  else english = current
  const { lead, core, tail } = splitEdges(english)
  if (!shouldTranslateText(core)) return
  const hit = cache.get(translationCacheKey(lang, core))
  if (typeof hit === 'string') {
    const next = lead + hit + tail
    if (current !== next) write(next)
    putCell(node, channel, { lang, english, translated: next, read, write })
    return
  }
  pending.push({ node, channel, read, write, lead, core, tail, english })
}

function walk(root, lang, cache, pending) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return blocked(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  let node = walker.nextNode()
  while (node) {
    const textNode = node
    consider(textNode, 'text', () => textNode.nodeValue ?? '', (value) => { textNode.nodeValue = value }, lang, cache, pending)
    node = walker.nextNode()
  }
  const marked = root.querySelectorAll('[placeholder], [aria-label], [alt], [title]')
  marked.forEach((el) => {
    if (blocked(el)) return
    for (const name of ATTRS) {
      if (!el.hasAttribute(name)) continue
      const raw = el.getAttribute(name) ?? ''
      if (!raw.trim()) continue
      consider(
        el,
        name,
        () => el.getAttribute(name) ?? '',
        (value) => el.setAttribute(name, value),
        lang,
        cache,
        pending,
      )
    }
  })
}

export async function translateDocument(root, lang, cache, fetchList, isCurrent = () => true, onRequest = () => {}) {
  if (!root || lang === 'en') return
  prune()
  const pending = []
  walk(root, lang, cache, pending)
  const cores = uniqueMissing(pending.map((item) => item.core), lang, cache)
  if (!cores.length || !isCurrent()) return
  onRequest()
  const translated = new Map()
  for (let i = 0; i < cores.length; i += TRANSLATE_CHUNK) {
    if (!isCurrent()) return
    const chunk = cores.slice(i, i + TRANSLATE_CHUNK)
    const data = await fetchList(lang, chunk)
    const list = data?.translations
    if (!Array.isArray(list) || list.length !== chunk.length) {
      throw new Error(TRANSLATION_UNAVAILABLE)
    }
    chunk.forEach((core, n) => {
      if (typeof list[n] !== 'string') throw new Error(TRANSLATION_UNAVAILABLE)
      translated.set(core, list[n])
      cache.set(translationCacheKey(lang, core), list[n])
    })
  }
  if (!isCurrent()) return
  for (const item of pending) {
    const hit = translated.get(item.core) ?? cache.get(translationCacheKey(lang, item.core))
    if (typeof hit !== 'string') continue
    const next = item.lead + hit + item.tail
    const now = item.read()
    if (now !== item.english && now !== next) continue
    if (now !== next) item.write(next)
    putCell(item.node, item.channel, {
      lang,
      english: item.english,
      translated: next,
      read: item.read,
      write: item.write,
    })
  }
}
