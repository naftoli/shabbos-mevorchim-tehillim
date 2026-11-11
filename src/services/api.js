// Data facade. Every page/component reads campaign numbers through this module,
// so the demo→live switch happens in one place. Today it computes everything
// from the anonymized demo roster; when the PHP/Mashpia API lands, each function
// branches `if (!IS_DEMO) return mashpia.<same fn>()` — the Lulav pattern.

import { quotaFor, availableLadders } from '@/data/ladders.js'
import { canSeeClassRoll, rankForMedals } from '@/lib/decisions.js'
import { cmpSchoolRace } from '@/lib/schoolRace.js'
import { placeAmong } from '@/lib/placeRank.js'
import { compareSoldiers } from '@/lib/soldierBoard.js'
import { medalState } from '@/lib/medals.js'
import { IS_DEMO } from '@/lib/liveMode.js'
import * as mashpia from './mashpia.js'
import { MONTHS } from '@/data/ladders.js'
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
  saveKidProgress,
  clearKidProgress,
} from '@/data/demo.js'
import { demoPublicPlatoonGraphics } from '@/lib/platoonGraphicsDemo.js'

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
  return kid.reports?.[month] ?? 0
}
function minutesOf(kid, month, year) {
  if (year && String(year) !== String(CAMPAIGN_YEAR)) return kid.priorYearMinutes?.[month] ?? 0
  return kid.minutesByMonth?.[month] ?? 0
}
function reportedOf(kid, month, year) {
  if (year && String(year) !== String(CAMPAIGN_YEAR)) return kid.priorYearReports?.[month] != null
  return Object.prototype.hasOwnProperty.call(kid.reports || {}, month)
}

export { CURRENT_MONTH, CURRENT_MONTH_INDEX, ELAPSED_MONTHS, CAMPAIGN_YEAR }

const kidMonthQuota = (kid, month) => quotaFor(kid.grade, month, kid.ladder)?.v ?? 0
const kidMonthSaid = (kid, month) => kid.reports[month] ?? 0
const kidMonthMinutes = (kid, month) => kid.minutesByMonth?.[month] ?? 0
const metQuota = (kid, month) => {
  const q = kidMonthQuota(kid, month)
  return q > 0 && kidMonthSaid(kid, month) >= q
}
const metAt = (kid, month, year) => {
  const q = kidMonthQuota(kid, month)
  return q > 0 && saidOf(kid, month, year) >= q
}
const kidSaidYear = (kid) => ELAPSED_MONTHS.reduce((a, mo) => a + kidMonthSaid(kid, mo), 0)

// ---- school aggregates -----------------------------------------------------

function schoolAgg(school, month = CURRENT_MONTH, year = CAMPAIGN_YEAR) {
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
      quotaMonth += kidMonthQuota(kid, month)
      minutesSaidMonth += minutesOf(kid, month, year)
      minutesQuotaMonth += quotaFor(kid.grade, month, kid.ladder)?.m ?? 0
      if (metAt(kid, month, year)) metMonth += 1
      if (reportedOf(kid, month, year) && said > 0) participatedMonth += 1
      saidYear += kidSaidYear(kid)
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
  if (!IS_DEMO) return mashpia.getPerfectPlatoons(period)
  return demoPerfectPlatoons(demoDataMonth(period?.month || CURRENT_MONTH), period?.year || CAMPAIGN_YEAR)
}

export async function getPublicPlatoonGraphics(period) {
  if (!IS_DEMO) return mashpia.getPublicPlatoonGraphics(period)
  return demoPublicPlatoonGraphics(period)
}

function demoPerfectPlatoons(month = CURRENT_MONTH, year = CAMPAIGN_YEAR) {
  const out = []
  for (const school of ROSTER) {
    let said = 0
    for (const cls of school.classes) {
      for (const kid of cls.kids) said += saidOf(kid, month, year)
    }
    for (const cls of school.classes) {
      if (cls.kids.length > 0 && cls.kids.every((k) => metAt(k, month, year))) {
        out.push({
          schoolId: school.id,
          school: school.name,
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
    months: y === Number(CAMPAIGN_YEAR) ? ELAPSED_MONTHS : MONTHS,
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

function demoKidProgress(id) {
  const found = locate(id)
  if (!found) return null
  const { kid } = found
  const months = ELAPSED_MONTHS.map((mo) => {
    const q = quotaFor(kid.grade, mo, kid.ladder)
    return {
      month: mo,
      quota: q?.v ?? 0,
      quotaLabel: q?.k ?? '—',
      said: kidMonthSaid(kid, mo),
      minutes: q?.m ?? 0, // the quota's target minutes
      saidMinutes: kidMonthMinutes(kid, mo), // minutes the soldier reported
      met: metQuota(kid, mo),
      isCurrent: mo === CURRENT_MONTH,
    }
  })
  const historyMonths = MONTHS.map((mo) => {
    const q = quotaFor(kid.grade, mo, kid.ladder)
    const said = kid.priorYearReports?.[mo]
    const reported = said != null
    return {
      month: mo,
      year: PRIOR_CAMPAIGN_YEAR,
      quota: q?.v ?? 0,
      quotaLabel: q?.k ?? null,
      minutes: q?.m ?? 0,
      said: reported ? said : 0,
      saidMinutes: kid.priorYearMinutes?.[mo] ?? 0,
      met: reported && !!q && said >= q.v,
      reported,
      isCurrent: false,
    }
  })
  // The demo roster only holds one prior year, so stand in a mission history for
  // it under the prior grade — enough for the training board to draw real checks
  // locally. Live builds the full multi-year history from DB marks (index.php).
  const GRADE_SEQ = ['pre1a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  const gi = GRADE_SEQ.indexOf(String(kid.grade))
  const priorGrade = gi > 0 ? GRADE_SEQ[gi - 1] : null
  const missionHistory = priorGrade
    ? { [priorGrade]: Object.fromEntries(historyMonths.filter((m) => m.met).map((m) => [m.month, Number(kid.ladder) || true])) }
    : {}
  const medal = medalState(kid.missionsTotal)
  return {
    ...safeKid(kid, found.school, found.cls),
    months: months.map((m) => ({ ...m, reported: Object.prototype.hasOwnProperty.call(kid.reports || {}, m.month) })),
    historyMonths,
    priorMissions: kid.priorMissions,
    metThisYear: kid.metThisYear,
    missionsTotal: kid.missionsTotal,
    missionHistory,
    medal,
    rank: rankForMedals(medal.earnedCount),
    current: months.find((m) => m.isCurrent) ?? null,
  }
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
  const { kid } = found
  const prevMet = metQuota(kid, month)
  kid.reports[month] = Number(kapitlach) || 0
  const nowMet = metQuota(kid, month)
  if (nowMet && !prevMet) { kid.metThisYear += 1; kid.missionsTotal += 1 }
  if (!nowMet && prevMet) { kid.metThisYear -= 1; kid.missionsTotal -= 1 }
  // Per-month reported minutes (replace, not accumulate); keep the total in sync.
  kid.minutesByMonth = kid.minutesByMonth || {}
  kid.minutesByMonth[month] = Number(minutes) || 0
  kid.minutes = Object.values(kid.minutesByMonth).reduce((a, m) => a + m, 0)
  saveKidProgress(kid)
  invalidate()
  const progress = demoKidProgress(id)
  if (extra?.exceptionalConfirmed) progress.exceptional = { emailed: false, reason: 'demo' }
  return progress
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
  if (!availableLadders(kid.grade).includes(next)) return null
  // The dashboard re-applies the session ladder on every read. Skip the
  // notify when nothing changed, or that read refreshes itself forever.
  if (kid.ladder === next) return demoKidProgress(id)
  kid.ladder = next
  let met = 0
  for (const mo of ELAPSED_MONTHS) if (metQuota(kid, mo)) met += 1
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
  if (next < 5 || next > 12) return { ok: false, matched: 0, updated: 0 }
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return { ok: false, matched: 0, updated: 0 }
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
    for (const mo of ELAPSED_MONTHS) if (metQuota(kid, mo)) met += 1
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
    classPerfect: mine?.size > 0 && mine.met === mine.size,
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
      quota += kidMonthQuota(kid, CURRENT_MONTH)
      minsSaid += kidMonthMinutes(kid, CURRENT_MONTH)
      minsQuota += quotaFor(kid.grade, CURRENT_MONTH, kid.ladder)?.m ?? 0
      if (metQuota(kid, CURRENT_MONTH)) met += 1
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
      perfect: size > 0 && met === size,
    }
  })
  return { ...agg, classes, dedication: schoolDedication(id) }
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
        missions: kid.missionsTotal,
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
          const q = quotaFor(kid.grade, dataMonth, kid.ladder)
          goal += q?.v ?? 0
          minutesGoal += q?.m ?? 0
          const said = saidOf(kid, dataMonth, year)
          accomplished += said
          minutes += minutesOf(kid, dataMonth, year)
          if (reportedOf(kid, dataMonth, year) && said > 0) participated += 1
          if (metAt(kid, dataMonth, year)) met += 1
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
export async function getBaseReport(schoolId, monthIdx = CURRENT_MONTH_INDEX, period = null) {
  if (!IS_DEMO) return mashpia.getBaseReport(schoolId, monthIdx, period)
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return null
  const month = period?.month || monthName(monthIdx)
  const year = period?.year || CAMPAIGN_YEAR
  const dataMonth = demoDataMonth(month)
  return {
    month,
    school: school.name,
    schoolId,
    rows: school.classes.map((cls) => {
      let goal = 0
      let accomplished = 0
      let completed = 0
      for (const kid of cls.kids) {
        goal += quotaFor(kid.grade, dataMonth, kid.ladder)?.v ?? 0
        accomplished += saidOf(kid, dataMonth, year)
        if (metAt(kid, dataMonth, year)) completed += 1
      }
      return { id: cls.id, name: cls.name, grade: cls.grade, size: cls.kids.length, goal, accomplished, completed, perfect: completed === cls.kids.length }
    }),
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
    let completed = 0
    for (const kid of cls.kids) {
      if (metAt(kid, dataMonth, year)) completed += 1
    }
    const summary = {
      month,
      school: school.name,
      className: cls.name,
      completed,
      size: cls.kids.length,
      perfect: cls.kids.length > 0 && completed === cls.kids.length,
      roll: false,
    }
    if (!canSeeClassRoll(readDemoStaff(), { classId: cls.id, schoolId: school.id })) return summary
    const rows = cls.kids.map((kid) => {
      const q = quotaFor(kid.grade, dataMonth, kid.ladder)
      const said = saidOf(kid, dataMonth, year)
      const met = metAt(kid, dataMonth, year)
      return { id: kid.id, name: kid.name, ladder: kid.ladder, goal: q?.v ?? 0, goalLabel: q?.k ?? '—', said, met }
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
export function removeSchoolDedication(schoolId) {
  setSchoolDedicationStore(schoolId, null)
  invalidate()
  return null
}

// Who hasn't completed this month, per class — drives the teacher deadline email.
export async function notCompleted(schoolId, monthIdx = CURRENT_MONTH_INDEX) {
  if (!IS_DEMO) return mashpia.getNotCompleted(schoolId)
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return []
  const month = monthName(monthIdx)
  return school.classes
    .map((cls) => ({
      classId: cls.id,
      className: cls.name,
      size: cls.kids.length,
      missing: cls.kids.filter((k) => !metQuota(k, month)).map((k) => k.name),
    }))
    .filter((c) => c.missing.length > 0)
}

// First demo soldier's working credentials, for the login-screen hint.
export function demoKidCredentials() {
  const cls = ROSTER[0].classes[0]
  const kid = cls.kids[0]
  return { serial: kid.serial, dob: kid.dob }
}
