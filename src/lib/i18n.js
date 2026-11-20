// Static French copy. English is the key. School names, soldier names, and
// numbers are not translated. A string with no row stays English.

import { FR_ENTRIES, FR_TEMPLATES } from '../locales/fr.js'

export function norm(text) {
  return String(text ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const TABLE = new Map()
for (const [english, french] of FR_ENTRIES) {
  TABLE.set(norm(english), french)
}

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileTemplate(row) {
  const source = norm(row.en)
  const parts = source.split(/\{([^{}]+)\}/)
  if (parts.length < 3) return null
  const names = []
  let pattern = '^'
  let literalLen = 0
  const slotCount = Math.floor(parts.length / 2)
  let slot = 0
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      pattern += escapeReg(parts[i])
      literalLen += parts[i].length
      continue
    }
    names.push(parts[i])
    const last = slot === slotCount - 1
    slot += 1
    pattern += last ? '(.+)' : '(.+?)'
  }
  pattern += '$'
  return { re: new RegExp(pattern), names, fr: row.fr, literalLen, sourceLen: source.length }
}

// Longer literal text wins, so "Ladder 12 full breakdown" is not swallowed by "Ladder {n}".
const TEMPLATES = FR_TEMPLATES.map(compileTemplate)
  .filter(Boolean)
  .sort((a, b) => b.literalLen - a.literalLen || b.sourceLen - a.sourceLen)

function fill(template, names, groups) {
  const queues = new Map()
  names.forEach((name, i) => {
    if (!queues.has(name)) queues.set(name, [])
    queues.get(name).push(groups[i])
  })
  return template.replace(/\{([^{}]+)\}/g, (token, name) => {
    const queue = queues.get(name)
    if (!queue || queue.length === 0) return token
    return queue.shift()
  })
}

/** The approved French for one English string, or the English when none exists. */
export function lookup(lang, text) {
  const original = String(text ?? '')
  if (lang !== 'fr') return original
  const key = norm(original)
  if (!key) return original
  const exact = TABLE.get(key)
  if (exact != null) return exact
  for (const tpl of TEMPLATES) {
    const match = key.match(tpl.re)
    if (!match) continue
    return fill(tpl.fr, tpl.names, match.slice(1))
  }
  return original
}

export const FRENCH_ENTRY_COUNT = FR_ENTRIES.length
