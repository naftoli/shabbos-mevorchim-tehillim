// ANONYMIZED DEMO DATA — synthetic schools, classes and soldiers for the
// Worldwide Tehillim Club. No real children. Generated deterministically so the
// numbers are stable between reloads. This stands in for the live Mashpia
// roster until the real API is wired; the api.js facade reads it in demo mode.

import { MONTHS, GRADE_LABEL, availableLadders, quotaFor } from './ladders.js'
import { nextShabbosMevorchim } from '@/lib/shabbosMevorchim.js'

// Where the campaign "is" right now — driven by the REAL date so the demo always
// agrees with the live Shabbos-Mevorchim countdown. The current month is the one
// the next Shabbos Mevorchim bentches (what you say on it); months up to and
// including it count as elapsed. Falls back to Kislev 5786 if Intl can't resolve.
function currentHebrewYear(d = new Date()) {
  const y = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' })
    .formatToParts(d)
    .find((p) => p.type === 'year')?.value
  return (y || '').replace(/[^0-9]/g, '') || '5786'
}
const _upcoming = nextShabbosMevorchim()
export const CURRENT_MONTH_INDEX = Math.max(0, MONTHS.indexOf(_upcoming?.monthEn ?? 'Kislev'))
export const CURRENT_MONTH = MONTHS[CURRENT_MONTH_INDEX]
export const ELAPSED_MONTHS = MONTHS.slice(0, CURRENT_MONTH_INDEX + 1)
export const CAMPAIGN_YEAR = _upcoming ? currentHebrewYear() : '5786'

// Tehillim said in prior years (so "all-time" reads bigger than this year).
const PRIOR_YEARS_KAPITLACH = 1_240_000

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
const LAST = ['K.', 'B.', 'S.', 'L.', 'R.', 'G.', 'F.', 'T.', 'C.', 'M.', 'W.', 'D.']
const GRADES_IN_PLAY = ['1', '2', '3', '4', '5', '6', '7', '8']

const pad2 = (n) => String(n).padStart(2, '0')

function buildRoster() {
  const rand = rng(20260408)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  let kidSeq = 0

  const schools = SCHOOLS.map((s, si) => {
    const classCount = 4 + Math.floor(rand() * 3) // 4–6 classes
    const classes = Array.from({ length: classCount }, (_, ci) => {
      const grade = GRADES_IN_PLAY[(si + ci) % GRADES_IN_PLAY.length]
      const size = 10 + Math.floor(rand() * 11) // 10–20 kids
      const classDiligence = 0.55 + rand() * 0.42
      const ladders = availableLadders(grade)
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
        return {
          id: `s${1000 + kidSeq}`,
          serial: String(100000 + kidSeq),
          dob: `${birthYear}-${pad2(1 + Math.floor(rand() * 12))}-${pad2(1 + Math.floor(rand() * 28))}`,
          name: `${pick(FIRST)} ${pick(LAST)}`,
          grade,
          ladder,
          reports,
          minutesByMonth,
          minutes,
          priorMissions,
          metThisYear,
          missionsTotal: priorMissions + metThisYear,
        }
      })

      return { id: `${s.id}-c${ci + 1}`, name: `${GRADE_LABEL[grade]} Grade`, grade, kids }
    })

    return { ...s, classes }
  })

  // Make the first demo soldier a BRAND-NEW kid who hasn't picked a ladder yet,
  // so the first-login "pick your ladder" flow can be demoed (this is the kid
  // demoKidCredentials() hands the login screen).
  const fresh = schools[0]?.classes?.[0]?.kids?.[0]
  if (fresh) {
    fresh.isDemoNew = true // reset to ladderless on every sign-in (see verifyKid)
    fresh.ladder = null
    fresh.reports = {}
    fresh.minutesByMonth = {}
    fresh.minutes = 0
    fresh.priorMissions = 0
    fresh.metThisYear = 0
    fresh.missionsTotal = 0
  }

  return schools
}

export const ROSTER = buildRoster()

// Demo logins. Soldier = serial + DOB (match against ROSTER). Admin = username +
// password: 'hq' is HQ/super; each school id is that school's admin. (Live, admin
// auth is Mashpia SSO and auth==='super' ⇒ HQ.)
export const DEMO_ADMIN_PASSWORD = 'tehillim'
export const DEMO_ADMINS = [
  { username: 'hq', kind: 'super', name: 'HQ Command', schoolId: null },
  ...SCHOOLS.map((s) => ({ username: s.id, kind: 'school', name: s.name, schoolId: s.id })),
]

// A sample monthly dedication per school + an army-wide one.
export const ARMY_DEDICATION = {
  month: CURRENT_MONTH,
  text: 'The Worldwide Tehillim this month is dedicated לזכות the Rebbe’s shluchim around the world.',
}
export function schoolDedication(schoolId) {
  const s = SCHOOLS.find((x) => x.id === schoolId)
  if (!s) return null
  return {
    month: CURRENT_MONTH,
    text: `${s.name}’s Tehillim this month is dedicated לרפואה שלימה for all cholei Yisroel.`,
  }
}

export { PRIOR_YEARS_KAPITLACH }
