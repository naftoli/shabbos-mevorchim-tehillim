// Data facade. Every page/component reads campaign numbers through this module,
// so the demo→live switch happens in one place. Today it computes everything
// from the anonymized demo roster; when the PHP/Mashpia API lands, each function
// branches `if (!IS_DEMO) return mashpia.<same fn>()` — the Lulav pattern.

import { quotaFor, availableLadders } from '@/data/ladders.js'
import { medalState } from '@/lib/medals.js'
import {
  ROSTER,
  CURRENT_MONTH,
  CURRENT_MONTH_INDEX,
  ELAPSED_MONTHS,
  CAMPAIGN_YEAR,
  PRIOR_YEARS_KAPITLACH,
  DEMO_ADMINS,
  DEMO_ADMIN_PASSWORD,
  ARMY_DEDICATION,
  schoolDedication,
} from '@/data/demo.js'

export { CURRENT_MONTH, CURRENT_MONTH_INDEX, ELAPSED_MONTHS, CAMPAIGN_YEAR }

const kidMonthQuota = (kid, month) => quotaFor(kid.grade, month, kid.ladder)?.v ?? 0
const kidMonthSaid = (kid, month) => kid.reports[month] ?? 0
const kidMonthMinutes = (kid, month) => kid.minutesByMonth?.[month] ?? 0
const metQuota = (kid, month) => {
  const q = kidMonthQuota(kid, month)
  return q > 0 && kidMonthSaid(kid, month) >= q
}
const kidSaidYear = (kid) => ELAPSED_MONTHS.reduce((a, mo) => a + kidMonthSaid(kid, mo), 0)

// ---- school aggregates -----------------------------------------------------

function schoolAgg(school) {
  let kids = 0
  let saidMonth = 0
  let quotaMonth = 0
  let saidYear = 0
  let minutesSaidMonth = 0
  let minutesQuotaMonth = 0
  let metMonth = 0
  for (const cls of school.classes) {
    for (const kid of cls.kids) {
      kids += 1
      saidMonth += kidMonthSaid(kid, CURRENT_MONTH)
      quotaMonth += kidMonthQuota(kid, CURRENT_MONTH)
      minutesSaidMonth += kidMonthMinutes(kid, CURRENT_MONTH)
      minutesQuotaMonth += quotaFor(kid.grade, CURRENT_MONTH, kid.ladder)?.m ?? 0
      if (metQuota(kid, CURRENT_MONTH)) metMonth += 1
      saidYear += kidSaidYear(kid)
    }
  }
  const pct = quotaMonth > 0 ? Math.min(Math.round((saidMonth / quotaMonth) * 100), 100) : 0
  const pctMet = kids > 0 ? Math.round((metMonth / kids) * 100) : 0
  return {
    id: school.id,
    name: school.name,
    city: school.city,
    color: school.color,
    kids,
    saidMonth,
    quotaMonth,
    saidYear,
    minutesSaidMonth,
    minutesQuotaMonth,
    metMonth,
    pct,
    pctMet,
  }
}

let _schools = null
const schools = () => (_schools ??= ROSTER.map(schoolAgg))
const invalidate = () => { _schools = null }

// ---- global ----------------------------------------------------------------

export function getGlobalStats() {
  const s = schools()
  const acc = s.reduce((a, x) => a + x.saidMonth, 0)
  const quota = s.reduce((a, x) => a + x.quotaMonth, 0)
  const soldiers = s.reduce((a, x) => a + x.kids, 0)
  const minutes = s.reduce((a, x) => a + x.minutesSaidMonth, 0)
  const minutesQuota = s.reduce((a, x) => a + x.minutesQuotaMonth, 0)
  const classes = ROSTER.reduce((a, x) => a + x.classes.length, 0)
  return {
    monthLabel: CURRENT_MONTH,
    year: CAMPAIGN_YEAR,
    accomplished: acc,
    quota,
    pct: quota > 0 ? Math.min(Math.round((acc / quota) * 100), 100) : 0,
    minutes,
    minutesQuota,
    minutesPct: minutesQuota > 0 ? Math.min(Math.round((minutes / minutesQuota) * 100), 100) : 0,
    soldiers,
    schools: s.length,
    classes,
    perfectPlatoons: getPerfectPlatoons().length,
  }
}

export function getRunningTotals() {
  const s = schools()
  const thisMonth = s.reduce((a, x) => a + x.saidMonth, 0)
  const thisYear = s.reduce((a, x) => a + x.saidYear, 0)
  return { thisMonth, thisYear, allTime: thisYear + PRIOR_YEARS_KAPITLACH }
}

export function getSchools() {
  return schools().slice().sort((a, b) => b.saidMonth - a.saidMonth)
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
export function getPerfectPlatoons() {
  const out = []
  for (const school of ROSTER) {
    for (const cls of school.classes) {
      if (cls.kids.length > 0 && cls.kids.every((k) => metQuota(k, CURRENT_MONTH))) {
        out.push({ schoolId: school.id, school: school.name, className: cls.name, grade: cls.grade, size: cls.kids.length })
      }
    }
  }
  return out
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
    schoolId: school.id,
    schoolName: school.name,
    className: cls.name,
  }
}

export function verifyKid(serial, dob) {
  for (const school of ROSTER) {
    for (const cls of school.classes) {
      const kid = cls.kids.find((k) => k.serial === String(serial).trim() && k.dob === dob)
      if (kid) {
        // The demo "new kid" starts fresh on every sign-in, so the first-login
        // ladder flow can always be shown. (Real kids keep their chosen ladder.)
        if (kid.isDemoNew) {
          kid.ladder = null
          kid.reports = {}
          kid.minutes = 0
          kid.metThisYear = 0
          kid.missionsTotal = 0
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

export function verifyAdmin(username, password) {
  if (password !== DEMO_ADMIN_PASSWORD) return null
  const a = DEMO_ADMINS.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase())
  return a ? { kind: a.kind, name: a.name, schoolId: a.schoolId, username: a.username } : null
}

// ---- soldier progress + medals --------------------------------------------

export function getKidProgress(id) {
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
  return {
    ...safeKid(kid, found.school, found.cls),
    months,
    priorMissions: kid.priorMissions,
    metThisYear: kid.metThisYear,
    missionsTotal: kid.missionsTotal,
    medal: medalState(kid.missionsTotal),
    current: months.find((m) => m.isCurrent) ?? null,
  }
}

// Record a month's completion (demo: mutate in memory). Returns fresh progress.
export function recordMonth(id, month, kapitlach, minutes) {
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
  invalidate()
  return getKidProgress(id)
}

// Switch a soldier's ladder (demo: mutate in memory). Whether past months count
// as missions is re-derived against the new ladder's quotas. Returns fresh progress.
export function setKidLadder(id, ladder) {
  const found = locate(id)
  if (!found) return null
  const { kid } = found
  if (!availableLadders(kid.grade).includes(Number(ladder))) return null
  kid.ladder = Number(ladder)
  let met = 0
  for (const mo of ELAPSED_MONTHS) if (metQuota(kid, mo)) met += 1
  kid.metThisYear = met
  kid.missionsTotal = kid.priorMissions + met
  invalidate()
  return getKidProgress(id)
}

// Social context for a soldier: where their class stands in the school, where
// the school stands worldwide, and the nudge to climb a rank. Drives the
// "your class needs you" line on the dashboard.
export function getKidSocial(id) {
  const found = locate(id)
  if (!found) return null
  const { kid, school, cls } = found

  // This soldier's own rank within their class (missions, then kapitlach/year).
  const classKids = cls.kids
    .slice()
    .sort((a, b) => b.missionsTotal - a.missionsTotal || kidSaidYear(b) - kidSaidYear(a))
  const myRankInClass = classKids.findIndex((k) => k.id === kid.id) + 1

  // Class standings within this school, by % of soldiers who completed.
  const standings = school.classes
    .map((c) => {
      const size = c.kids.length
      const met = c.kids.reduce((a, k) => a + (metQuota(k, CURRENT_MONTH) ? 1 : 0), 0)
      return { id: c.id, name: c.name, size, met, pctMet: size ? (met / size) * 100 : 0 }
    })
    .sort((a, b) => b.pctMet - a.pctMet || b.met - a.met)

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

  // School standing worldwide, by kapitlach this month.
  const schoolRanked = schools().slice().sort((a, b) => b.saidMonth - a.saidMonth)
  const schoolRank = schoolRanked.findIndex((s) => s.id === school.id)

  return {
    className: cls.name,
    classRank: rank + 1,
    totalClasses: standings.length,
    classAheadName: ahead?.name ?? null,
    needToPass,
    myRankInClass,
    classSize: cls.kids.length,
    schoolName: school.name,
    schoolRank: schoolRank + 1,
    totalSchools: schoolRanked.length,
  }
}

// ---- one school (campaign page) -------------------------------------------

export function getSchool(id) {
  const school = ROSTER.find((s) => s.id === id)
  if (!school) return null
  const agg = schoolAgg(school)
  const classes = school.classes.map((cls) => {
    let said = 0
    let quota = 0
    let met = 0
    for (const kid of cls.kids) {
      said += kidMonthSaid(kid, CURRENT_MONTH)
      quota += kidMonthQuota(kid, CURRENT_MONTH)
      if (metQuota(kid, CURRENT_MONTH)) met += 1
    }
    return {
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      size: cls.kids.length,
      said,
      quota,
      pct: quota > 0 ? Math.min(Math.round((said / quota) * 100), 100) : 0,
      met,
      perfect: cls.kids.length > 0 && met === cls.kids.length,
    }
  })
  return { ...agg, classes, dedication: schoolDedication(id) }
}

export function schoolSoldierLeaderboard(id, n = 10) {
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
        saidYear: kidSaidYear(kid),
        missions: kid.missionsTotal,
        ladder: kid.ladder,
      })
    }
  }
  return kids.sort((a, b) => b.saidYear - a.saidYear || b.missions - a.missions).slice(0, n)
}

export function schoolClassLeaderboard(id) {
  const school = getSchool(id)
  if (!school) return []
  return school.classes.slice().sort((a, b) => b.pct - a.pct || b.said - a.said)
}

// ---- reports ---------------------------------------------------------------

const monthName = (idx) => ELAPSED_MONTHS[idx] ?? CURRENT_MONTH

// Army report: one row per school for a month.
export function getArmyReport(monthIdx = CURRENT_MONTH_INDEX) {
  const month = monthName(monthIdx)
  return {
    month,
    rows: ROSTER.map((school) => {
      let registered = 0
      let goal = 0
      let accomplished = 0
      let participated = 0
      let met = 0
      for (const cls of school.classes) {
        for (const kid of cls.kids) {
          registered += 1
          goal += quotaFor(kid.grade, month, kid.ladder)?.v ?? 0
          const said = kid.reports[month] ?? 0
          accomplished += said
          if (said > 0) participated += 1
          if (metQuota(kid, month)) met += 1
        }
      }
      return {
        id: school.id,
        name: school.name,
        registered,
        goal,
        accomplished,
        pctParticipated: registered ? Math.round((participated / registered) * 100) : 0,
        pctMet: registered ? Math.round((met / registered) * 100) : 0,
      }
    }),
  }
}

// Base report: one row per class in a school.
export function getBaseReport(schoolId, monthIdx = CURRENT_MONTH_INDEX) {
  const school = ROSTER.find((s) => s.id === schoolId)
  if (!school) return null
  const month = monthName(monthIdx)
  return {
    month,
    school: school.name,
    schoolId,
    rows: school.classes.map((cls) => {
      let goal = 0
      let accomplished = 0
      let completed = 0
      for (const kid of cls.kids) {
        goal += quotaFor(kid.grade, month, kid.ladder)?.v ?? 0
        accomplished += kid.reports[month] ?? 0
        if (metQuota(kid, month)) completed += 1
      }
      return { id: cls.id, name: cls.name, grade: cls.grade, size: cls.kids.length, goal, accomplished, completed, perfect: completed === cls.kids.length }
    }),
  }
}

// Platoon report: one row per child in a class.
export function getPlatoonReport(classId, monthIdx = CURRENT_MONTH_INDEX) {
  const month = monthName(monthIdx)
  for (const school of ROSTER) {
    const cls = school.classes.find((c) => c.id === classId)
    if (!cls) continue
    let completed = 0
    const rows = cls.kids.map((kid) => {
      const q = quotaFor(kid.grade, month, kid.ladder)
      const said = kid.reports[month] ?? 0
      const met = metQuota(kid, month)
      if (met) completed += 1
      return { id: kid.id, name: kid.name, ladder: kid.ladder, goal: q?.v ?? 0, goalLabel: q?.k ?? '—', said, met }
    })
    return { month, school: school.name, className: cls.name, completed, size: cls.kids.length, rows }
  }
  return null
}

export function getArmyDedication() { return ARMY_DEDICATION }

// Who hasn't completed this month, per class — drives the teacher deadline email.
export function notCompleted(schoolId, monthIdx = CURRENT_MONTH_INDEX) {
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
