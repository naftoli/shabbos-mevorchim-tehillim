import { campaignMonths, isHebrewLeapYear } from '@/lib/hebrewYear.js'

/**
 * Earliest month a medal can be earned if every remaining Shabbos Mevorchim
 * mission is completed. Built only from the campaign month list, which has
 * Adar I and Adar II in a leap year and one Adar otherwise. Returns null
 * when we cannot place it. Never invents a day-of-month.
 */
export function earliestMedalWhen(missionsToNext, fromMonth, year) {
  const steps = Number(missionsToNext)
  const startYear = Number(year)
  if (!Number.isFinite(steps) || steps < 1 || !Number.isFinite(startYear)) return null
  let y = startYear
  let months = campaignMonths(y)
  let index = months.indexOf(fromMonth)
  // A caller that still says "Adar" during a leap year starts at Adar I, the
  // first of the two months, so the count does not skip a mission.
  if (index < 0 && fromMonth === 'Adar' && isHebrewLeapYear(y)) index = months.indexOf('Adar I')
  if (index < 0) index = 0
  let left = steps
  let guard = 0
  while (left > 0 && guard < 400) {
    if (left === 1) {
      return `${months[index]} ${y}`
    }
    left -= 1
    index += 1
    if (index >= months.length) {
      index = 0
      y += 1
      months = campaignMonths(y)
    }
    guard += 1
  }
  return null
}
