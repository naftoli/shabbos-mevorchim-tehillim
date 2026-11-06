import { quotaFor, GRADE_LABEL } from '@/data/ladders.js'

export const OCCASIONS = [
  { key: 'Tishrei', heb: 'תשרי' },
  { key: 'Rosh Hashana', heb: 'ר״ה', holiday: true },
  { key: 'Yom Kippur', heb: 'יו״כ', holiday: true },
  { key: 'Cheshvan', heb: 'חשון' },
  { key: 'Kislev', heb: 'כסלו' },
  { key: 'Teves', heb: 'טבת' },
  { key: 'Shvat', heb: 'שבט' },
  { key: 'Adar', heb: 'אדר' },
  { key: 'Nissan', heb: 'ניסן' },
  { key: 'Iyar', heb: 'אייר' },
  { key: 'Sivan', heb: 'סיון' },
  { key: 'Tammuz', heb: 'תמוז' },
  { key: 'Av', heb: 'אב' },
  { key: 'Elul', heb: 'אלול' },
]

const GRADE_ORDER = ['pre1a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const gradeNum = (g) => (g === 'pre1a' ? 0 : Number(g) || 0)

// Grades to show on the board: training runs through the ladder's finish grade,
// but a soldier who kept going past it (e.g. grade 6 still on ladder 5, which
// finishes in grade 5) must still get their current grade's row — otherwise this
// year's completed missions have nowhere to be checked off.
export function gradesOnLadder(ladder, throughGrade) {
  const cap = Math.max(Number(ladder) || 0, gradeNum(throughGrade))
  if (!cap) return GRADE_ORDER.slice()
  return GRADE_ORDER.filter((g) => gradeNum(g) <= cap)
}

function monthRecord(byMonth, key) {
  return byMonth[key] || byMonth[key === 'Adar' ? 'Adar I' : key] || null
}

/**
 * One cell per mission on this ladder. A check means a record says the quota
 * was met. No record stays blank — it is not shown as a miss.
 */
export function buildTraining({ grade, ladder, months, priorMissions = 0, history = {} }) {
  const grades = gradesOnLadder(ladder, grade)
  const byMonth = {}
  for (const month of months || []) {
    if (month?.month) byMonth[month.month] = month
  }
  // A holiday occasion (Rosh Hashana / Yom Kippur) shows only when the server
  // sent it in this soldier's months — i.e. it is a boarded occasion this year.
  // Before the enable year (or a year with no holiday missions) it is dropped.
  const activeHolidays = new Set((months || []).filter((m) => m?.holiday && m?.month).map((m) => m.month))
  const occasions = OCCASIONS.filter((occ) => !occ.holiday || activeHolidays.has(occ.key))
  // The quota shown for a mission should reflect the ladder the soldier was on
  // for that mission, not whatever ladder they sit on now (it may have changed).
  // The current ladder is only a last resort.
  const fallbackLadder = ladder ? Number(ladder) : null

  // Resolve one cell's completion and, if done, the ladder it was done on. A past
  // grade holds a mark only for an earned mission; the current grade reads live
  // month records (met, reported-but-under, or nothing). Holidays (Rosh Hashana /
  // Yom Kippur) board off the year's Tishrei quota — handled at quota lookup.
  const resolve = (occ, isCurrent, earnedPast) => {
    const histVal = earnedPast?.[occ.key]
    const histLadder = typeof histVal === 'number' ? histVal : null
    const rec = isCurrent ? monthRecord(byMonth, occ.key) : null
    const reported = isCurrent ? !!(rec && rec.reported !== false) : (histVal != null && histVal !== false)
    const met = isCurrent ? (reported && !!rec.met) : reported
    return { rec, reported, met, doneLadder: met ? (histLadder ?? fallbackLadder) : null }
  }
  const earnedFor = (g) => history?.[String(g)] || history?.[g] || null

  // The ladder of the earliest completed mission, scanned chronologically (grade
  // ascending, then occasion order). Blanks that come *before* any completion
  // borrow it, so a soldier who did, say, Pre-1A on ladder 12 before switching
  // doesn't see those untouched early months priced at today's ladder.
  let firstDoneLadder = null
  for (const g of grades) {
    const isCurrent = String(g) === String(grade)
    const earnedPast = earnedFor(g)
    const hit = occasions.find((occ) => resolve(occ, isCurrent, earnedPast).met)
    if (hit) { firstDoneLadder = resolve(hit, isCurrent, earnedPast).doneLadder; break }
  }

  // Walk the board in that same chronological order, tracking the ladder of the
  // most recent completed mission. `lastDoneLadder` only advances on a done
  // mission, so a run of blanks all inherit the same ladder.
  let lastDoneLadder = null
  const boards = grades.map((g) => {
    const isCurrent = String(g) === String(grade)
    const earnedPast = earnedFor(g)
    const missions = occasions.map((occ) => {
      const occKey = occ.holiday ? 'Tishrei' : occ.key
      const { rec, reported, met, doneLadder } = resolve(occ, isCurrent, earnedPast)

      // Done → its own ladder. Blank → the last ladder actually completed; before
      // the first completion, the first one; only if nothing was ever done, the
      // current ladder.
      const quotaLadder = met ? doneLadder : (lastDoneLadder ?? firstDoneLadder ?? fallbackLadder)
      const quota = quotaLadder ? quotaFor(g, occKey, quotaLadder) : null
      if (met && doneLadder) lastDoneLadder = doneLadder

      if (!isCurrent) {
        return { ...occ, record: reported, met, ladder: doneLadder, quota: quota?.v ?? null, quotaLabel: quota?.k ?? null, minutes: quota?.m ?? null }
      }
      if (!reported) {
        return { ...occ, record: false, met: false, ladder: null, quota: quota?.v ?? null, quotaLabel: quota?.k ?? null, minutes: quota?.m ?? null }
      }
      // A recorded current-month mission: when met, keep the server's exact
      // figures; when not met, show the last-done ladder's quota (computed above).
      return {
        ...occ,
        record: true,
        met,
        ladder: doneLadder,
        quota: met ? (rec.quota ?? quota?.v ?? null) : (quota?.v ?? null),
        quotaLabel: met ? (rec.quotaLabel || quota?.k || null) : (quota?.k ?? null),
        minutes: met ? (rec.minutes ?? quota?.m ?? null) : (quota?.m ?? null),
        said: rec.said,
        saidMinutes: rec.saidMinutes,
      }
    })
    return {
      grade: g,
      title: g === 'pre1a' ? 'Pre-1A' : `${GRADE_LABEL[g]} Grade`,
      missions,
      done: missions.filter((m) => m.record && m.met).length,
    }
  })
  const total = boards.reduce((n, b) => n + b.missions.length, 0)
  const done = boards.reduce((n, b) => n + b.done, 0)
  return { boards, total, done, priorMissions }
}

/** Flat chronological list for streaks: prior-year rows first, then this year. */
export function streakMissions(progress) {
  const prior = progress?.historyMonths || []
  const current = progress?.months || []
  const ordered = [...prior, ...current]
  return ordered.map((m) => ({
    met: !!m.met,
    record: m.reported !== false,
    holiday: m.month === 'Rosh Hashana' || m.month === 'Yom Kippur',
  }))
}
