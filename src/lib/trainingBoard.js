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

export function gradesOnLadder(ladder) {
  const finish = Number(ladder)
  if (!finish) return GRADE_ORDER.slice()
  return GRADE_ORDER.filter((g) => (g === 'pre1a' ? 0 : Number(g)) <= finish)
}

function monthRecord(byMonth, key) {
  return byMonth[key] || byMonth[key === 'Adar' ? 'Adar I' : key] || null
}

/**
 * One cell per mission on this ladder. A check means a record says the quota
 * was met. No record stays blank — it is not shown as a miss.
 */
export function buildTraining({ grade, ladder, months, priorMissions = 0 }) {
  const grades = gradesOnLadder(ladder)
  const byMonth = {}
  for (const month of months || []) {
    if (month?.month) byMonth[month.month] = month
  }
  const boards = grades.map((g) => {
    const isCurrent = String(g) === String(grade)
    const missions = OCCASIONS.map((occ) => {
      const quota = !occ.holiday && ladder ? quotaFor(g, occ.key, ladder) : null
      if (!isCurrent) {
        return { ...occ, record: false, met: false, quota: quota?.v ?? null, quotaLabel: quota?.k ?? null, minutes: quota?.m ?? null }
      }
      const rec = monthRecord(byMonth, occ.key)
      if (!rec || rec.reported === false) {
        return { ...occ, record: false, met: false, quota: quota?.v ?? null, quotaLabel: quota?.k ?? null, minutes: quota?.m ?? null }
      }
      return {
        ...occ,
        record: true,
        met: !!rec.met,
        quota: rec.quota ?? quota?.v ?? null,
        quotaLabel: rec.quotaLabel || quota?.k || null,
        minutes: rec.minutes ?? quota?.m ?? null,
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
