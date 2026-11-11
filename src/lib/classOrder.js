// Grade order for class lists. Pre-1A has no leading grade number ("Pre-1A",
// "pre1a", "P1A"), so a numeric parse or an A–Z sort of the label parks it
// after 12th grade. Rank 0 puts it first. 1st through 12th keep their numbers,
// and a section ("1-Boys", "1st Grade A") only breaks a tie inside that grade.
// Score rankings (the race, class leaderboards, soldier boards) do not use this.

const PRE_1A = /^(?:pre[\s-]*1[\s-]*a|p1a)/i
const LEADING_GRADE = /^(\d{1,2})(?:st|nd|rd|th)?/i

export function classOrderParts(label) {
  const raw = String(label ?? '').trim()
  const pre = raw.match(PRE_1A)
  if (pre) {
    return { rank: 0, section: raw.slice(pre[0].length).replace(/^[\s-]+/, ''), raw }
  }
  const num = raw.match(LEADING_GRADE)
  if (num) {
    const rank = Number(num[1])
    if (rank >= 1 && rank <= 12) {
      return { rank, section: raw.slice(num[0].length).replace(/^[\s-]+/, ''), raw }
    }
  }
  return { rank: 100, section: raw, raw }
}

function compareText(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function compareIds(a, b) {
  const sa = String(a ?? '')
  const sb = String(b ?? '')
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) return Number(sa) - Number(sb)
  return compareText(sa, sb)
}

export function classRowLabel(row) {
  for (const key of ['name', 'className', 'grade']) {
    const value = String(row?.[key] ?? '').trim()
    if (value) return value
  }
  return ''
}

export function compareClassLabels(a, b) {
  const ka = classOrderParts(a)
  const kb = classOrderParts(b)
  if (ka.rank !== kb.rank) return ka.rank - kb.rank
  const section = compareText(ka.section.toLowerCase(), kb.section.toLowerCase())
  if (section !== 0) return section
  return compareText(ka.raw, kb.raw)
}

function rowParts(row) {
  const label = classRowLabel(row)
  const fromLabel = classOrderParts(label)
  if (fromLabel.rank < 100) return fromLabel
  // A Hebrew class name has no grade number. The grade field still orders it.
  const grade = String(row?.grade ?? '').trim()
  if (grade && grade !== label) {
    const fromGrade = classOrderParts(grade)
    if (fromGrade.rank < 100) return { rank: fromGrade.rank, section: label, raw: label }
  }
  return fromLabel
}

export function compareClassRows(a, b) {
  const ka = rowParts(a)
  const kb = rowParts(b)
  if (ka.rank !== kb.rank) return ka.rank - kb.rank
  const section = compareText(ka.section.toLowerCase(), kb.section.toLowerCase())
  if (section !== 0) return section
  const raw = compareText(ka.raw, kb.raw)
  if (raw !== 0) return raw
  return compareIds(a?.id ?? a?.classId, b?.id ?? b?.classId)
}

export function sortClasses(rows) {
  return [...(rows || [])].sort(compareClassRows)
}

// Nationwide platoon list: school name, then the same grade order inside a school.
export function comparePlatoonRows(a, b) {
  const school = compareText(String(a?.school ?? ''), String(b?.school ?? ''))
  if (school !== 0) return school
  return compareClassRows(a, b)
}

export function sortPlatoons(rows) {
  return [...(rows || [])].sort(comparePlatoonRows)
}
