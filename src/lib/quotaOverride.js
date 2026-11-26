// One month's kapitlach quota, after a base-commander override.
// The ladder is not changed. Cheshvan is often repriced from today's ladder;
// an active override replaces that figure for the named month only.

export const QUOTA_ADJUSTED_LABEL = 'quota adjusted by base commander'

export function overrideIsActive(override) {
  return !!override && !override.undoneAt
}

/**
 * $engineQuota is the month as priced before any override. For Cheshvan that
 * may already be today's ladder. Pass that number in; the override wins.
 */
export function effectiveKapQuota(engineQuota, override) {
  const engine = Number(engineQuota) || 0
  if (!overrideIsActive(override)) {
    return { quota: engine, originalQuota: engine, quotaAdjusted: false, reason: null }
  }
  const original = override.originalQuota == null ? engine : (Number(override.originalQuota) || 0)
  return {
    quota: Number(override.overriddenQuota) || 0,
    originalQuota: original,
    quotaAdjusted: true,
    reason: override.reason || null,
  }
}

/**
 * Cheshvan's quota is recalculated from today's ladder. Every other month
 * keeps the engine figure. An override replaces whichever number that was,
 * for this month only.
 */
export function quotaForMonth({ month, engineQuota, todayLadderQuota = null, override = null }) {
  const computed = month === 'Cheshvan' && todayLadderQuota != null
    ? todayLadderQuota
    : engineQuota
  return effectiveKapQuota(computed, override)
}

export function metKap(quota, said, reported = true) {
  const q = Number(quota) || 0
  const n = Number(said) || 0
  return !!reported && q > 0 && n >= q
}

/**
 * HQ, or a base commander of this school. Anyone else — another school's
 * commander, a class teacher, a soldier — is 403.
 */
export function overrideAccessStatus(actor, kidSchoolId) {
  if (!actor) return 403
  const auth = actor.auth || ''
  const kind = actor.kind || (auth === 'super' ? 'super' : actor.type === 'admin' ? 'school' : null)
  if (kind === 'super' || auth === 'super') return 200
  const schools = []
  if (actor.schoolId != null && actor.schoolId !== '') schools.push(actor.schoolId)
  if (Array.isArray(actor.schoolIds)) schools.push(...actor.schoolIds)
  const target = String(kidSchoolId)
  if (target === '' || target === '0') return 403
  if (schools.some((id) => String(id) === target)) return 200
  return 403
}

/** Class totals after each soldier's override. Quota is the sum of effective quotas. */
export function adjustClassTotals(students, overridesById = {}) {
  let quota = 0
  let said = 0
  let met = 0
  const rows = (students || []).map((student) => {
    const eff = effectiveKapQuota(student.quota, overridesById[student.id])
    const reported = student.reported !== false
    const rowMet = metKap(eff.quota, student.said, reported)
    quota += eff.quota
    said += Number(student.said) || 0
    met += rowMet ? 1 : 0
    return { ...student, ...eff, met: rowMet }
  })
  const size = rows.length
  return {
    rows,
    quota,
    said,
    met,
    size,
    perfect: size > 0 && met === size,
    pctMet: size ? Math.round((met / size) * 100) : 0,
  }
}

/** Apply a month-keyed override map onto a soldier's month list. */
export function applyOverridesToMonths(months, overridesByMonth = {}) {
  return (months || []).map((month) => {
    const override = overridesByMonth[month.month]
    const computed = month.month === 'Cheshvan' && month.todayLadderQuota != null
      ? month.todayLadderQuota
      : month.quota
    const eff = effectiveKapQuota(computed, override)
    const reported = month.reported !== false
    return {
      ...month,
      quota: eff.quota,
      originalQuota: eff.originalQuota,
      quotaAdjusted: eff.quotaAdjusted,
      met: metKap(eff.quota, month.said, reported),
    }
  })
}
