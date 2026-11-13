// Grade → Kitah labels for Perfect Platoon graphics.
// Grades 1–8 are the labels Sholem specified. Pre-1A and grades 9–12 have
// no Kitah name here. Keep this list in step with api/platoonGrade.php.

export const KITAH_BY_GRADE = {
  1: 'Kitah Alef',
  2: 'Kitah Beis',
  3: 'Kitah Gimmel',
  4: 'Kitah Daled',
  5: 'Kitah Hei',
  6: 'Kitah Vov',
  7: 'Kitah Zayin',
  8: 'Kitah Ches',
}

const KITAH_WORD = {
  alef: '1', aleph: '1',
  beis: '2', bais: '2', bet: '2', vet: '2',
  gimmel: '3', gimel: '3',
  daled: '4', dalet: '4',
  hei: '5', hey: '5', hay: '5',
  vov: '6', vav: '6',
  zayin: '7', zain: '7', zayen: '7',
  ches: '8', chet: '8', het: '8',
}

/** "1", "Grade 1", "1st", "Kitah Alef", "Alef" → "1". Unknown → null. */
export function parseGrade(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  if (/pre\s*-?\s*1\s*-?\s*a/i.test(text)) return 'pre1a'
  const stripped = text.replace(/^(kitah|kita|grade|class)\s+/i, '').trim()
  const numeric = stripped.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i)
  if (numeric) return String(Number(numeric[1]))
  const token = stripped.toLowerCase().replace(/[^a-z]/g, '')
  return KITAH_WORD[token] || null
}

export function kitahLabel(grade) {
  const parsed = parseGrade(grade)
  if (!parsed) return null
  return KITAH_BY_GRADE[parsed] || null
}

function applyStem(stem, suffix, state) {
  const stemGrade = parseGrade(stem)
  if (!stemGrade || parseGrade(suffix)) return false
  state.grade = state.grade || stemGrade
  state.section = suffix
  return true
}

/**
 * Canonical class name is "{grade}" or "{grade}-{section}", the same string
 * GET /perfect-platoons builds. "Kitah Hei-B" and "5-B" are one class.
 */
export function normalizeClassParts(className, gradeRaw = '') {
  const name = String(className ?? '').trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
  const state = { grade: parseGrade(gradeRaw), section: '' }
  const hyphen = name.match(/^(.*?)\s*-\s*([A-Za-z0-9]+)$/)
  if (hyphen) applyStem(hyphen[1], hyphen[2], state)
  if (!state.section) {
    const spaced = name.match(/^(.*)\s+([A-Za-z0-9]{1,12})$/)
    if (spaced) applyStem(spaced[1], spaced[2], state)
  }
  if (!state.grade) state.grade = parseGrade(name)
  if (!state.grade) {
    const fallbackGrade = String(gradeRaw ?? '').trim() || name
    const fallbackClass = name || fallbackGrade
    return { grade: fallbackGrade, className: fallbackClass, section: '' }
  }
  if (!state.section && name && !parseGrade(name) && /^[A-Za-z0-9]+$/.test(name)) {
    state.section = name
  }
  const classOut = state.section ? `${state.grade}-${state.section}` : state.grade
  return { grade: state.grade, className: classOut, section: state.section }
}

/** "Kitah Hei" or "Kitah Hei-B". Grades without a Kitah keep the class name. */
export function platoonClassLabel(grade, className) {
  const parts = normalizeClassParts(className, grade)
  const kitah = kitahLabel(parts.grade)
  if (!kitah) return parts.className || parts.grade
  return parts.section ? `${kitah}-${parts.section}` : kitah
}

/**
 * Adar I and Adar II stay distinct. "Adar 1" / "Adar 2" are those two months.
 * A plain "Adar" is the non-leap month.
 */
export function normalizeCampaignMonth(month) {
  const raw = String(month ?? '').trim().replace(/\s+/g, ' ')
  const key = raw.toLowerCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim()
  const compact = key.replace(/ /g, '')
  const map = {
    'adar i': 'Adar I',
    'adar 1': 'Adar I',
    adari: 'Adar I',
    adar1: 'Adar I',
    'adar ii': 'Adar II',
    'adar 2': 'Adar II',
    adarii: 'Adar II',
    adar2: 'Adar II',
    adar: 'Adar',
    shevat: 'Shvat',
    shvat: 'Shvat',
    cheshvon: 'Cheshvan',
    cheshvan: 'Cheshvan',
    kisleiv: 'Kislev',
    kislev: 'Kislev',
    tevet: 'Teves',
    teves: 'Teves',
    tamuz: 'Tammuz',
    tammuz: 'Tammuz',
    tishrei: 'Tishrei',
    tishri: 'Tishrei',
    nissan: 'Nissan',
    nisan: 'Nissan',
    iyar: 'Iyar',
    iyyar: 'Iyar',
    sivan: 'Sivan',
    av: 'Av',
    elul: 'Elul',
  }
  return map[key] || map[compact] || raw
}
