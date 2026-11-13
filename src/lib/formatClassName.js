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

// Grade 1–8 and the section letter, Hebrew only. "1 Aleph Bet" -> "אב".
// A single letter A–D is a section (A->א … D->ד), not a grade word, so the
// grade argument still supplies א–ח. Pre-1A, grades 9–12, and any token that
// is not one of these letters fall back to formatClassName.
const HEBREW_LETTERS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח']

const SECTION_HEBREW = new Map([
  ['aleph', 'א'], ['alef', 'א'], ['a', 'א'],
  ['bet', 'ב'], ['beis', 'ב'], ['bais', 'ב'], ['b', 'ב'],
  ['gimmel', 'ג'], ['gimel', 'ג'], ['c', 'ג'],
  ['dalet', 'ד'], ['daled', 'ד'], ['d', 'ד'],
  ['hei', 'ה'], ['hey', 'ה'],
  ['vav', 'ו'],
  ['zayin', 'ז'],
  ['ches', 'ח'], ['chet', 'ח'],
])

function gradeNumber(grade) {
  if (typeof grade === 'number' && Number.isInteger(grade) && grade >= 1 && grade <= 8) return grade
  const match = String(grade ?? '').trim().toLowerCase().match(/^([1-8])(?:st|nd|rd|th)?$/)
  return match ? Number(match[1]) : 0
}

function sectionHebrew(token) {
  const bare = String(token).replace(QUOTES, '')
  // Only the grade letters א–ח. A wider Hebrew name such as "כיתה א" is not
  // this pattern and falls back to the letters-only label.
  if (/^[\u05D0-\u05D7]$/.test(bare)) return bare
  return SECTION_HEBREW.get(bare.toLowerCase()) || ''
}

export function hebrewClassLabel(name, grade) {
  const fallback = formatClassName(name)
  const original = name == null ? '' : String(name).trim()
  const n = gradeNumber(grade)
  if (!original) return n ? HEBREW_LETTERS[n] : fallback

  const tokens = original.match(/[A-Za-z]+|[\u05D0-\u05EA]|[0-9]+/gu)
  if (!tokens) return fallback

  const letters = []
  let sawNumber = false
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (/^[1-8]$/.test(token)) {
      sawNumber = true
      const num = Number(token)
      const next = tokens[i + 1]
      // "1 Aleph …" already says the grade. Keep the letter, not א plus Aleph.
      if (next && gradeOfToken(next) === num) continue
      letters.push(HEBREW_LETTERS[num])
      continue
    }
    if (/^\d+$/.test(token)) return fallback
    const letter = sectionHebrew(token)
    if (!letter) return fallback
    letters.push(letter)
  }
  if (!letters.length) return fallback
  // A name that is only a section ("Bet", grade 1) still needs the grade letter.
  // A name that already starts with that grade's word ("Aleph Bet") does not.
  if (n && !sawNumber && gradeOfToken(tokens[0]) !== n) letters.unshift(HEBREW_LETTERS[n])
  return letters.join('')
}
