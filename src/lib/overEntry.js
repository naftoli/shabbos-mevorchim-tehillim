import config from '../../api/over-entry.json' with { type: 'json' }

// Same file the API reads (api/over-entry.json). HQ changes the numbers there.
// The confirm sentence is `confirm` in that file — the one line the page and
// the API both show. Edit it there.
export const OVER_ENTRY_CONFIG = config
export const OVER_ENTRY_CONFIRM = config.confirm
export const OVER_ENTRY_YES = config.yes
export const OVER_ENTRY_NO = config.no

export function normalizeGrade(grade) {
  const g = String(grade ?? '').toLowerCase().replace(/[\s_-]/g, '')
  if (!g) return ''
  if (g.startsWith('pre')) return 'pre1a'
  const match = /^(\d{1,2})/.exec(g)
  if (match) {
    const n = Number(match[1])
    if (n >= 1 && n <= 12) return String(n)
  }
  return ''
}

export function overEntryLine({ grade, quotaKap = 0, quotaMin = 0 } = {}) {
  const key = normalizeGrade(grade)
  const row = config.grades[key] || config.grades.pre1a
  const multiple = Number(config.kapitlachMultiple) || 2
  const ladderTop = Number(row?.ladderTopKapitlach) || 46
  const quota = Number(quotaKap) || 0
  return {
    grade: config.grades[key] ? key : 'pre1a',
    kapitlach: Math.max(multiple * quota, ladderTop),
    minutes: Number(row?.minutes) || 170,
    ladderTopKapitlach: ladderTop,
    quotaKapitlach: quota,
    quotaMinutes: Number(quotaMin) || 0,
  }
}

export function overEntryReasons(kapitlach, minutes, line) {
  const reasons = []
  if ((Number(kapitlach) || 0) > line.kapitlach) reasons.push('kapitlach')
  if ((Number(minutes) || 0) > line.minutes) reasons.push('minutes')
  return reasons
}

/** Ordinary and accepted marks count. Flagged counts only if the config says so. */
export function countsInPublicTotals(status) {
  if (status == null || status === '' || status === 'accepted') return true
  if (status === 'removed') return false
  if (status === 'flagged') return config.flaggedCountsBeforeReview === true
  return false
}

export function planReport({ kapitlach, minutes, quotaKap, quotaMin, grade, flagConfirmed = false }) {
  const kap = Math.max(0, Math.min(150, Math.round(Number(kapitlach) || 0)))
  const min = Math.max(0, Math.min(770, Math.round(Number(minutes) || 0)))
  const line = overEntryLine({ grade, quotaKap, quotaMin })
  const reasons = overEntryReasons(kap, min, line)
  if (reasons.length === 0) {
    return { action: 'save', reasons, line, kapitlach: kap, minutes: min, writeMark: true, counts: true }
  }
  if (!flagConfirmed) {
    return { action: 'confirm', reasons, line, kapitlach: kap, minutes: min, writeMark: false, counts: false }
  }
  const counts = countsInPublicTotals('flagged')
  return { action: 'flag', reasons, line, kapitlach: kap, minutes: min, writeMark: counts, counts }
}

function decision(action, actor, at, note) {
  return {
    action,
    actorType: actor?.type || 'kid',
    actorId: actor?.id ?? 0,
    actorName: actor?.name || '',
    at,
    note: note || null,
  }
}

/**
 * Apply one self-report to a soldier record. A flagged report is stored on
 * soldier.flag and does not replace reports[month], so totals keep the prior
 * value (or stay not-counted).
 */
export function applySoldierReport(soldier, input) {
  const month = input.month
  const plan = planReport(input)
  if (plan.action === 'confirm') return { error: 'over_entry', plan, soldier }

  const at = input.at || new Date().toISOString()
  if (plan.action === 'flag') {
    const open = soldier.flag && soldier.flag.status === 'flagged' && soldier.flag.month === month
    const priorReported = open
      ? !!soldier.flag.priorReported
      : Object.prototype.hasOwnProperty.call(soldier.reports || {}, month)
    const priorKapitlach = open ? Number(soldier.flag.priorKapitlach) || 0 : (Number(soldier.reports?.[month]) || 0)
    const priorMinutes = open ? Number(soldier.flag.priorMinutes) || 0 : (Number(soldier.minutesByMonth?.[month]) || 0)
    const priorDecisions = open && Array.isArray(soldier.flag.decisions) ? soldier.flag.decisions : []
    const actor = { type: 'kid', id: soldier.id, name: input.kidName || soldier.name || '' }
    soldier.flag = {
      id: open && soldier.flag.id ? soldier.flag.id : `${soldier.id}:${month}`,
      status: 'flagged',
      month,
      year: input.year ?? null,
      grade: plan.line.grade,
      kidName: input.kidName || soldier.name || '',
      className: input.className || '',
      schoolId: input.schoolId ?? null,
      schoolName: input.schoolName || '',
      kapitlach: plan.kapitlach,
      minutes: plan.minutes,
      quotaKapitlach: plan.line.quotaKapitlach,
      quotaMinutes: plan.line.quotaMinutes,
      thresholdKapitlach: plan.line.kapitlach,
      thresholdMinutes: plan.line.minutes,
      reasons: plan.reasons,
      priorKapitlach,
      priorMinutes,
      priorReported,
      counts: plan.counts,
      createdAt: at,
      decisions: [...priorDecisions, decision('flagged', actor, at, null)],
    }
    if (plan.writeMark) {
      soldier.reports = { ...(soldier.reports || {}), [month]: plan.kapitlach }
      soldier.minutesByMonth = { ...(soldier.minutesByMonth || {}), [month]: plan.minutes }
    }
    return { error: null, plan, soldier }
  }

  soldier.reports = { ...(soldier.reports || {}), [month]: plan.kapitlach }
  soldier.minutesByMonth = { ...(soldier.minutesByMonth || {}), [month]: plan.minutes }
  if (soldier.flag && soldier.flag.status === 'flagged' && soldier.flag.month === month) {
    soldier.flag = {
      ...soldier.flag,
      status: 'removed',
      counts: false,
      decisions: [
        ...(soldier.flag.decisions || []),
        decision('removed', { type: 'kid', id: soldier.id, name: soldier.name || '' }, at, 'Corrected with a report inside the limit.'),
      ],
    }
  }
  return { error: null, plan, soldier }
}

/**
 * Accept counts the flagged numbers. Remove restores the prior value, or clears the month.
 * A flagged row can go either way. An accepted decision can be changed to removed,
 * and a removed decision can be changed to accepted. The same decision twice is refused.
 */
export function reviewSoldier(soldier, action, actor, at) {
  const flag = soldier.flag
  const status = flag?.status
  const reversible = status === 'flagged'
    || (status === 'accepted' && action === 'remove')
    || (status === 'removed' && action === 'accept')
  if (!flag || !reversible) {
    return { ok: false, error: 'This entry is not waiting for review.' }
  }
  const when = at || new Date().toISOString()
  const who = { type: actor?.type || 'admin', id: actor?.id ?? 0, name: actor?.name || '' }
  if (action === 'accept') {
    soldier.reports = { ...(soldier.reports || {}), [flag.month]: flag.kapitlach }
    soldier.minutesByMonth = { ...(soldier.minutesByMonth || {}), [flag.month]: flag.minutes }
    const logged = decision('accepted', who, when, null)
    soldier.flag = { ...flag, status: 'accepted', counts: true, decisions: [...(flag.decisions || []), logged] }
    return { ok: true, status: 'accepted', countedKapitlach: flag.kapitlach, decision: logged }
  }
  if (action === 'remove') {
    const reports = { ...(soldier.reports || {}) }
    const minutesByMonth = { ...(soldier.minutesByMonth || {}) }
    if (flag.priorReported) {
      reports[flag.month] = Number(flag.priorKapitlach) || 0
      minutesByMonth[flag.month] = Number(flag.priorMinutes) || 0
    } else {
      delete reports[flag.month]
      delete minutesByMonth[flag.month]
    }
    soldier.reports = reports
    soldier.minutesByMonth = minutesByMonth
    const logged = decision('removed', who, when, null)
    soldier.flag = { ...flag, status: 'removed', counts: false, decisions: [...(flag.decisions || []), logged] }
    const counted = flag.priorReported ? Number(flag.priorKapitlach) || 0 : 0
    return { ok: true, status: 'removed', countedKapitlach: counted, notCounted: !flag.priorReported, decision: logged }
  }
  return { ok: false, error: 'Choose accept or remove.' }
}

/** Public kapitlach for a month. A still-flagged amount is not included. */
export function kapitlachInTotals(soldier, month) {
  const flag = soldier?.flag
  if (flag && flag.month === month && flag.status === 'flagged' && !countsInPublicTotals('flagged')) {
    return flag.priorReported ? Number(flag.priorKapitlach) || 0 : 0
  }
  return Number(soldier?.reports?.[month]) || 0
}

export function minutesInTotals(soldier, month) {
  const flag = soldier?.flag
  if (flag && flag.month === month && flag.status === 'flagged' && !countsInPublicTotals('flagged')) {
    return flag.priorReported ? Number(flag.priorMinutes) || 0 : 0
  }
  return Number(soldier?.minutesByMonth?.[month]) || 0
}

export function missionCounts(soldier, month, quota) {
  const said = kapitlachInTotals(soldier, month)
  return Number(quota) > 0 && said >= Number(quota)
}

export function amountLabel(entry) {
  return `${entry.kapitlach} kapitlach · ${entry.minutes} min`
}

export function thresholdLabel(entry) {
  const parts = []
  const reasons = entry.reasons || []
  if (reasons.includes('kapitlach')) parts.push(`${entry.thresholdKapitlach} kapitlach`)
  if (reasons.includes('minutes')) parts.push(`${entry.thresholdMinutes} minutes`)
  if (!parts.length) parts.push(`${entry.thresholdKapitlach} kapitlach`)
  return parts.join(' · ')
}

export function formatFlagWhen(value, withTime = false) {
  if (!value) return ''
  const raw = String(value)
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return raw
  const opts = withTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleString('en-US', opts)
}
