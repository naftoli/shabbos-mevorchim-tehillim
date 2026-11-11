// Display-only class labels. Stored names, class ids, and grouping keys stay
// as they are. A leading grade number is dropped when the next word is that
// grade's own letter: "1 Aleph Aleph" -> "Aleph Aleph", "2 Bet Bet" -> "Bet Bet".
// Pre-1A, kindergarten, "4-boys", "5-B", and anything else stay unchanged.

const QUOTES = /['\u2019\u05F3\u05F4"]+$/u

const HEBREW_GRADE = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8 }

const ENGLISH_GRADE = new Map([
  ['aleph', 1], ['alef', 1],
  ['bet', 2], ['beis', 2], ['bais', 2],
  ['gimmel', 3], ['gimel', 3],
  ['dalet', 4], ['daled', 4],
  ['hei', 5], ['hey', 5],
  ['vav', 6],
  ['zayin', 7],
  ['ches', 8], ['chet', 8],
])

const FSI = '\u2068'
const PDI = '\u2069'

function gradeOfToken(token) {
  const bare = token.replace(QUOTES, '')
  if (HEBREW_GRADE[bare]) return HEBREW_GRADE[bare]
  return ENGLISH_GRADE.get(bare.toLowerCase()) || 0
}

export function formatClassName(name) {
  if (name == null) return ''
  const original = String(name)
  if (original === '') return ''
  const trimmed = original.trim()
  const lead = trimmed.match(/^([1-8])(?:\s+|-)+/)
  if (!lead) return original
  const rest = trimmed.slice(lead[0].length)
  const tokenMatch = rest.match(/^(?:[A-Za-z]+|[\u05D0-\u05EA])['\u2019\u05F3\u05F4"]*/)
  if (!tokenMatch) return original
  const token = tokenMatch[0]
  if (gradeOfToken(token) !== Number(lead[1])) return original
  const after = rest.slice(token.length)
  if (!after) return token
  if (/^\s/.test(after)) return `${token} ${after.trim()}`
  return token + after
}

// Plain-text channels (chat, SMS, PDF) have no <bdi>. Wrap a Hebrew label in
// first-strong isolates so it does not pull the surrounding English backward.
export function displayClassName(name) {
  const text = formatClassName(name)
  if (!/[\u0590-\u05FF]/.test(text)) return text
  if (text.startsWith(FSI) && text.endsWith(PDI)) return text
  return `${FSI}${text}${PDI}`
}

export function classNameIsHebrew(name) {
  return /[\u0590-\u05FF]/.test(formatClassName(name))
}
