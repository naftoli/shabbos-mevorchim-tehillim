// Data facade. Every page/component reads campaign numbers through this module,
// so the demo→live switch happens in one place. Today it computes everything
// from the anonymized demo roster; when the PHP/Mashpia API lands, each function
// branches `if (!IS_DEMO) return mashpia.<same fn>()` — the Lulav pattern.

import { quotaFor } from '@/data/ladders.js'
import { DEFAULT_FIRST_MONTH, elapsedSchoolYearSlots, quotaSheetMonth, schoolYearSlots, schoolYearStartYear } from '@/lib/schoolYear.js'
import { canSeeClassRoll, rankForMedals } from '@/lib/decisions.js'
import { effectiveKapQuota, metKap, overrideAccessStatus } from '@/lib/quotaOverride.js'
import { cellFor, formatKapitlachQuota, generateCustomLadder } from '@/lib/customLadder.js'
import {
  applySoldierReport,
  kapitlachInTotals,
  minutesInTotals,
  OVER_ENTRY_CONFIRM,
  reviewSoldier,
} from '@/lib/overEntry.js'
import { classIsPerfect } from '@/lib/perfectPlatoons.js'
import { cmpSchoolRace } from '@/lib/schoolRace.js'
import { placeAmong } from '@/lib/placeRank.js'
import { compareSoldiers } from '@/lib/soldierBoard.js'
import { medalState } from '@/lib/medals.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import { splitIncompleteNames } from '@/lib/notCompleted.js'
import { sortClasses, sortPlatoons } from '@/lib/classOrder.js'
import { formatClassName } from '@/lib/formatClassName.js'
import * as mashpia from './mashpia.js'
import { campaignMonths } from '@/lib/hebrewYear.js'
import { breakdownMonthNames, campaignYearsThrough, scaleMonthRows } from '@/lib/runningTotals.js'
import { ladderIsOpen } from '@/lib/schoolLadders.js'
import {
  ROSTER,
  CURRENT_MONTH,
  CURRENT_MONTH_INDEX,
  ELAPSED_MONTHS,
  CAMPAIGN_YEAR,
  PRIOR_CAMPAIGN_YEAR,
  PRIOR_YEARS_KAPITLACH,
  YEAR_KAPITLACH,
  DEMO_ADMINS,
  DEMO_ADMIN_PASSWORD,
  ARMY_DEDICATION,
  schoolDedication,
  setSchoolDedicationStore,
  schoolYearStart,
  setSchoolYearStartStore,
  schoolHiddenLadders,
  setSchoolHiddenLaddersStore,
  saveKidProgress,
  clearKidProgress,
} from '@/data/demo.js'

const HOLIDAYS = new Set(['Rosh Hashana', 'Yom Kippur'])
export function isHolidayMonth(month) {
  return HOLIDAYS.has(month)
}

// The demo roster has no Rosh Hashana / Yom Kippur reports, so a holiday boards
// off the Shabbos-Mevorchim Tishrei figures (quota AND said) while keeping its own
// label — mirroring live, where the holiday quota is the Tishrei quota.
const demoDataMonth = (month) => (isHolidayMonth(month) ? 'Tishrei' : month)

function saidOf(kid, month, year) {
  if (year && String(year) !== String(CAMPAIGN_YEAR)) return kid.priorYearReports?.[month] ?? 0
  return kapitlachInTotals(kid, month)
}
function minutesOf(kid, month, year) {
  if (year && String(year) !== String(CAMPAIGN_YEAR)) return kid.priorYearMinutes?.[month] ?? 0
  return minutesInTotals(kid, month)
}
function reportedOf(kid, month, year) {
  if (year && String(year) !== String(CAMPAIGN_YEAR)) return kid.priorYearReports?.[month] != null
  const flag = kid.flag
  if (flag && flag.month === month && flag.status === 'flagged' && flag.counts === false) {
    return !!flag.priorReported
  }
  return Object.prototype.hasOwnProperty.call(kid.reports || {}, month)
}

export { CURRENT_MONTH, CURRENT_MONTH_INDEX, ELAPSED_MONTHS, CAMPAIGN_YEAR }

const OVERRIDE_KEY = 'wwtc.demo.quotaOverrides'
const CUSTOM_LADDER_KEY = 'wwtc.demo.customLadders'
const AUDIT_KEY = 'wwtc.demo.auditLog'

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '[]') } catch { return [] }
}
function saveOverrides(rows) {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(rows)) } catch { /* private mode */ }
}
function pushAudit(entry) {
  try {
    const all = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')
    all.push(entry)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(all))
  } catch { /* private mode */ }
}
function activeOverride(kidId, year, month) {
  return loadOverrides().find((row) => (
    String(row.userId) === String(kidId)
    && String(row.year) === String(year)
    && row.month === month
    && !row.undoneAt
  )) || null
}
function loadCustomLadders() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_LADDER_KEY) || '[]') } catch { return [] }
}
function saveCustomLadders(rows) {
  try { localStorage.setItem(CUSTOM_LADDER_KEY, JSON.stringify(rows)) } catch { /* private mode */ }
}
function activeCustomLadder(kidId) {
  return loadCustomLadders().find((row) => String(row.userId) === String(kidId) && !row.removedAt) || null
}
// Demo quotas come from a custom ladder when one is active, otherwise the
// soldier's current ladder (Cheshvan is repriced from today's ladder).
// A one-month override replaces the kapitel number only.
// saidOf already withholds a flagged amount that does not count yet.
function ladderCell(kid, month, firstMonth = DEFAULT_FIRST_MONTH) {
  const named = quotaSheetMonth(demoDataMonth(month), firstMonth)
  const custom = activeCustomLadder(kid.id)
  if (custom?.grid) {
    const cell = cellFor(custom.grid, kid.grade, named)
    if (cell) return cell
  }
  return quotaFor(kid.grade, named, kid.ladder)
}
function quotaLabelFor(kid, month, quota, adjusted, firstMonth = DEFAULT_FIRST_MONTH) {
  if (adjusted) return String(quota)
  const cell = ladderCell(kid, month, firstMonth)
  if (activeCustomLadder(kid.id)) return formatKapitlachQuota(cell?.v).label || '—'
  return cell?.k || '—'
}
function engineKap(kid, month, firstMonth = DEFAULT_FIRST_MONTH) {
  return ladderCell(kid, month, firstMonth)?.v ?? 0
}
function engineMin(kid, month, firstMonth = DEFAULT_FIRST_MONTH) {
  return ladderCell(kid, month, firstMonth)?.m ?? 0
}
function kapSnapshot(kid, month, year = CAMPAIGN_YEAR, firstMonth = DEFAULT_FIRST_MONTH) {
  const engine = engineKap(kid, month, firstMonth)
  const eff = effectiveKapQuota(engine, activeOverride(kid.id, year, month))
  const said = saidOf(kid, month, year)
  const reported = reportedOf(kid, month, year)
  return { ...eff, said, reported, met: metKap(eff.quota, said, reported) }
}
function missionBonus(kid) {
  let extra = 0
  for (const row of loadOverrides()) {
    if (String(row.userId) !== String(kid.id) || row.undoneAt) continue
    const engine = engineKap(kid, row.month)
    const said = saidOf(kid, row.month, row.year)
    const reported = reportedOf(kid, row.month, row.year)
    const was = metKap(engine, said, reported)
    const now = metKap(Number(row.overriddenQuota) || 0, said, reported)
    if (now && !was) extra += 1
  }
  return extra
}

const kidMonthQuota = (kid, month, year = CAMPAIGN_YEAR, firstMonth = DEFAULT_FIRST_MONTH) => kapSnapshot(kid, month, year, firstMonth).quota
const kidMonthSaid = (kid, month) => kapitlachInTotals(kid, month)
const kidMonthMinutes = (kid, month) => minutesInTotals(kid, month)
const metQuota = (kid, month, firstMonth = DEFAULT_FIRST_MONTH) => kapSnapshot(kid, month, CAMPAIGN_YEAR, firstMonth).met
const metAt = (kid, month, year, firstMonth = DEFAULT_FIRST_MONTH) => kapSnapshot(kid, month, year, firstMonth).met
const kidSaidYear = (kid) => ELAPSED_MONTHS.reduce((a, mo) => a + kidMonthSaid(kid, mo), 0)

// ---- school aggregates -----------------------------------------------------

function schoolAgg(school, month = CURRENT_MONTH, year = CAMPAIGN_YEAR) {
  const first = schoolYearStart(school.id)
  const yearSlots = elapsedSchoolYearSlots(first, Number(year) || Number(CAMPAIGN_YEAR), month)
  let kids = 0
  let saidMonth = 0
  let quotaMonth = 0
  let saidYear = 0
  let minutesSaidMonth = 0
  let minutesQuotaMonth = 0
  let metMonth = 0
  let participatedMonth = 0
  for (const cls of school.classes) {
    for (const kid of cls.kids) {
      kids += 1
      const said = saidOf(kid, month, year)
      saidMonth += said
      quotaMonth += kidMonthQuota(kid, month, year, first)
      minutesSaidMonth += minutesOf(kid, month, year)
      minutesQuotaMonth += engineMin(kid, month, first)
      if (metAt(kid, month, year, first)) metMonth += 1
      if (reportedOf(kid, month, year) && said > 0) participatedMonth += 1
      saidYear += yearSlots.reduce((sum, slot) => sum + saidOf(kid, slot.month, slot.year), 0)
    }
  }
  const pct = quotaMonth > 0 ? Math.round((saidMonth / quotaMonth) * 100) : 0
  const pctMet = kids > 0 ? Math.round((metMonth / kids) * 100) : 0
  const minutesPct = minutesQuotaMonth > 0 ? Math.round((minutesSaidMonth / minutesQuotaMonth) * 100) : 0
  const pctParticipated = kids > 0 ? Math.round((participatedMonth / kids) * 100) : 0
  return {
    id: school.id,
    name: school.name,
    city: school.city,
    color: school.color,
    logo: school.logo || null,
    kids,
    saidMonth,
    quotaMonth,
    saidYear,
    minutesSaidMonth,
    minutesQuotaMonth,
    metMonth,
    participatedMonth,
    pct,
    pctMet,
    pctParticipated,
    minutesPct,
  }
}

// Live-data subscription. In live mode useLiveData's refresh rides the Mashpia
// client's 30s poll; in demo mode it fires whenever a demo write invalidates the
// cache, so the admin console refreshes right after an edit.
const listeners = new Set()
export function subscribe(cb) {
  if (!IS_DEMO) return mashpia.subscribe(cb)
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Drop a live bearer-token session (logout, or an expired token). No-op in demo.
export function endSession(role) {
  if (!IS_DEMO) mashpia.endSession(role)
}

let _schools = null
const schools = () => (_schools ??= ROSTER.map((s) => schoolAgg(s)))
function schoolsFor(month = CURRENT_MONTH, year = CAMPAIGN_YEAR) {
  if (String(year) === String(CAMPAIGN_YEAR) && month === CURRENT_MONTH) return schools()
  return ROSTER.map((s) => schoolAgg(s, month, year))
}
const invalidate = () => {
  _schools = null
  listeners.forEach((cb) => cb())
}

// ---- global ----------------------------------------------------------------

export async function getGlobalStats(period) {
  if (!IS_DEMO) return mashpia.getGlobalStats(period)
  const month = period?.month || CURRENT_MONTH
  const year = period?.year || CAMPAIGN_YEAR
  const dataMonth = demoDataMonth(month)
  const s = schoolsFor(dataMonth, year)
  const acc = s.reduce((a, x) => a + x.saidMonth, 0)
  const quota = s.reduce((a, x) => a + x.quotaMonth, 0)
  const soldiers = s.reduce((a, x) => a + x.kids, 0)
  const minutes = s.reduce((a, x) => a + x.minutesSaidMonth, 0)
  const minutesQuota = s.reduce((a, x) => a + x.minutesQuotaMonth, 0)
  const metSoldiers = s.reduce((a, x) => a + x.metMonth, 0)
  const participated = s.reduce((a, x) => a + x.participatedMonth, 0)
  const classes = ROSTER.reduce((a, x) => a + x.classes.length, 0)
  return {
    monthLabel: month,
    year,
    holiday: isHolidayMonth(month),
    accomplished: acc,
    quota,
    pct: quota > 0 ? Math.round((acc / quota) * 100) : 0,
    minutes,
    minutesQuota,
    minutesPct: minutesQuota > 0 ? Math.round((minutes / minutesQuota) * 100) : 0,
    metSoldiers,
    participatedSoldiers: participated,
    pctSoldiersParticipated: soldiers > 0 ? Math.round((participated / soldiers) * 100) : 0,
    pctSoldiersMet: soldiers > 0 ? Math.round((metSoldiers / soldiers) * 100) : 0,
    soldiers,
    schools: s.length,
    classes,
    perfectPlatoons: demoPerfectPlatoons(dataMonth, year).length,
  }
}

export async function getRunningTotals() {
  if (!IS_DEMO) return mashpia.getRunningTotals()
  const s = schools()
  const thisMonth = s.reduce((a, x) => a + x.saidMonth, 0)
  // Headline worldwide total is a fixed demo figure (see YEAR_KAPITLACH).
  const thisYear = YEAR_KAPITLACH
  return { thisMonth, thisYear, allTime: thisYear + PRIOR_YEARS_KAPITLACH }
}

// Month rows use the roster's own said kapitlach and minutes. This year's
// rows are scaled so they add up to the headline YEAR_KAPITLACH. Earlier
// years reuse that prior-year month shape (5778 starts at Cheshvan; a leap
// year keeps both Adars) and add up to PRIOR_YEARS_KAPITLACH.
function demoMonthArmy(month, year) {
  const rows = schoolsFor(month, year)
  return {
    kapitlach: rows.reduce((sum, school) => sum + (school.saidMonth || 0), 0),
    minutes: rows.reduce((sum, school) => sum + (school.minutesSaidMonth || 0), 0),
  }
}

function demoPriorWeights() {
  const weights = {}
  for (const month of campaignMonths(PRIOR_CAMPAIGN_YEAR)) {
    weights[month] = demoMonthArmy(month, PRIOR_CAMPAIGN_YEAR)
  }
  if (!weights['Adar I'] && weights.Adar) weights['Adar I'] = { ...weights.Adar }
  if (!weights['Adar II'] && weights.Adar) weights['Adar II'] = { ...weights.Adar }
  return weights
}

function demoRunningBreakdown() {
  const year = Number(CAMPAIGN_YEAR)
  const months = scaleMonthRows(
    ELAPSED_MONTHS.map((month) => ({ year, month, ...demoMonthArmy(month, year) })),
    YEAR_KAPITLACH,
  )
  const weights = demoPriorWeights()
  const priorYears = campaignYearsThrough(year - 1).map((y) => {
    let kapitlach = 0
    let minutes = 0
    for (const month of breakdownMonthNames(y)) {
      const weight = weights[month] || { kapitlach: 0, minutes: 0 }
      kapitlach += weight.kapitlach
      minutes += weight.minutes
    }
    return { year: y, kapitlach, minutes }
  })
  const scaledPrior = scaleMonthRows(priorYears, PRIOR_YEARS_KAPITLACH)
  const thisYear = {
    year,
    kapitlach: months.reduce((sum, row) => sum + row.kapitlach, 0),
    minutes: months.reduce((sum, row) => sum + row.minutes, 0),
  }
  return {
    firstYear: 5778,
    firstMonth: 'Cheshvan',
    year,
    years: [...scaledPrior, thisYear],
    months,
  }
}

export async function getRunningTotalsBreakdown() {
  if (!IS_DEMO) return mashpia.getRunningTotalsBreakdown()
  return demoRunningBreakdown()
}

export async function getSchools(period) {
  if (!IS_DEMO) return mashpia.getSchools(period)
  const month = period?.month || CURRENT_MONTH
  const year = period?.year || CAMPAIGN_YEAR
  return schoolsFor(demoDataMonth(month), year).slice().sort((a, b) => b.saidMonth - a.saidMonth)
}
export function topSchoolsByKapitlach(n = 5) {
  return schools().slice().sort((a, b) => b.saidMonth - a.saidMonth).slice(0, n)
}
export function topSchoolsByQuota(n = 5) {
  return schools()
    .slice()
    .sort((a, b) => b.pctMet - a.pctMet || b.pct - a.pct || b.saidMonth - a.saidMonth || a.name.localeCompare(b.name))
    .slice(0, n)
}
export async function getPerfectPlatoons(period) {
  const rows = !IS_DEMO
    ? await mashpia.getPerfectPlatoons(period)
    : demoPerfectPlatoons(demoDataMonth(period?.month || CURRENT_MONTH), period?.year || CAMPAIGN_YEAR)
  return sortPlatoons(rows)
}

function demoPerfectPlatoons(month = CURRENT_MONTH, year = CAMPAIGN_YEAR) {
  const out = []
  for (const school of ROSTER) {
    let said = 0
    for (const cls of school.classes) {
      for (const kid of cls.kids) said += saidOf(kid, month, year)
    }
    for (const cls of school.classes) {
      let met = 0
      for (const kid of cls.kids) {
        if (metAt(kid, month, year)) met += 1
      }
      if (classIsPerfect(met, cls.kids.length)) {
        out.push({
          schoolId: school.id,
          school: school.name,
          classId: cls.id,
          className: cls.name,
          teacher: cls.teacher,
          grade: cls.grade,
          size: cls.kids.length,
          schoolClasses: school.classes.length,
          schoolSaid: said,
        })
      }
    }
  }
  return out
}

export async function getCampaignCalendar(year) {
  if (!IS_DEMO) return mashpia.getCampaign(year)
  const y = year ? Number(year) : Number(CAMPAIGN_YEAR)
  return {
    year: y,
    years: [Number(CAMPAIGN_YEAR), Number(PRIOR_CAMPAIGN_YEAR)],
    months: y === Number(CAMPAIGN_YEAR) ? ELAPSED_MONTHS : campaignMonths(y),
    currentMonth: CURRENT_MONTH,
    holidayMonths: ['Rosh Hashana', 'Yom Kippur'],
  }
}

// ---- auth ------------------------------------------------------------------

function locate(kidId) {
  for (const school of ROSTER) {
    for (const cls of school.classes) {
      const kid = cls.kids.find((k) => k.id === kidId)
      if (kid) return { kid, school, cls }
    }
  }
  return null
}

function safeKid(kid, school, cls) {
  // Public payload: never the dob. Mirrors Lulav's kidKey discipline.
  return {
    id: kid.id,
    serial: kid.serial,
    name: kid.name,
    grade: kid.grade,
    ladder: kid.ladder,
    gender: kid.gender || null,
    photoUrl: kid.photoUrl || null,
    schoolId: school.id,
    schoolName: school.name,
    className: cls.name,
    yearStart: schoolYearStart(school.id),
    hiddenLadders: schoolHiddenLadders(school.id),
  }
}

export async function verifyKid(serial, dob) {
  if (!IS_DEMO) return mashpia.verifyKid(serial, dob)
  return demoVerifyKid(serial, dob)
}

// Parent-site handoff. Demo data has no parents, so there is nothing to honour
// here when the live API is off.
export async function verifyKidHandoff(code) {
  if (!IS_DEMO) return mashpia.verifyKidHandoff(code)
  return null
}

function demoVerifyKid(serial, dob) {
  for (const school of ROSTER) {
    for (const cls of school.classes) {
      const kid = cls.kids.find((k) => k.serial === String(serial).trim() && k.dob === dob)
      if (kid) {
        // The demo "new kid" starts fresh on every sign-in, so the first-login
        // ladder flow can always be shown. (Real kids keep their chosen ladder.)
        if (kid.isDemoNew) {
          kid.ladder = null
          kid.reports = {}
          kid.minutesByMonth = {}
          kid.minutes = 0
          kid.metThisYear = 0
          kid.missionsTotal = kid.priorMissions || 0 // keep prior-year missions for the medal demo
          clearKidProgress(kid.id)
          invalidate()
        }
        return safeKid(kid, school, cls)
      }
    }
  }
  return null
}

export function getKid(id) {
  const found = locate(id)
  return found ? safeKid(found.kid, found.school, found.cls) : null
}

export async function verifyAdmin(username, password) {
  if (!IS_DEMO) return mashpia.verifyAdmin(username, password)
  if (password !== DEMO_ADMIN_PASSWORD) return null
  const a = DEMO_ADMINS.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase())
  return a ? { kind: a.kind, name: a.name, schoolId: a.schoolId, username: a.username } : null
}

// ---- soldier progress + medals --------------------------------------------

// Live: the API computes months/met server-side; the medal is derived here (the
// backend leaves medal null — medal logic is client-side). Demo: from the roster.
export async function getKidProgress(id) {
  if (!IS_DEMO) {
    const p = await mashpia.getKidProgress()
    return p ? { ...p, medal: medalState(p.missionsTotal) } : null
  }
  return demoKidProgress(id)
}

function monthRow(kid, slot, first, current) {
  const snap = kapSnapshot(kid, slot.month, slot.year, first)
  return {
    month: slot.month,
    year: slot.year,
    quota: snap.quota,
    originalQuota: snap.originalQuota,
    quotaAdjusted: snap.quotaAdjusted,
    quotaLabel: quotaLabelFor(kid, slot.month, snap.quota, snap.quotaAdjusted, first),
    said: snap.said,
    minutes: engineMin(kid, slot.month, first),
    saidMinutes: slot.year === Number(CAMPAIGN_YEAR) ? kidMonthMinutes(kid, slot.month) : (kid.priorYearMinutes?.[slot.month] ?? 0),
    met: snap.met,
    reported: snap.reported,
    isCurrent: current && slot.month === CURRENT_MONTH && slot.year === Number(CAMPAIGN_YEAR),
  }
}

function demoKidProgress(id) {
  const found = locate(id)
  if (!found) return null
  const { kid } = found
  const first = schoolYearStart(found.school.id)
  const anchorYear = Number(CAMPAIGN_YEAR)
  const currentSlots = elapsedSchoolYearSlots(first, anchorYear, CURRENT_MONTH)
  const priorOrigin = schoolYearStartYear(first, anchorYear, CURRENT_MONTH) - 1
  const months = currentSlots.map((slot) => monthRow(kid, slot, first, true))
  const historyMonths = schoolYearSlots(first, priorOrigin).map((slot) => monthRow(kid, slot, first, false))
  // The demo roster only holds one prior year, so stand in a mission history for
  // it under the prior grade — enough for the training board to draw real checks
  // locally. Live builds the full multi-year history from DB marks (index.php).
  const GRADE_SEQ = ['pre1a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  const gi = GRADE_SEQ.indexOf(String(kid.grade))
  const priorGrade = gi > 0 ? GRADE_SEQ[gi - 1] : null
  const missionHistory = priorGrade
    ? { [priorGrade]: Object.fromEntries(historyMonths.filter((m) => m.met).map((m) => [m.month, Number(kid.ladder) || true])) }
    : {}
  const missionsTotal = (kid.missionsTotal || 0) + missionBonus(kid)
  const medal = medalState(missionsTotal)
  return {
    ...safeKid(kid, found.school, found.cls),
    months: months.map((m) => ({ ...m, reported: m.reported ?? Object.prototype.hasOwnProperty.call(kid.reports || {}, m.month) })),
    historyMonths,
    priorMissions: kid.priorMissions,
    metThisYear: months.filter((m) => m.met).length,
    missionsTotal,
    missionHistory,
    medal,
    rank: rankForMedals(medal.earnedCount),
    current: months.find((m) => m.isCurrent) ?? null,
    customLadder: activeCustomLadder(kid.id)?.grid ?? null,
    flagged: kid.flag?.status === 'flagged' ? { ...kid.flag, counts: false } : null,
  }
}

function engineMet(kid, month, year = CAMPAIGN_YEAR) {
  return metKap(engineKap(kid, month), saidOf(kid, month, year), reportedOf(kid, month, year))
}
function recomputeDemoMissions(kid) {
  let met = 0
  // Stored mission count stays on the ladder quota. An override is added when
  // the progress is read, so a flagged amount that does not count is not a mission.
  for (const mo of ELAPSED_MONTHS) if (engineMet(kid, mo)) met += 1
  kid.metThisYear = met
  kid.missionsTotal = (kid.priorMissions || 0) + met
  kid.minutes = Object.values(kid.minutesByMonth || {}).reduce((a, m) => a + (Number(m) || 0), 0)
}

// Record a month's completion. Live: POST /me/report (current Shabbos Mevorchim,
// token-scoped — id/month are ignored, the server uses the signed-in soldier and
// the current month). Demo: mutate in memory. Returns fresh progress.
export async function recordMonth(id, month, kapitlach, minutes, extra = {}) {
  if (!IS_DEMO) {
    const p = await mashpia.recordMonth(Number(kapitlach) || 0, Number(minutes) || 0, extra)
    return p ? { ...p, medal: medalState(p.missionsTotal) } : null
  }
  const found = locate(id)
  if (!found) return null
  const { kid, school, cls } = found
  const q = ladderCell(kid, month, schoolYearStart(school.id))
  const result = applySoldierReport(kid, {
    month,
    kapitlach: Number(kapitlach) || 0,
    minutes: Number(minutes) || 0,
    quotaKap: q?.v ?? 0,
    quotaMin: q?.m ?? 0,
    grade: kid.grade,
    flagConfirmed: !!extra.flagConfirmed,
    kidName: kid.name,
    className: cls.name,
    schoolId: school.id,
    schoolName: school.name,
    year: CAMPAIGN_YEAR,
  })
  if (result.error === 'over_entry') {
    const err = new Error(OVER_ENTRY_CONFIRM)
    err.code = 'over_entry'
    err.threshold = result.plan.line
    throw err
  }
  recomputeDemoMissions(kid)
  saveKidProgress(kid)
  invalidate()
  const progress = demoKidProgress(id)
  if (result.plan.action === 'save' && extra?.exceptionalConfirmed) progress.exceptional = { emailed: false, reason: 'demo' }
  return progress
}

export async function getFlagQueue({ schoolId = null, all = false } = {}) {
  if (!IS_DEMO) return mashpia.getFlagQueue()
  const pending = []
  const recent = []
  for (const school of ROSTER) {
    if (!all && school.id !== schoolId) continue
    for (const cls of school.classes) {
      for (const kid of cls.kids) {
        if (!kid.flag) continue
        const row = {
          ...kid.flag,
          kidName: kid.flag.kidName || kid.name,
          className: kid.flag.className || cls.name,
          schoolName: kid.flag.schoolName || school.name,
          schoolId: kid.flag.schoolId ?? school.id,
        }
        if (kid.flag.status === 'flagged') pending.push(row)
        else if (kid.flag.decisions?.length) recent.push(row)
      }
    }
  }
  const lastAt = (row) => {
    const list = row.decisions || []
    return list.length ? list[list.length - 1].at : ''
  }
  pending.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  recent.sort((a, b) => String(lastAt(b)).localeCompare(String(lastAt(a))))
  return { ready: true, pending, recent }
}

export async function reviewFlag(id, action, actorName) {
  if (!IS_DEMO) return mashpia.reviewFlag(id, action)
  for (const school of ROSTER) {
    for (const cls of school.classes) {
      for (const kid of cls.kids) {
        if (!kid.flag || String(kid.flag.id) !== String(id)) continue
        const result = reviewSoldier(kid, action, { type: 'admin', name: actorName || 'Admin' })
        if (!result.ok) throw new Error(result.error)
        recomputeDemoMissions(kid)
        saveKidProgress(kid)
        invalidate()
        return { ok: true, entry: kid.flag }
      }
    }
  }
  throw new Error('Flagged entry not found.')
}

// Switch a soldier's ladder. Live: PUT /me/ladder (writes user_tracks.track_id,
// token-scoped). Demo: mutate in memory; whether past months count as missions is
// re-derived against the new ladder's quotas. Returns fresh progress.
export async function setKidLadder(id, ladder) {
  if (!IS_DEMO) {
    const p = await mashpia.setKidLadder(Number(ladder))
    return p ? { ...p, medal: medalState(p.missionsTotal) } : null
  }
  const found = locate(id)
  if (!found) return null
  const { kid } = found
  const next = Number(ladder)
  const hidden = schoolHiddenLadders(found.school.id)
  if (!ladderIsOpen(next, hidden)) return null
  // The dashboard re-applies the session ladder on every read. Skip the
  // notify when nothing changed, or that read refreshes itself forever.
  if (kid.ladder === next) return demoKidProgress(id)
  kid.ladder = next
  let met = 0
  for (const mo of ELAPSED_MONTHS) if (engineMet(kid, mo)) met += 1
  kid.metThisYear = met
  kid.missionsTotal = kid.priorMissions + met
  saveKidProgress(kid)
  invalidate()
  return demoKidProgress(id)
}

// Admin sets a ladder across a scope: a whole school (classId/kidId null), one
// class (classId set), or one soldier (classId + kidId). kidId is the platoon
// roll's row id — the soldier's internal id in the demo roster, the user_id
// live. Live: PUT /admin/ladder (the server enforces the admin's authority).
// Demo: mutate the roster and re-derive missions, like setKidLadder does.
// Returns { ok, matched, updated } — matched is the number of soldiers in scope.
export async function adminSetLadder({ schoolId, classId = null, kidId = null, ladder }) {
  if (!IS_DEMO) return mashpia.adminSetLadder({ schoolId, classId, kidId, ladder })
  const next = Number(ladder)
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school || !ladderIsOpen(next, schoolHiddenLadders(schoolId))) return { ok: false, matched: 0, updated: 0 }
  const targets = []
  for (const cls of school.classes) {
    if (classId && cls.id !== classId) continue
    for (const kid of cls.kids) {
      if (kidId && kid.id !== kidId) continue
      targets.push(kid)
    }
  }
  let updated = 0
  for (const kid of targets) {
    if (kid.ladder === next) continue
    kid.ladder = next
    let met = 0
    for (const mo of ELAPSED_MONTHS) if (engineMet(kid, mo)) met += 1
    kid.metThisYear = met
    kid.missionsTotal = kid.priorMissions + met
    saveKidProgress(kid)
    updated += 1
  }
  invalidate()
  return { ok: true, matched: targets.length, updated }
}

// Social context for a soldier: where their class stands in the school, where
// the school stands worldwide, and the nudge to climb a rank. Drives the
// "your class needs you" line on the dashboard.
export async function getKidSocial(id) {
  if (!IS_DEMO) return mashpia.getKidSocial()
  const found = locate(id)
  if (!found) return null
  const { kid, school, cls } = found

  // This soldier's rank in the class, and among chayolim in the base, by
  // kapitlach said THIS month. Ties share a place (1, 1, 3). Name only orders
  // the board; it does not split the rank.
  const saidScore = (k) => [kidMonthSaid(k, CURRENT_MONTH)]
  const classKids = cls.kids.slice()
  const myClassPlace = placeAmong(classKids, saidScore, (k) => k.id, kid.id)
  const schoolKids = school.classes.flatMap((c) => c.kids)
  const mySchoolPlace = placeAmong(schoolKids, saidScore, (k) => k.id, kid.id)

  // Class standings within this school, by % of soldiers who completed.
  const standings = school.classes
    .map((c) => {
      const size = c.kids.length
      const met = c.kids.reduce((a, k) => a + (metQuota(k, CURRENT_MONTH) ? 1 : 0), 0)
      return { id: c.id, name: c.name, size, met, pctMet: size ? (met / size) * 100 : 0 }
    })
    .sort((a, b) => b.pctMet - a.pctMet || b.met - a.met)

  const classPlace = placeAmong(standings, (c) => [c.pctMet, c.met], (c) => c.id, cls.id)
  const rank = standings.findIndex((c) => c.id === cls.id)
  const mine = standings[rank]
  const ahead = rank > 0 ? standings[rank - 1] : null

  // How many more soldiers in my class need to finish to pass the class ahead.
  let needToPass = 0
  if (ahead && mine.size > 0) {
    const targetMet = Math.floor((ahead.pctMet / 100) * mine.size) + 1
    needToPass = Math.max(1, Math.min(mine.size - mine.met, targetMet - mine.met))
    if (mine.met >= mine.size) needToPass = 0
  }

  // School standing worldwide — same Race order as Home (% soldiers met first).
  const schoolRanked = schools().slice().sort(cmpSchoolRace)
  const schoolPlace = placeAmong(
    schoolRanked,
    (s) => [s.pctMet, s.saidMonth || 0, s.pct, s.minutesPct],
    (s) => s.id,
    school.id,
  )

  return {
    className: cls.name,
    classRank: classPlace?.rank || 0,
    totalClasses: standings.length,
    classAheadName: ahead?.name ?? null,
    needToPass,
    myRankInClass: myClassPlace?.rank || 0,
    classSize: cls.kids.length,
    myRankInSchool: mySchoolPlace?.rank || 0,
    schoolSize: schoolKids.length,
    classPerfect: classIsPerfect(mine?.met || 0, mine?.size || 0),
    schoolName: school.name,
    schoolRank: schoolPlace?.rank || 0,
    totalSchools: schoolRanked.length,
  }
}

// ---- one school (campaign page) -------------------------------------------

// Live: the PHP API returns the same shape (minus city, which Mashpia does not
// track, and dedication, which stays null until the write endpoint is designed).
// Demo: computed from the roster below. Async in both modes so callers are
// identical — see useLiveData.
export async function getSchool(id) {
  if (!IS_DEMO) return mashpia.getSchool(id)
  return demoSchool(id)
}

function demoSchool(id) {
  const school = ROSTER.find((s) => s.id === id)
  if (!school) return null
  const first = schoolYearStart(id)
  const agg = schoolAgg(school)
  const classes = school.classes.map((cls) => {
    let said = 0
    let quota = 0
    let met = 0
    let participated = 0
    let minsSaid = 0
    let minsQuota = 0
    for (const kid of cls.kids) {
      const kidSaid = kidMonthSaid(kid, CURRENT_MONTH)
      said += kidSaid
      quota += kidMonthQuota(kid, CURRENT_MONTH, CAMPAIGN_YEAR, first)
      minsSaid += kidMonthMinutes(kid, CURRENT_MONTH)
      minsQuota += engineMin(kid, CURRENT_MONTH, first)
      if (metQuota(kid, CURRENT_MONTH, first)) met += 1
      if (reportedOf(kid, CURRENT_MONTH, CAMPAIGN_YEAR) && kidSaid > 0) participated += 1
    }
    const size = cls.kids.length
    return {
      id: cls.id,
      name: cls.name,
      teacher: cls.teacher,
      grade: cls.grade,
      size,
      said,
      quota,
      met,
      participated,
      minutesSaid: minsSaid,
      pct: quota > 0 ? Math.round((said / quota) * 100) : 0,
      pctMet: size > 0 ? Math.round((met / size) * 100) : 0,
      pctParticipated: size > 0 ? Math.round((participated / size) * 100) : 0,
      minutesPct: minsQuota > 0 ? Math.round((minsSaid / minsQuota) * 100) : 0,
      perfect: classIsPerfect(met, size),
    }
  })
  return {
    ...agg,
    classes: sortClasses(classes),
    dedication: schoolDedication(id),
    yearStart: schoolYearStart(id),
    hiddenLadders: schoolHiddenLadders(id),
  }
}

// n omitted returns the whole board. The page shows ten at a time; ranking
// (and alphabetical ties) has to see everyone, not an arbitrary top 10.
export async function schoolSoldierLeaderboard(id, n = null) {
  if (!IS_DEMO) return mashpia.getSoldierLeaderboard(id, n)
  const school = ROSTER.find((s) => s.id === id)
  if (!school) return []
  const kids = []
  for (const cls of school.classes) {
    for (const kid of cls.kids) {
      kids.push({
        id: kid.id,
        name: kid.name,
        className: cls.name,
        grade: kid.grade,
        saidMonth: kidMonthSaid(kid, CURRENT_MONTH),
        saidYear: kidSaidYear(kid),
        missions: kid.missionsTotal + missionBonus(kid),
        ladder: kid.ladder,
      })
    }
  }
  kids.sort(compareSoldiers)
  return n == null ? kids : kids.slice(0, n)
}

export async function schoolClassLeaderboard(id) {
  if (!IS_DEMO) return mashpia.getClassLeaderboard(id)
  const school = demoSchool(id)
  if (!school) return []
  return school.classes.slice().sort((a, b) => b.pct - a.pct || b.said - a.said)
}

// ---- reports ---------------------------------------------------------------

const monthName = (idx) => ELAPSED_MONTHS[idx] ?? CURRENT_MONTH

// Army report: one row per school for a month.
export async function getArmyReport(monthIdx = CURRENT_MONTH_INDEX, period = null) {
  if (!IS_DEMO) return mashpia.getArmyReport(monthIdx, period)
  const month = period?.month || monthName(monthIdx)
  const year = period?.year || CAMPAIGN_YEAR
  const dataMonth = demoDataMonth(month)
  return {
    month,
    year,
    holiday: isHolidayMonth(month),
    rows: ROSTER.map((school) => {
      const first = schoolYearStart(school.id)
      let registered = 0
      let goal = 0
      let accomplished = 0
      let participated = 0
      let met = 0
      let minutes = 0
      let minutesGoal = 0
      for (const cls of school.classes) {
        for (const kid of cls.kids) {
          registered += 1
          const snap = kapSnapshot(kid, dataMonth, year, first)
          goal += snap.quota
          minutesGoal += engineMin(kid, dataMonth, first)
          accomplished += snap.said
          minutes += minutesOf(kid, dataMonth, year)
          if (snap.reported && snap.said > 0) participated += 1
          if (snap.met) met += 1
        }
      }
      return {
        id: school.id,
        name: school.name,
        logo: school.logo || null,
        registered,
        goal,
        accomplished,
        pct: goal ? Math.round((accomplished / goal) * 100) : 0,
        minutes,
        minutesGoal,
        minutesPct: minutesGoal ? Math.round((minutes / minutesGoal) * 100) : 0,
        participated,
        met,
        pctParticipated: registered ? Math.round((participated / registered) * 100) : 0,
        pctMet: registered ? Math.round((met / registered) * 100) : 0,
      }
    }),
  }
}

// Base report: one row per class in a school.
function withClassOrder(data) {
  if (!data || !Array.isArray(data.rows)) return data
  return { ...data, rows: sortClasses(data.rows) }
}

export async function getBaseReport(schoolId, monthIdx = CURRENT_MONTH_INDEX, period = null) {
  if (!IS_DEMO) return withClassOrder(await mashpia.getBaseReport(schoolId, monthIdx, period))
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return null
  const first = schoolYearStart(school.id)
  const month = period?.month || monthName(monthIdx)
  const year = period?.year || CAMPAIGN_YEAR
  const dataMonth = demoDataMonth(month)
  return {
    month,
    school: school.name,
    schoolId,
    rows: sortClasses(school.classes.map((cls) => {
      let goal = 0
      let accomplished = 0
      let completed = 0
      for (const kid of cls.kids) {
        const snap = kapSnapshot(kid, dataMonth, year, first)
        goal += snap.quota
        accomplished += snap.said
        if (snap.met) completed += 1
      }
      return { id: cls.id, name: cls.name, grade: cls.grade, teacher: cls.teacher, size: cls.kids.length, goal, accomplished, completed, perfect: classIsPerfect(completed, cls.kids.length) }
    })),
  }
}

// Same key AuthContext uses for the staff session. Demo has no PHP API, so the
// roll gate reads this record the way the live API reads the admin bearer.
const DEMO_ADMIN_KEY = 'wwtc_session_admin'
function readDemoStaff() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(DEMO_ADMIN_KEY)
    if (!raw) return null
    const { exp, data } = JSON.parse(raw)
    if (!exp || exp < Date.now() || !data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

// Platoon report. Public callers get the class summary only. The student roll
// is added for HQ, that school's admin, or that class's teacher (see
// PLATOON_ROLL_AUDIENCE). Demo follows the same rule as the live API.
export async function getPlatoonReport(classId, monthIdx = CURRENT_MONTH_INDEX, period = null) {
  if (!IS_DEMO) return mashpia.getPlatoonReport(classId, monthIdx, period)
  const month = period?.month || monthName(monthIdx)
  const year = period?.year || CAMPAIGN_YEAR
  const dataMonth = demoDataMonth(month)
  for (const school of ROSTER) {
    const cls = school.classes.find((c) => c.id === classId)
    if (!cls) continue
    const first = schoolYearStart(school.id)
    let completed = 0
    for (const kid of cls.kids) {
      if (metAt(kid, dataMonth, year, first)) completed += 1
    }
    const summary = {
      month,
      school: school.name,
      schoolId: school.id,
      className: cls.name,
      completed,
      size: cls.kids.length,
      perfect: classIsPerfect(completed, cls.kids.length),
      roll: false,
    }
    if (!canSeeClassRoll(readDemoStaff(), { classId: cls.id, schoolId: school.id })) return summary
    const rows = cls.kids.map((kid) => {
      const snap = kapSnapshot(kid, dataMonth, year, first)
      return {
        id: kid.id,
        name: kid.name,
        ladder: kid.ladder,
        goal: snap.quota,
        originalGoal: snap.originalQuota,
        goalLabel: quotaLabelFor(kid, dataMonth, snap.quota, snap.quotaAdjusted, first),
        said: snap.said,
        met: snap.met,
        quotaAdjusted: snap.quotaAdjusted,
      }
    })
    return { ...summary, roll: true, rows }
  }
  return null
}

const ARMY_DEDICATION_KEY = 'wwtc.demo.armyDedication'
function loadArmyDedications() {
  try { return JSON.parse(localStorage.getItem(ARMY_DEDICATION_KEY) || '{}') } catch { return {} }
}
export async function getArmyDedication(period) {
  if (!IS_DEMO) return mashpia.getDedication({ scope: 'army', ...(period || {}) })
  const year = period?.year || CAMPAIGN_YEAR
  const month = period?.month || CURRENT_MONTH
  const all = loadArmyDedications()
  const key = `${year}|${month}`
  if (Object.prototype.hasOwnProperty.call(all, key)) return all[key]
  if (String(year) === String(CAMPAIGN_YEAR) && month === CURRENT_MONTH) return ARMY_DEDICATION
  return null
}
export async function setArmyDedication(text, period) {
  if (!IS_DEMO) return mashpia.setDedication({ scope: 'army', text, ...(period || {}) })
  const year = period?.year || CAMPAIGN_YEAR
  const month = period?.month || CURRENT_MONTH
  const all = loadArmyDedications()
  const value = String(text || '').trim() ? { month, year, text: String(text).trim() } : null
  all[`${year}|${month}`] = value
  try { localStorage.setItem(ARMY_DEDICATION_KEY, JSON.stringify(all)) } catch { /* ignore */ }
  invalidate()
  return value
}
export async function getHqVerify(period) {
  if (!IS_DEMO) return mashpia.getHqVerify(period)
  const home = await getGlobalStats(period)
  const rows = await getSchools(period)
  return {
    month: home.monthLabel,
    year: home.year,
    home,
    schools: rows,
    missingLogos: rows.filter((s) => !s.logo).map((s) => s.name),
    notes: [
      'Soldiers are enrolled chayolim.',
      'Participated means any kapitlach greater than zero were reported.',
      'Completed kapitlach quota means the soldier met their own quota.',
      'The same percentage ranks the school with more kapitlach said first.',
    ],
  }
}

// School admins: add / edit / remove this school's monthly dedication.
export async function setSchoolDedication(schoolId, text) {
  if (!IS_DEMO) return mashpia.setDedication({ scope: 'school', schoolId, text })
  const t = String(text || '').trim()
  setSchoolDedicationStore(schoolId, t ? { month: CURRENT_MONTH, text: t } : null)
  invalidate()
  return schoolDedication(schoolId)
}
export async function setSchoolYearStart(schoolId, firstMonth) {
  if (!IS_DEMO) return mashpia.setSchoolYearStart({ schoolId, firstMonth })
  setSchoolYearStartStore(schoolId, firstMonth)
  invalidate()
  return { ok: true, schoolId, firstMonth: schoolYearStart(schoolId), gradeEnds: null }
}

export async function setSchoolLadders(schoolId, hidden) {
  if (!IS_DEMO) return mashpia.setSchoolLadders({ schoolId, hidden })
  setSchoolHiddenLaddersStore(schoolId, hidden)
  invalidate()
  const hiddenLadders = schoolHiddenLadders(schoolId)
  return { ok: true, schoolId, hiddenLadders }
}

export function removeSchoolDedication(schoolId) {
  setSchoolDedicationStore(schoolId, null)
  invalidate()
  return null
}

function demoStaffCanOverride(schoolId) {
  return overrideAccessStatus(readDemoStaff(), schoolId) === 200
}

function writeDemoAudit(action, kid, year, month, detail) {
  const staff = readDemoStaff()
  pushAudit({
    action,
    actorId: staff?.username || staff?.name || 'staff',
    actorName: staff?.name || 'Staff',
    userId: kid.id,
    year,
    month,
    detail,
    createdAt: new Date().toISOString(),
  })
}

// Set this month's quota to the kapitlach the soldier entered. Next month and
// the ladder are untouched. A commander of another school is refused.
export async function overrideQuota({ kidId, year, month, reason }) {
  if (!IS_DEMO) return mashpia.overrideQuota({ kidId, year, month, reason })
  const found = locate(kidId)
  if (!found) {
    const error = new Error('Soldier not found.')
    error.status = 404
    throw error
  }
  const y = year || CAMPAIGN_YEAR
  const mo = month || CURRENT_MONTH
  if (!demoStaffCanOverride(found.school.id)) {
    const error = new Error('You can only override soldiers in your own school.')
    error.status = 403
    throw error
  }
  const snap = kapSnapshot(found.kid, mo, y)
  if (snap.quotaAdjusted) {
    const error = new Error('That month already has an override. Undo it first.')
    error.status = 409
    throw error
  }
  if (!snap.reported || snap.said <= 0 || snap.quota <= 0 || snap.said >= snap.quota) {
    const error = new Error('This soldier is not under quota for that month.')
    error.status = 422
    throw error
  }
  const staff = readDemoStaff()
  const when = new Date().toISOString()
  const rows = loadOverrides()
  rows.push({
    userId: found.kid.id,
    year: y,
    month: mo,
    originalQuota: snap.quota,
    overriddenQuota: snap.said,
    reason: String(reason || '').trim() || null,
    createdBy: staff?.username || null,
    createdByName: staff?.name || null,
    createdAt: when,
    undoneAt: null,
  })
  saveOverrides(rows)
  writeDemoAudit('quota_override', found.kid, y, mo, `Quota ${snap.quota} overridden to ${snap.said} for ${mo} ${y}`)
  invalidate()
  return { ok: true, userId: found.kid.id, year: y, month: mo, originalQuota: snap.quota, quota: snap.said, met: true, quotaAdjusted: true }
}

export async function undoQuotaOverride({ kidId, year, month }) {
  if (!IS_DEMO) return mashpia.undoQuotaOverride({ kidId, year, month })
  const found = locate(kidId)
  if (!found) {
    const error = new Error('Soldier not found.')
    error.status = 404
    throw error
  }
  const y = year || CAMPAIGN_YEAR
  const mo = month || CURRENT_MONTH
  if (!demoStaffCanOverride(found.school.id)) {
    const error = new Error('You can only override soldiers in your own school.')
    error.status = 403
    throw error
  }
  const rows = loadOverrides()
  const hit = rows.find((row) => String(row.userId) === String(kidId) && String(row.year) === String(y) && row.month === mo && !row.undoneAt)
  if (!hit) {
    const error = new Error('That month does not have an override.')
    error.status = 404
    throw error
  }
  hit.undoneAt = new Date().toISOString()
  hit.undoneBy = readDemoStaff()?.username || null
  saveOverrides(rows)
  writeDemoAudit('quota_override_undo', found.kid, y, mo, `Override removed for ${mo} ${y}`)
  invalidate()
  return { ok: true, userId: found.kid.id, year: y, month: mo, quotaAdjusted: false }
}

// Soldiers in this school, for the custom-ladder picker. Names stay admin-only.
export async function listCustomLadderSoldiers(schoolId) {
  if (!IS_DEMO) return mashpia.listCustomLadderSoldiers(schoolId)
  if (!demoStaffCanOverride(schoolId)) {
    const error = new Error('You can only set a custom ladder for soldiers in your own school.')
    error.status = 403
    throw error
  }
  const school = ROSTER.find((s) => String(s.id) === String(schoolId))
  if (!school) return { schoolId, month: CURRENT_MONTH, year: Number(CAMPAIGN_YEAR), soldiers: [] }
  const soldiers = []
  for (const cls of school.classes) {
    for (const kid of cls.kids) {
      const cell = ladderCell(kid, CURRENT_MONTH)
      const custom = activeCustomLadder(kid.id)
      soldiers.push({
        id: kid.id,
        name: kid.name,
        classId: cls.id,
        className: cls.name,
        grade: kid.grade,
        ladder: kid.ladder,
        month: CURRENT_MONTH,
        currentKapitlach: cell?.v ?? 0,
        currentMinutes: cell?.m ?? 0,
        customLadder: custom?.grid ?? null,
      })
    }
  }
  return { schoolId, month: CURRENT_MONTH, year: Number(CAMPAIGN_YEAR), soldiers }
}

export async function setCustomLadder({ kidId, targetKapitlach, finishGrade, reason }) {
  if (!IS_DEMO) return mashpia.setCustomLadder({ kidId, targetKapitlach, finishGrade, reason })
  const found = locate(kidId)
  if (!found) {
    const error = new Error('Soldier not found.')
    error.status = 404
    throw error
  }
  if (!demoStaffCanOverride(found.school.id)) {
    const error = new Error('You can only set a custom ladder for soldiers in your own school.')
    error.status = 403
    throw error
  }
  const cell = ladderCell(found.kid, CURRENT_MONTH)
  let grid
  try {
    grid = generateCustomLadder({
      targetKapitlach,
      finishGrade,
      anchor: {
        grade: found.kid.grade,
        month: CURRENT_MONTH,
        kapitlach: cell?.v ?? 0,
        minutes: cell?.m ?? 0,
      },
    })
  } catch (e) {
    e.status = 422
    throw e
  }
  const when = new Date().toISOString()
  const staff = readDemoStaff()
  const rows = loadCustomLadders()
  for (const row of rows) {
    if (String(row.userId) === String(kidId) && !row.removedAt) {
      row.removedAt = when
      row.removedBy = staff?.username || null
    }
  }
  const note = String(reason || '').trim() || null
  rows.push({
    userId: found.kid.id,
    grid,
    reason: note,
    createdBy: staff?.username || null,
    createdAt: when,
    removedAt: null,
  })
  saveCustomLadders(rows)
  writeDemoAudit(
    'custom_ladder_set',
    found.kid,
    CAMPAIGN_YEAR,
    CURRENT_MONTH,
    `Custom ladder: finish ${grid.targetKapitlach} kapitlach by ${grid.finishLabel}`,
  )
  invalidate()
  return { ok: true, userId: found.kid.id, customLadder: grid }
}

export async function removeCustomLadder({ kidId }) {
  if (!IS_DEMO) return mashpia.removeCustomLadder({ kidId })
  const found = locate(kidId)
  if (!found) {
    const error = new Error('Soldier not found.')
    error.status = 404
    throw error
  }
  if (!demoStaffCanOverride(found.school.id)) {
    const error = new Error('You can only set a custom ladder for soldiers in your own school.')
    error.status = 403
    throw error
  }
  const rows = loadCustomLadders()
  const hit = rows.find((row) => String(row.userId) === String(kidId) && !row.removedAt)
  if (!hit) {
    const error = new Error('That soldier does not have a custom ladder.')
    error.status = 404
    throw error
  }
  const when = new Date().toISOString()
  hit.removedAt = when
  hit.removedBy = readDemoStaff()?.username || null
  saveCustomLadders(rows)
  writeDemoAudit('custom_ladder_remove', found.kid, CAMPAIGN_YEAR, CURRENT_MONTH, 'Custom ladder removed')
  invalidate()
  return { ok: true, userId: found.kid.id, customLadder: null }
}

// Who hasn't finished this month, per class. `missing` is every incomplete
// name (older clients). `under` reported something and are short. `notFilled`
// reported nothing. Same split as wwtcNotifyKidStatus.
export async function notCompleted(schoolId, monthIdx = CURRENT_MONTH_INDEX) {
  if (!IS_DEMO) return mashpia.getNotCompleted(schoolId)
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return []
  const month = monthName(monthIdx)
  const first = schoolYearStart(school.id)
  const rows = school.classes
    .map((cls) => {
      const kids = cls.kids.map((k) => {
        const snap = kapSnapshot(k, month, CAMPAIGN_YEAR, first)
        return { name: k.name, said: snap.said, quota: snap.quota }
      })
      return {
        classId: cls.id,
        className: formatClassName(cls.name),
        grade: cls.grade,
        size: cls.kids.length,
        ...splitIncompleteNames(kids),
      }
    })
    .filter((c) => c.missing.length > 0)
  return sortClasses(rows)
}

// First demo soldier's working credentials, for the login-screen hint.
export function demoKidCredentials() {
  const cls = ROSTER[0].classes[0]
  const kid = cls.kids[0]
  return { serial: kid.serial, dob: kid.dob }
}
