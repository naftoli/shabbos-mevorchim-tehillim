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
  const parts = source.split(/\{(n|name|month|grade)\}/)
  const names = []
  let pattern = '^'
  const slots = []
  for (let i = 1; i < parts.length; i += 2) slots.push(parts[i])
  let slot = 0
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      pattern += escapeReg(parts[i])
      continue
    }
    const name = parts[i]
    names.push(name)
    const last = slot === slots.length - 1
    slot += 1
    pattern += name === 'n' ? '(\\d[\\d,]*)' : (last ? '(.+)' : '(.+?)')
  }
  pattern += '$'
  return { re: new RegExp(pattern), names, fr: row.fr }
}

const TEMPLATES = FR_TEMPLATES.map(compileTemplate)

function fill(template, names, groups) {
  let out = template
  names.forEach((name, i) => {
    out = out.split(`{${name}}`).join(groups[i])
  })
  return out
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
