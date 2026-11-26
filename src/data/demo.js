// ANONYMIZED DEMO DATA — synthetic schools, classes and soldiers for the
// Worldwide Tehillim Club. No real children. Generated deterministically so the
// numbers are stable between reloads. This stands in for the live Mashpia
// roster until the real API is wired; the api.js facade reads it in demo mode.

import { GRADE_LABEL, availableLadders, quotaFor } from './ladders.js'
import { hiddenForScope } from '@/lib/schoolLadders.js'
import { campaignMonths, currentHebrewYear } from '@/lib/hebrewYear.js'
import { allowSchoolPickFromRow, firstMonthFromRow, normalizeFirstMonth } from '@/lib/schoolYear.js'
import { currentReportingMonth } from '@/lib/shabbosMevorchim.js'
import { applySoldierReport, planReport } from '@/lib/overEntry.js'

// Where the campaign "is" right now — driven by the REAL date so the demo always
// agrees with the live Shabbos-Mevorchim countdown. The current month is the one
// the next Shabbos Mevorchim bentches (what you say on it); months up to and
// including it count as elapsed. Falls back to Kislev 5786 if Intl can't resolve.
// The current reporting month is the one the MOST RECENT Shabbos Mevorchim
// bentshed — what kids are reporting now — not the next upcoming one.
// A leap year (two Adars) uses a 13-month list so Adar I and Adar II are both
// real months; a plain year keeps the single Adar key.
const _current = currentReportingMonth()
export const CAMPAIGN_YEAR = _current ? String(currentHebrewYear()) : '5786'
const YEAR_MONTHS = campaignMonths(CAMPAIGN_YEAR)
export const CURRENT_MONTH_INDEX = Math.max(0, YEAR_MONTHS.indexOf(_current ?? 'Cheshvan'))
export const CURRENT_MONTH = YEAR_MONTHS[CURRENT_MONTH_INDEX]
export const ELAPSED_MONTHS = YEAR_MONTHS.slice(0, CURRENT_MONTH_INDEX + 1)

// Tehillim said in prior years (so "all-time" reads bigger than this year).
const PRIOR_YEARS_KAPITLACH = 1_240_000

// The worldwide "Kapitlach Said · this year" headline total (demo figure). Kept
// as a fixed number so the running totals read exactly this; all-time adds the
// prior years on top (71,843 + 1,240,000 = 1,311,843).
const YEAR_KAPITLACH = 71_843

// Demo persistence: the roster is synthetic and rebuilt on every page load, so a
// soldier's own ladder + monthly reports are kept in localStorage and overlaid
// back on, making the demo feel real (what you entered is still there on reload).
const PROGRESS_KEY = 'wwtc.demo.progress'
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') } catch { return {} }
}
export function saveKidProgress(kid) {
  try {
    const all = loadProgress()
    all[kid.id] = {
      ladder: kid.ladder,
      reports: kid.reports,
      minutesByMonth: kid.minutesByMonth,
      flag: Object.prototype.hasOwnProperty.call(kid, 'flag') ? kid.flag : null,
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { /* private mode / unavailable */ }
}
export function clearKidProgress(kidId) {
  try {
    const all = loadProgress()
    delete all[kidId]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// Deterministic PRNG (mulberry32).
function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SCHOOLS = [
  { id: 'cheder-menachem-sample', name: 'Cheder Menachem (Sample)', city: 'Los Angeles, CA', color: '#2a5fb8' },
  { id: 'bais-chaya-mushka-sample', name: 'Bais Chaya Mushka (Sample)', city: 'Brooklyn, NY', color: '#0e8aa6' },
  { id: 'lubavitch-academy-sample', name: 'Lubavitch Academy (Sample)', city: 'Chicago, IL', color: '#5b3fa8' },
  { id: 'ohr-menachem-sample', name: 'Ohr Menachem (Sample)', city: 'Miami, FL', color: '#c77d0e' },
  { id: 'darkei-menachem-sample', name: 'Darkei Menachem (Sample)', city: 'Toronto, ON', color: '#1f7a4d' },
  { id: 'yeshivas-tomchei-sample', name: 'Yeshivas Tomchei (Sample)', city: 'Melbourne, AU', color: '#c0392b' },
]

const FIRST = [
  'Mendel', 'Levi', 'Shneur', 'Dovid', 'Zalman', 'Yosef', 'Berel', 'Sholom', 'Chaim', 'Ari',
  'Moshe', 'Yisroel', 'Avrohom', 'Yaakov', 'Shmuel', 'Nochum', 'Zevi', 'Meir', 'Shalom', 'Leib',
]
const GIRL_FIRST = [
  'Chaya', 'Mushka', 'Rivkah', 'Leah', 'Chana', 'Devorah', 'Rochel', 'Sara', 'Esther', 'Miriam',
  'Chana', 'Basya', 'Golda', 'Pessa', 'Fruma', 'Yocheved', 'Nechama', 'Shterna', 'Hinda', 'Bracha',
]
const GIRL_TEACHERS = [
  'Mrs Cohen', 'Mrs Levin', 'Mrs Gordon', 'Mrs Katz', 'Mrs Shapiro', 'Mrs Weiss',
  'Mrs Rubin', 'Mrs Lerner', 'Mrs Posner', 'Mrs Feller', 'Mrs Hecht', 'Mrs Gansburg',
]
const LAST = ['K.', 'B.', 'S.', 'L.', 'R.', 'G.', 'F.', 'T.', 'C.', 'M.', 'W.', 'D.']
const GRADES_IN_PLAY = ['1', '2', '3', '4', '5', '6', '7', '8']
const TEACHERS = [
  'Rabbi Cohen', 'Rabbi Levin', 'Rabbi Gordon', 'Rabbi Katz', 'Rabbi Shapiro', 'Rabbi Weiss',
  'Rabbi Rubin', 'Rabbi Lerner', 'Rabbi Posner', 'Rabbi Feller', 'Rabbi Hecht', 'Rabbi Gansburg',
  'Rabbi Lipskar', 'Rabbi Denburg', 'Rabbi Marlow', 'Rabbi Teleshevsky',
]

const pad2 = (n) => String(n).padStart(2, '0')

const GRADE_WORDS = ['', 'Aleph', 'Bet', 'Gimmel', 'Dalet', 'Hei', 'Vav', 'Zayin', 'Ches']
const SECTION_WORDS = ['Aleph', 'Bet', 'Gimmel', 'Dalet', 'Hei', 'Vav', 'Zayin', 'Ches', 'Tes', 'Yud']

function demoClassLabel(grade, sectionIndex, peerCount) {
  if (grade === 'pre1a') {
    return peerCount > 1 ? `Pre-1A ${String.fromCharCode(65 + sectionIndex)}` : 'Pre-1A'
  }
  const n = Number(grade)
  if (n >= 1 && n <= 8) {
    const word = GRADE_WORDS[n]
    const section = peerCount > 1
      ? (SECTION_WORDS[sectionIndex] || String.fromCharCode(65 + sectionIndex))
      : word
    return `${n} ${word} ${section}`
  }
  const base = `${GRADE_LABEL[grade] || grade} Grade`
  return peerCount > 1 ? `${base} ${String.fromCharCode(65 + sectionIndex)}` : base
}

// Prior-year demo marks. A separate seed so this year's roster numbers stay put.
function priorYearFor(seq, grade, ladder) {
  const rand = rng(800000 + seq)
  const reports = {}
  const minutes = {}
  for (const mo of campaignMonths(Number(CAMPAIGN_YEAR) - 1)) {
    const q = quotaFor(grade, mo, ladder)
    if (!q) continue
    const r = rand()
    if (r < 0.72) {
      reports[mo] = q.v
      minutes[mo] = q.m
    } else if (r < 0.88) {
      reports[mo] = Math.max(1, Math.round(q.v * 0.5))
      minutes[mo] = Math.round((q.m || 0) * 0.5)
    } else {
      reports[mo] = 0
      minutes[mo] = 0
    }
  }
  return { reports, minutes }
}

export const PRIOR_CAMPAIGN_YEAR = String(Number(CAMPAIGN_YEAR) - 1)

function buildRoster() {
  const rand = rng(20260408)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  let kidSeq = 0

  const schools = SCHOOLS.map((s, si) => {
    const classCount = 4 + Math.floor(rand() * 3) // 4–6 classes
    const rawClasses = Array.from({ length: classCount }, (_, ci) => {
      // Pair classes up so most grades have a couple of sections (A/B).
      const grade = GRADES_IN_PLAY[(si + Math.floor(ci / 2)) % GRADES_IN_PLAY.length]
      const size = 10 + Math.floor(rand() * 11) // 10–20 kids
      const girlSchool = s.id === 'bais-chaya-mushka-sample'
      const teacher = pick(girlSchool ? GIRL_TEACHERS : TEACHERS)
      const classDiligence = 0.55 + rand() * 0.42
      const ladders = availableLadders()
      const gradeNum = grade === 'pre1a' ? 0 : Number(grade)
      const birthYear = 2026 - (gradeNum + 6)

      const kids = Array.from({ length: size }, () => {
        const ladder = pick(ladders)
        const diligence = Math.min(0.99, classDiligence + (rand() - 0.5) * 0.25)
        const reports = {}
        const minutesByMonth = {}
        let minutes = 0
        let metThisYear = 0
        for (const mo of ELAPSED_MONTHS) {
          const q = quotaFor(grade, mo, ladder)
          if (!q) continue
          const r = rand()
          if (r < diligence) {
            reports[mo] = q.v
            minutesByMonth[mo] = q.m
            minutes += q.m
            metThisYear += 1
          } else if (r < diligence + 0.12) {
            reports[mo] = Math.round(q.v * (0.4 + rand() * 0.4) * 2) / 2
            minutesByMonth[mo] = Math.round(q.m * 0.6)
            minutes += minutesByMonth[mo]
          } else {
            reports[mo] = 0
            minutesByMonth[mo] = 0
          }
        }
        // Prior-year missions so medal boards are interesting; older kids have more.
        const priorMissions = Math.floor(rand() * (gradeNum * 11))
        kidSeq += 1
        const prior = priorYearFor(kidSeq, grade, ladder)
        return {
          id: `s${1000 + kidSeq}`,
          serial: String(100000 + kidSeq),
          dob: `${birthYear}-${pad2(1 + Math.floor(rand() * 12))}-${pad2(1 + Math.floor(rand() * 28))}`,
          name: `${pick(girlSchool ? GIRL_FIRST : FIRST)} ${pick(LAST)}`,
          gender: girlSchool ? 'girl' : 'boy',
          grade,
          ladder,
          priorYearReports: prior.reports,
          priorYearMinutes: prior.minutes,
          reports,
          minutesByMonth,
          minutes,
          priorMissions,
          metThisYear,
          missionsTotal: priorMissions + metThisYear,
        }
      })

      return { id: `${s.id}-c${ci + 1}`, grade, teacher, kids }
    })

    // Name classes the way the live roster does: a grade number, the Hebrew
    // grade word, then the section. The screen drops the number. Grades
    // outside 1–8, and Pre-1A, keep a name the formatter does not touch.
    const byGrade = {}
    for (const c of rawClasses) (byGrade[c.grade] ||= []).push(c)
    const classes = rawClasses.map((c) => {
      const peers = byGrade[c.grade]
      return { ...c, name: demoClassLabel(c.grade, peers.indexOf(c), peers.length) }
    })

    return { ...s, classes }
  })

  // Make the first demo soldier a BRAND-NEW kid who hasn't picked a ladder yet,
  // so the first-login "pick your ladder" flow can be demoed.
  const fresh = schools[0]?.classes?.[0]?.kids?.[0]
  if (fresh) {
    fresh.isDemoNew = true // reset to ladderless on every sign-in (see verifyKid)
    fresh.ladder = null
    fresh.reports = {}
    fresh.minutesByMonth = {}
    fresh.minutes = 0
    // New to THIS year's ladder, but carries a prior-year mission history so the
    // medal board demos with earned medals.
    fresh.priorMissions = 30
    fresh.metThisYear = 0
    fresh.missionsTotal = 30
  }

  // Overlay any saved demo progress so a soldier's own ladder + reports survive
  // a page reload (the synthetic roster is otherwise rebuilt from scratch).
  const saved = loadProgress()
  for (const school of schools) {
    for (const cls of school.classes) {
      for (const kid of cls.kids) {
        const s = saved[kid.id]
        if (!s) continue
        if (s.ladder != null) kid.ladder = s.ladder
        if (s.reports) kid.reports = { ...kid.reports, ...s.reports }
        if (s.minutesByMonth) kid.minutesByMonth = { ...kid.minutesByMonth, ...s.minutesByMonth }
        if (Object.prototype.hasOwnProperty.call(s, 'flag')) kid.flag = s.flag
        let met = 0
        for (const mo of ELAPSED_MONTHS) {
          const q = quotaFor(kid.grade, mo, kid.ladder)
          if (q && (kid.reports[mo] ?? 0) >= q.v) met += 1
        }
        kid.metThisYear = met
        kid.missionsTotal = (kid.priorMissions || 0) + met
        kid.minutes = Object.values(kid.minutesByMonth || {}).reduce((a, m) => a + (m || 0), 0)
      }
    }
  }

  // Flags land on the generated roster, not on the fixed perfect-platoon school.
  seedDemoFlags(schools)

  // A fixed school with three perfect platoons under three teachers, plus two
  // that are not. Class names keep their case ("4-boys" and "4-Boys" are two
  // classes). The two that are not are named "1" and "כיתה א" so the admin
  // list can show a numeric name and a Hebrew name on their own lines.
  // Fictional soldiers only — the public platoon chips never show them.
  schools.push(sampleCheder())

  return schools
}

// Two fictional open flags so the base-commander queue has something to review
// in the demo. They sit beside the counted marks and are not part of them.
function seedDemoFlags(schools) {
  const saved = loadProgress()
  const presets = [
    { kapitlach: 150, minutes: 20, at: '2026-11-10T18:30:00.000Z' },
    { kapitlach: 140, minutes: 200, at: '2026-11-10T19:05:00.000Z' },
  ]
  const samples = []
  for (const school of schools) {
    for (const cls of school.classes) {
      for (const kid of cls.kids) {
        if (kid.isDemoNew || !kid.ladder) continue
        samples.push({ kid, cls, school })
        if (samples.length === presets.length) break
      }
      if (samples.length === presets.length) break
    }
    if (samples.length === presets.length) break
  }
  samples.forEach((sample, i) => {
    const { kid, cls, school } = sample
    const stored = saved[kid.id]
    if (stored && Object.prototype.hasOwnProperty.call(stored, 'flag')) return
    const q = quotaFor(kid.grade, CURRENT_MONTH, kid.ladder)
    const preset = presets[i]
    const plan = planReport({
      grade: kid.grade,
      kapitlach: preset.kapitlach,
      minutes: preset.minutes,
      quotaKap: q?.v ?? 0,
      quotaMin: q?.m ?? 0,
      flagConfirmed: true,
    })
    if (plan.action !== 'flag') return
    applySoldierReport(kid, {
      month: CURRENT_MONTH,
      grade: kid.grade,
      kapitlach: preset.kapitlach,
      minutes: preset.minutes,
      quotaKap: q?.v ?? 0,
      quotaMin: q?.m ?? 0,
      flagConfirmed: true,
      kidName: kid.name,
      className: cls.name,
      schoolId: school.id,
      schoolName: school.name,
      year: CAMPAIGN_YEAR,
      at: preset.at,
    })
  })
}

const SAMPLE_CHEDER_ID = 'sample-cheder'

function sampleSoldier(n, grade, ladder, meetCurrent) {
  const reports = {}
  const minutesByMonth = {}
  let minutes = 0
  let metThisYear = 0
  for (const mo of ELAPSED_MONTHS) {
    const q = quotaFor(grade, mo, ladder)
    if (!q) continue
    const said = mo === CURRENT_MONTH && !meetCurrent ? Math.max(0, q.v - 1) : q.v * 3
    reports[mo] = said
    minutesByMonth[mo] = q.m
    minutes += q.m
    if (q.v > 0 && said >= q.v) metThisYear += 1
  }
  return {
    id: `sample-k-${n}`,
    serial: String(900000 + n),
    dob: `2016-04-${String((n % 27) + 1).padStart(2, '0')}`,
    name: `Fictional ${n} K.`,
    gender: 'boy',
    grade,
    ladder,
    reports,
    minutesByMonth,
    minutes,
    priorMissions: 0,
    metThisYear,
    missionsTotal: metThisYear,
  }
}

function sampleClass(id, grade, name, teacher, soldiers) {
  return { id, grade, name, teacher, kids: soldiers }
}

// Pin this month's kapitlach so a class can show both incomplete groups:
// a number above zero that is still short, and a zero (nothing reported).
function withCurrentSaid(kid, said) {
  const q = quotaFor(kid.grade, CURRENT_MONTH, kid.ladder)
  const before = Number(kid.reports[CURRENT_MONTH] ?? 0)
  const was = !!(q && q.v > 0 && before >= q.v)
  kid.reports[CURRENT_MONTH] = said
  if (q) {
    kid.minutesByMonth[CURRENT_MONTH] = said > 0 && q.v > 0 ? Math.max(1, Math.round(q.m * (said / q.v))) : 0
  }
  const now = !!(q && q.v > 0 && said >= q.v)
  if (was && !now) kid.metThisYear = Math.max(0, (kid.metThisYear || 0) - 1)
  kid.missionsTotal = (kid.priorMissions || 0) + kid.metThisYear
  kid.minutes = Object.values(kid.minutesByMonth || {}).reduce((a, m) => a + (m || 0), 0)
  return kid
}

function sampleCheder() {
  let n = 0
  const next = (grade, meet) => sampleSoldier(++n, grade, 8, meet)
  const full = (grade, count) => Array.from({ length: count }, () => next(grade, true))
  const ones = [...full('1', 3), next('1', false)]
  withCurrentSaid(ones[0], 0)
  const aleph = [...full('2', 2), next('2', false), next('2', false)]
  withCurrentSaid(aleph[2], 0)
  return {
    id: SAMPLE_CHEDER_ID,
    name: 'Sample Cheder',
    city: 'Sample City',
    color: '#1d4e89',
    classes: [
      sampleClass(`${SAMPLE_CHEDER_ID}-4-boys`, '4', '4-boys', 'Rabbi Adler', full('4', 4)),
      sampleClass(`${SAMPLE_CHEDER_ID}-4-Boys`, '4', '4-Boys', 'Rabbi Berg', full('4', 4)),
      sampleClass(`${SAMPLE_CHEDER_ID}-3-Boys`, '3', '3-Boys', 'Rabbi Klein', full('3', 4)),
      sampleClass(`${SAMPLE_CHEDER_ID}-1`, '1', '1', 'Rabbi Dale', ones),
      sampleClass(`${SAMPLE_CHEDER_ID}-aleph`, '2', 'כיתה א', 'Rabbi Engel', aleph),
      // Last in the source list on purpose. Class reports sort by grade, so
      // Pre-1A still shows before 1st grade. Both soldiers finished, so the
      // unfinished list stays the numeric class and the Hebrew class.
      sampleClass(`${SAMPLE_CHEDER_ID}-pre1a`, 'pre1a', 'Pre-1A', 'Rabbi Fried', full('pre1a', 2)),
    ],
  }
}

export const ROSTER = buildRoster()

// Demo logins. Soldier = serial + DOB (match against ROSTER). Admin = username +
// password: 'hq' is HQ/super; each school id is that school's admin. (Live, admin
// auth is Mashpia SSO and auth==='super' ⇒ HQ.)
export const DEMO_ADMIN_PASSWORD = 'tehillim'
export const DEMO_ADMINS = [
  { username: 'hq', kind: 'super', name: 'HQ Command', schoolId: null },
  ...SCHOOLS.map((s) => ({ username: s.id, kind: 'school', name: s.name, schoolId: s.id })),
  { username: 'sample-cheder', kind: 'school', name: 'Sample Cheder', schoolId: 'sample-cheder' },
]

// A sample monthly dedication per school + an army-wide one.
export const ARMY_DEDICATION = {
  month: CURRENT_MONTH,
  text: 'The Worldwide Tehillim this month is dedicated לזכות the Rebbe’s shluchim around the world.',
}
// School admins can add / edit / remove their school's dedication; the choice
// is kept in localStorage (demo only). An explicit null means "removed".
const DEDICATION_KEY = 'wwtc.demo.dedications'
function loadDedications() {
  try { return JSON.parse(localStorage.getItem(DEDICATION_KEY) || '{}') } catch { return {} }
}
export function setSchoolDedicationStore(schoolId, dedication) {
  try {
    const all = loadDedications()
    all[schoolId] = dedication // { month, text } | null
    localStorage.setItem(DEDICATION_KEY, JSON.stringify(all))
  } catch { /* private mode / unavailable */ }
}
// Per-school grade-year start. Missing entry = Tishrei (today's sequence).
const YEAR_START_KEY = 'wwtc.demo.yearStart'
function loadYearStarts() {
  try {
    if (typeof localStorage === 'undefined') return {}
    return JSON.parse(localStorage.getItem(YEAR_START_KEY) || '{}')
  } catch { return {} }
}
export function schoolYearStart(schoolId) {
  const store = loadYearStarts()
  // No saved entry for this school is a missing row: Tishrei.
  if (!Object.prototype.hasOwnProperty.call(store, schoolId)) return firstMonthFromRow(null)
  return firstMonthFromRow(store[schoolId])
}
export function setSchoolYearStartStore(schoolId, firstMonth) {
  try {
    if (typeof localStorage === 'undefined') return
    const all = loadYearStarts()
    all[schoolId] = normalizeFirstMonth(firstMonth)
    localStorage.setItem(YEAR_START_KEY, JSON.stringify(all))
  } catch { /* private mode */ }
}
// HQ's per-school switch. Missing entry = off. The school admin does not
// see the start-month picker until HQ turns this on.
const YEAR_PICK_KEY = 'wwtc.demo.yearPick'
function loadYearPicks() {
  try {
    if (typeof localStorage === 'undefined') return {}
    return JSON.parse(localStorage.getItem(YEAR_PICK_KEY) || '{}')
  } catch { return {} }
}
export function schoolAllowsOwnStart(schoolId) {
  const store = loadYearPicks()
  if (!Object.prototype.hasOwnProperty.call(store, schoolId)) return false
  return allowSchoolPickFromRow({ allowSchoolPick: store[schoolId] })
}
export function setSchoolYearPickStore(schoolId, allow) {
  try {
    if (typeof localStorage === 'undefined') return
    const all = loadYearPicks()
    all[schoolId] = allow === true || allow === 1 || allow === '1' || allow === 'true'
    localStorage.setItem(YEAR_PICK_KEY, JSON.stringify(all))
  } catch { /* private mode */ }
}

// Ladders a school has turned off, plus class and child overrides.
// A missing entry uses the built-in demo (Sample Cheder shows all three
// levels; the first Cheder Menachem class hides ladder 5 from that class).
// An older saved value is just the school-level list.
const HIDDEN_LADDERS_KEY = 'wwtc.demo.hiddenLadders'

// Sample Cheder: ladder 5 is off for the school, class "1" turns it back on
// and turns 6 off, Fictional 1 turns 6 back on, Fictional 2 turns 5 off.
// Cheder Menachem's first class turns ladder 5 off, so the new soldier's
// picker hides it while the rest of the school still offers it.
const DEMO_LADDER_SCOPES = {
  'sample-cheder': {
    hidden: [5],
    classes: {
      'sample-cheder-1': { 5: true, 6: false },
    },
    children: {
      'sample-k-1': { classId: 'sample-cheder-1', ladders: { 6: true } },
      'sample-k-2': { classId: 'sample-cheder-1', ladders: { 5: false } },
    },
  },
  'cheder-menachem-sample': {
    hidden: [],
    classes: {
      'cheder-menachem-sample-c1': { 5: false },
    },
    children: {},
  },
}

function cleanHiddenList(hidden) {
  const next = []
  const seen = new Set()
  for (const value of hidden || []) {
    const n = Number(value)
    if (n < 5 || n > 12 || seen.has(n)) continue
    seen.add(n)
    next.push(n)
  }
  return next
}

function cleanOverrideMap(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, enabled] of Object.entries(raw)) {
    const n = Number(key)
    if (n < 5 || n > 12) continue
    if (enabled === true || enabled === false) out[n] = enabled
  }
  return out
}

function normalizeLadderScope(raw) {
  if (Array.isArray(raw)) {
    return { hidden: cleanHiddenList(raw), classes: {}, children: {} }
  }
  const classes = {}
  for (const [classId, map] of Object.entries(raw?.classes || {})) {
    const cleaned = cleanOverrideMap(map)
    if (Object.keys(cleaned).length) classes[classId] = cleaned
  }
  const children = {}
  for (const [userId, row] of Object.entries(raw?.children || {})) {
    const ladders = cleanOverrideMap(row?.ladders || row)
    if (!Object.keys(ladders).length) continue
    children[userId] = { classId: row?.classId ?? null, ladders }
  }
  return { hidden: cleanHiddenList(raw?.hidden), classes, children }
}

function loadHiddenLadders() {
  try {
    if (typeof localStorage === 'undefined') return {}
    return JSON.parse(localStorage.getItem(HIDDEN_LADDERS_KEY) || '{}')
  } catch { return {} }
}

function ladderScope(schoolId) {
  const store = loadHiddenLadders()
  if (Object.prototype.hasOwnProperty.call(store, schoolId)) return normalizeLadderScope(store[schoolId])
  return normalizeLadderScope(DEMO_LADDER_SCOPES[schoolId] || { hidden: [] })
}

export function schoolHiddenLadders(schoolId) {
  return ladderScope(schoolId).hidden
}

/** Ladders that are off for this child. Child beats class beats school. */
export function hiddenLaddersForChild(schoolId, classId, childId) {
  const scope = ladderScope(schoolId)
  const classMap = classId ? scope.classes[String(classId)] : null
  const child = childId ? scope.children[String(childId)] : null
  return hiddenForScope(scope.hidden, classMap, child?.ladders)
}

function overrideList(map) {
  return Object.entries(map || {})
    .map(([ladder, enabled]) => ({ ladder: Number(ladder), enabled: enabled === true }))
    .filter((row) => row.ladder >= 5 && row.ladder <= 12)
}

/** Admin ladder screen for the demo. Child rows have ids, never names. */
export function demoLadderSettings(schoolId) {
  const school = ROSTER.find((s) => s.id === schoolId)
  const scope = ladderScope(schoolId)
  const classes = (school?.classes || []).map((cls) => ({
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    overrides: overrideList(scope.classes[cls.id]),
  }))
  const children = Object.entries(scope.children).map(([id, row]) => ({
    id,
    classId: row.classId,
    overrides: overrideList(row.ladders),
  }))
  return {
    ok: true,
    schoolId,
    hiddenLadders: scope.hidden,
    ladders: [12, 11, 10, 9, 8, 7, 6, 5].map((ladder) => ({
      ladder,
      enabled: !scope.hidden.includes(ladder),
    })),
    classes,
    children,
  }
}

function writeLadderStore(all) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(HIDDEN_LADDERS_KEY, JSON.stringify(all))
  } catch { /* private mode */ }
}

export function setSchoolHiddenLaddersStore(schoolId, hidden) {
  const all = loadHiddenLadders()
  const current = Object.prototype.hasOwnProperty.call(all, schoolId)
    ? normalizeLadderScope(all[schoolId])
    : ladderScope(schoolId)
  all[schoolId] = { ...current, hidden: cleanHiddenList(hidden) }
  writeLadderStore(all)
}

export function setLadderScopeStore(schoolId, scope) {
  const all = loadHiddenLadders()
  all[schoolId] = normalizeLadderScope(scope)
  writeLadderStore(all)
}

export function schoolDedication(schoolId) {
  const s = SCHOOLS.find((x) => x.id === schoolId)
  if (!s) return null
  const store = loadDedications()
  if (Object.prototype.hasOwnProperty.call(store, schoolId)) return store[schoolId]
  return {
    month: CURRENT_MONTH,
    text: `${s.name}’s Tehillim this month is dedicated לרפואה שלימה for all cholei Yisroel.`,
  }
}

export { PRIOR_YEARS_KAPITLACH, YEAR_KAPITLACH }
