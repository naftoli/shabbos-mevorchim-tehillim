// Home running-totals breakdown.
// The campaign's first Shabbos Mevorchim is Cheshvan 5778 (14 Oct 2017).
// A leap year lists Adar I and Adar II as two months. A plain year has one Adar.

import { campaignMonths } from './hebrewYear.js'

export const FIRST_CAMPAIGN_YEAR = 5778
export const FIRST_CAMPAIGN_MONTH = 'Cheshvan'

/** Months that belong to one Jewish year on the all-time breakdown. */
export function breakdownMonthNames(year) {
  const y = Number(year)
  if (!Number.isFinite(y) || y < FIRST_CAMPAIGN_YEAR) return []
  const months = campaignMonths(y)
  if (y !== FIRST_CAMPAIGN_YEAR) return months
  const start = months.indexOf(FIRST_CAMPAIGN_MONTH)
  return start < 0 ? months : months.slice(start)
}

/** Jewish years from 5778 through `year`, oldest first. */
export function campaignYearsThrough(year) {
  const end = Number(year)
  if (!Number.isFinite(end) || end < FIRST_CAMPAIGN_YEAR) return []
  const out = []
  for (let y = FIRST_CAMPAIGN_YEAR; y <= end; y += 1) out.push(y)
  return out
}

/**
 * Split `target` across `amounts` by weight. The pieces are whole numbers and
 * add up to `target`. A zero total is an even split.
 */
export function scaleAmounts(amounts, target) {
  const list = (amounts || []).map((n) => Math.max(0, Number(n) || 0))
  const goal = Math.max(0, Math.round(Number(target) || 0))
  if (!list.length) return []
  const sum = list.reduce((a, n) => a + n, 0)
  let used = 0
  return list.map((n, i) => {
    if (i === list.length - 1) return goal - used
    const next = sum > 0
      ? Math.round((n / sum) * goal)
      : Math.floor(goal / list.length)
    const capped = Math.max(0, Math.min(goal - used, next))
    used += capped
    return capped
  })
}

/** Scale each row's kapitlach to `kapitlachTarget`. Minutes keep the same ratio. */
export function scaleMonthRows(rows, kapitlachTarget) {
  const list = rows || []
  const scaled = scaleAmounts(list.map((row) => row.kapitlach), kapitlachTarget)
  const sum = list.reduce((a, row) => a + (Number(row.kapitlach) || 0), 0)
  const factor = sum > 0 ? (Number(kapitlachTarget) || 0) / sum : 0
  return list.map((row, i) => ({
    ...row,
    kapitlach: scaled[i],
    minutes: sum > 0 ? Math.max(0, Math.round((Number(row.minutes) || 0) * factor)) : 0,
  }))
}
